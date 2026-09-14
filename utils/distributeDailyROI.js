import mongoose from "mongoose";
import redisClient from "../config/redis.js";
import UserModel from "../models/user.model.js";
import Investment from "../models/investment.model.js";
import Aroi from "../models/roi.model.js";

const PACKAGE_CONFIG = {
  25: { days: 30, multiplier: 2 },
  50: { days: 35, multiplier: 2 },
  100: { days: 40, multiplier: 2 },
  250: { days: 45, multiplier: 2 },
  500: { days: 50, multiplier: 2 },
  1000: { days: 55, multiplier: 2 },
};

const DEFAULT_DAYS = 30;
const getPackageConfig = (amount) => {
  return PACKAGE_CONFIG[amount] || { days: DEFAULT_DAYS, multiplier: 2 };
};
const getPackageDays = (amount) => PACKAGE_CONFIG[amount]?.days || DEFAULT_DAYS;

const getBusinessDay = () => {
  const now = new Date();
  const istMs = now.getTime() + 5.5 * 60 * 60 * 1000;
  const ist = new Date(istMs);
  return new Date(
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()),
  );
};

export const processUserRoi = async (user, creditedOn) => {
  const session = await mongoose.startSession();

  try {
    let result = { skipped: false, totalRoi: 0 };
    await session.withTransaction(async () => {
      const alreadyToday = await Aroi.findOne({ userId: user._id, creditedOn })
        .select("_id")
        .lean()
        .session(session);

      if (alreadyToday) {
        result = { skipped: true, reason: "ROI already credited today" };
        return;
      }

      const investments = await Investment.find({
        userId: user._id,
        status: "active",
      })
        .lean()
        .session(session);

      if (!investments.length) {
        result = { skipped: true, reason: "No active investment found" };
        return;
      }

      const roiBulk = [];
      const investmentBulk = [];
      let totalRoi = 0;
      let completedCount = 0;

      for (const inv of investments) {
        // const { days, multiplier } = getPackageConfig(
        //   plans,
        //   inv.investmentAmount,
        // );
        const { days, multiplier } = getPackageConfig(inv.investmentAmount);
        const maxRoi = Number((inv.investmentAmount * multiplier).toFixed(2));
        const earnedSoFar = Number((inv.totalRoiEarned || 0).toFixed(2));
        const remaining = Number((maxRoi - earnedSoFar).toFixed(2));

        // ✅ Cap hit ho chuka → inactive, aage koi trade nahi
        if (remaining <= 0) {
          investmentBulk.push({
            updateOne: {
              filter: { _id: inv._id, status: "active" },
              update: {
                $set: { status: "completed", completedOn: creditedOn },
              },
            },
          });
          completedCount += 1;
          continue;
        }

        const roiPercent = Number(((multiplier * 100) / days).toFixed(2));
        let dailyRoi = Number((maxRoi / days).toFixed(2));

        if (dailyRoi >= remaining) {
          dailyRoi = remaining;
        }

        const willComplete =
          Number((earnedSoFar + dailyRoi).toFixed(2)) >= maxRoi;

        roiBulk.push({
          insertOne: {
            document: {
              userId: user._id,
              investmentId: inv._id,
              roiAmount: dailyRoi,
              roiPercent,
              investmentAmount: inv.investmentAmount,
              packageName: inv.packageName,
              creditedOn,
              claimed: false,
              createdAt: new Date(),
            },
          },
        });

        if (willComplete) {
          investmentBulk.push({
            updateOne: {
              filter: { _id: inv._id },
              update: {
                $set: {
                  totalRoiEarned: maxRoi,
                  status: "completed",
                  completedOn: creditedOn,
                },
              },
            },
          });
          completedCount += 1;
        } else {
          investmentBulk.push({
            updateOne: {
              filter: { _id: inv._id },
              update: {
                $inc: { totalRoiEarned: dailyRoi },
                $set: { lastTradeDate: new Date() },
              },
            },
          });
        }

        totalRoi += dailyRoi;
      }

      if (roiBulk.length) {
        await Aroi.bulkWrite(roiBulk, { session });
      }
      if (investmentBulk.length) {
        await Investment.bulkWrite(investmentBulk, { session });
      }

      if (totalRoi > 0) {
        await UserModel.updateOne(
          { _id: user._id },
          {
            $inc: { totalRoi: totalRoi, pendingRoi: totalRoi },
            $set: { dailyRoi: totalRoi },
          },
          { session },
        );

        await UserModel.updateOne(
          {
            _id: user._id,
            $or: [
              { pendingRoi: { $lt: 0 } },
              { pendingRoi: { $gt: 0, $lt: 0.01 } },
            ],
          },
          { $set: { pendingRoi: 0 } },
          { session },
        );
      }

      result = { totalRoi, completedInvestments: completedCount };
    });

    console.log(`✅ ROI Credited → $${result.totalRoi || 0}`);

    if (!result.skipped && result.totalRoi > 0) {
      try {
        const bucketKey = `aiprofit:cache:${user._id.toString()}`;
        await redisClient.del(bucketKey);
        console.log(
          `🗑️ [Redis Bucket Evicted] Cleared cache for ROI user: ${user._id}`,
        );
      } catch (cacheError) {
        console.error(
          "⚠️ Redis Cache Clearing Failed in ROI:",
          cacheError.message,
        );
      }
    }

    return result;
  } catch (err) {
    console.error("ROI ERROR:", err);
    return { error: true, success: false, message: err.message };
  } finally {
    await session.endSession();
  }
};
export const calculateRoi = async (req, res) => {
  const userId = req?.user?._id;

  if (!userId || !mongoose.isValidObjectId(userId)) {
    return res
      .status(400)
      .json({ success: false, message: "Valid userId chahiye" });
  }

  try {
    const user = await UserModel.findById(userId)
      .select("username sponserId")
      .lean();

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const creditedOn = getBusinessDay();

    const result = await processUserRoi(user, creditedOn);

    // ❌ error case
    if (result?.error) {
      return res.status(500).json({
        success: false,
        message: "Server error",
      });
    }

    // ❌ already traded / no ROI case
    // if (result?.skipped || (!result?.totalRoi && !result?.creditedToEarnings)) {
    if (result?.skipped || !result?.totalRoi) {
      return res.status(400).json({
        success: false,
        message: result?.reason || "No pending ROI to claim",
        data: result,
      });
    }

    // ✅ success case
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
