import LevelIncome from "../models/LevelIncome.model.js";
import UserModel from "../models/user.model.js";

const getLevelPercent = (level) => {
  if (level === 1) return 15;
  if (level === 2) return 10;
  if (level === 3) return 5;
  if (level === 4) return 5;
  if (level === 5) return 5;
  return 0;
};

const MAX_LEVELS = 5;

export const distributeLevelIncomeOnRoi = async (
  fromUser,
  roiAmount,
  investmentId,
) => {
  try {
    if (!fromUser?._id || roiAmount <= 0) return;

    const from = await UserModel.findById(fromUser._id).select(
      "username sponserId",
    );
    if (!from?.sponserId) return;

    let sponsorId = from.sponserId;
    let level = 1;

    const creditedAt = new Date();
    creditedAt.setHours(0, 0, 0, 0);

    while (sponsorId && level <= MAX_LEVELS) {
      const sponsor = await UserModel.findById(sponsorId).select(
        "username sponserId activeDirects directBusiness roiDaysCompleted isVerified totalEarnings currentEarnings mainWallet",
      );
      if (!sponsor) break;

      // 🔓 MWS unlock condition
      if (sponsor.isVerified) {
        const percent = getLevelPercent(level);
        const income = Number(((roiAmount * percent) / 100).toFixed(2));

        if (income > 0) {
          await LevelIncome.updateOne(
            {
              userId: sponsor._id,
              fromUserId: from._id,
              investmentId,
              level,
              creditedAt,
            },
            {
              $setOnInsert: {
                userId: sponsor._id,
                fromUserId: from._id,
                fromUserName: from.username,
                toUserName: sponsor.username,
                investmentId,
                level,
                percent,
                roi: roiAmount,
                amount: income,
                creditedAt,
              },
            },
            { upsert: true },
          );

          await UserModel.updateOne(
            { _id: sponsor._id },
            {
              $inc: {
                levelIncome: income,
                totalEarnings: income,
                currentEarnings: income,
                mainWallet: income,
              },
            },
          );
        }
      }

      sponsorId = sponsor.sponserId;
      level++;
    }
  } catch (err) {
    console.error("❌ MWS Level Income Error:", err.message);
  }
};
