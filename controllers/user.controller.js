import jwt from "jsonwebtoken";
import UserModel from "../models/user.model.js";
import { generateReferralCode, randomUsername } from "../utils/Random.js";
import { buildTree } from "../utils/BinaryTree.js";
import { getBinaryDownline } from "../utils/Downline.js";
import Investment from "../models/investment.model.js";
import Aroi from "../models/roi.model.js";
import Plan from "../models/plan.model.js";
import Support from "../models/support.model.js";
import Withdrawal from "../models/withdrwal.model.js";
import LevelIncome from "../models/LevelIncome.model.js";
import ReferalBonus from "../models/referalbonus.model.js";
import OneTimeReward from "../models/oneTime.model.js";
import MonthlyRewards from "../models/monthlyRewards.js";
import { propagateBinaryBusiness } from "../utils/propagateBusiness.js";
import mongoose from "mongoose";
import RewardPayout from "../models/rewardPayout.model.js";
import redisClient from "../config/redis.js";
import Admin from "../models/admin.model.js";
const findAvailablePosition = async (parentId) => {
  const queue = [parentId];

  while (queue.length > 0) {
    const currentUserId = queue.shift();
    const currentUser = await UserModel.findById(currentUserId);

    if (!currentUser) continue;

    if (!currentUser.left) {
      return { parent: currentUserId, position: "left" };
    }
    queue.push(currentUser.left);

    if (!currentUser.right) {
      return { parent: currentUserId, position: "right" };
    }
    queue.push(currentUser.right);
  }

  return null;
};

export const userRegister = async (req, res) => {
  try {
    const { walletAddress, referredBy } = req.body;

    const existingUser = await UserModel.findOne({ walletAddress });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    const referralCode = generateReferralCode();
    const username = randomUsername();

    const userCount = await UserModel.countDocuments();
    let role = "user";
    let parentId = null;
    let side = null;
    let sponsorId = null;

    if (userCount === 0) {
      role = "admin";
    } else {
      if (!referredBy) {
        return res.status(400).json({
          success: false,
          message: "Referral ID is required for registration.",
        });
      }

      const sponsorUser = await UserModel.findOne({ referralCode: referredBy });
      if (!sponsorUser) {
        return res.status(400).json({
          success: false,
          message: "Invalid referral ID",
        });
      }

      sponsorId = sponsorUser._id;

      const placement = await findAvailablePosition(sponsorUser._id);
      if (!placement) {
        return res.status(400).json({
          success: false,
          message: "No available position found",
        });
      }

      parentId = placement.parent;
      side = placement.position;
    }

    const newUser = new UserModel({
      walletAddress,
      referralCode,
      sponserId: sponsorId,
      parentId: parentId,
      role,
      username,
      position: side,
      parentReferedCode: referredBy,
    });

    const savedUser = await newUser.save();
    const user = await UserModel.findById(savedUser._id).populate(
      "referedUsers",
    );

    if (sponsorId) {
      await UserModel.findByIdAndUpdate(sponsorId, {
        $push: { referedUsers: savedUser._id },
      });
    }

    if (parentId) {
      await UserModel.findByIdAndUpdate(parentId, {
        [side]: savedUser._id,
      });
    }

    const token = jwt.sign(
      { id: savedUser._id, walletAddress: savedUser.walletAddress },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res
      .cookie("token", token, {
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        httpOnly: true,
        secure: false,
      })
      .status(201)
      .json({
        success: true,
        message: "User registered successfully",
        user: {
          data: user,
        },
        token,
      });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
export const userLogin = async (req, res) => {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        message: "Wallet Address is required",
      });
    }

    const user = await UserModel.findOne({ walletAddress }).populate(
      "referedUsers",
    );
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (user.isLoginBlocked) {
      return res.status(403).json({
        success: false,
        message: "Your login has been blocked. Please contact support.",
      });
    }

    const token = jwt.sign(
      { id: user._id, walletAddress: user.walletAddress },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res
      .cookie("token", token, {
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        httpOnly: true,
        secure: false,
        sameSite: "none",
      })
      .status(200)
      .json({
        success: true,
        token,
        data: user,
      });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const userLogout = async (req, res) => {
  try {
    res.clearCookie("token", { path: "/" });
    res.status(200).json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const getPackage = (amount) => {
  return packages.find((p) => amount >= p.minAmount && amount <= p.maxAmount);
};

const referralLevelConfig = [
  { level: 1, percent: 0.05, type: "REFERRAL_LEVEL_1" },
  { level: 2, percent: 0.02, type: "REFERRAL_LEVEL_2" },
  { level: 3, percent: 0.01, type: "REFERRAL_LEVEL_3" },
  { level: 4, percent: 0.01, type: "REFERRAL_LEVEL_4" },
  { level: 5, percent: 0.01, type: "REFERRAL_LEVEL_5" },
];

export const investment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user?._id;
    const amount = Number(req.body.investmentAmount);

    if (!userId || !amount) throw new Error("Invalid input");
    if (amount < 50 || amount > 100000)
      throw new Error("Investment must be between $50 and $100,000");

    const selectedPackage = getPackage(amount);
    if (!selectedPackage)
      throw new Error("No package found for this investment amount");

    console.log(
      `📦 Package Selected → ${selectedPackage.name} | ROI: ${selectedPackage.roiPercent}%`,
    );

    const user = await UserModel.findById(userId).session(session);
    if (!user) throw new Error("User not found");

    const [newInvestment] = await Investment.create(
      [
        {
          userId,
          investmentAmount: amount,
          activeInvestment: amount,
          packageName: selectedPackage.name,
          roiPercent: selectedPackage.roiPercent,
          totalRoiEarned: 0,
          status: "active",
          investmentDate: new Date(),
        },
      ],
      { session },
    );

    await UserModel.updateOne(
      { _id: userId },
      {
        $push: { investments: newInvestment._id },
        $inc: { totalInvestment: amount },
        $set: {
          isVerified: true,
          status: true,
          activeDate: new Date(),
          currentPackage: selectedPackage.name,
        },
      },
      { session },
    );
    console.log(`✅ User Updated → totalInvestment +$${amount}`);

    await session.commitTransaction();
    console.log(
      `\n🎉 Investment Successful → userId: ${userId} | amount: $${amount}\n`,
    );

    // ⚡ Buyer ka apna cache turant clear (fast, chhota operation, yahi rehne diya)
    try {
      await redisClient.del(`risenest:cache:${userId.toString()}`);
      console.log(`🗑️ [Redis] Buyer cache cleared: ${userId}`);
    } catch (cacheError) {
      console.error(
        "⚠️ Redis Cache Clearing Failed (buyer):",
        cacheError.message,
      );
    }

    try {
      await referralQueue.add("distribute-referral", {
        userId: userId.toString(),
        amount,
        investmentId: newInvestment._id.toString(),
      });
      console.log(
        `📨 [Queue] Referral job queued for investment ${newInvestment._id}`,
      );
    } catch (queueError) {
      console.error("⚠️ Failed to queue referral job:", queueError.message);
    }

    return res.status(201).json({
      success: true,
      message: "✅ Investment successful, referral bonus processing shortly",
      investment: newInvestment,
      package: selectedPackage,
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error(`\n🔥 Investment Failed → ${error.message}\n`);
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  } finally {
    session.endSession();
  }
};
export const getTotalRoi = async (req, res) => {
  try {
    const userId = req.user._id;
    const rois = await Aroi.find({ userId });
    const totalRoi = rois.reduce((acc, item) => acc + item.roiAmount, 0);
    res.status(200).json({ success: true, totalRoi });
  } catch (error) {
    console.error("Error in getTotalRoi:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
export const getProfile = async (req, res) => {
  try {
    const user = req.user;
    const userId = user._id;
    const userProfile = await UserModel.findById(userId)
      .populate("referedUsers")
      .lean();
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    res.json({ success: true, user: userProfile });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
export const getBinaryTree = async (req, res) => {
  try {
    const User = req.user;
    const userId = User._id;
    const user = await UserModel.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    const tree = await buildTree(user._id);

    res.json({ success: true, tree });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getDowunlineUsers = async (req, res) => {
  try {
    const User = req.user;
    const userId = User._id;
    const user = await UserModel.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const downline = await getBinaryDownline(user._id);

    res.json({ success: true, downline });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getAllPlan = async (req, res) => {
  try {
    const plans = await Plan.find({});
    res.json({ success: true, data: plans });
  } catch (error) {}
};
export const helpAndSupport = async (req, res) => {
  try {
    const userId = req.user?._id; // Mongoose convention ke mutabik _id use karo
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { message, subject } = req.body;
    if (!message || !subject) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    const support = await Support.create({
      userId,
      message,
      subject,
      createdAt: new Date(),
    });

    try {
      const bucketKey = `risenest:cache:${userId}`;
      await redisClient.del(bucketKey);
      console.log(
        `🗑️ [Redis Bucket Evicted] Cleared support user cache: ${userId}`,
      );
    } catch (cacheError) {
      console.error(
        "⚠️ Redis Cache Clearing Failed in Support:",
        cacheError.message,
      );
    }

    return res.status(201).json({
      success: true,
      message: "Support request sent Successfully",
      support,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};
export const getAllHelpAndSupportHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const supportHistory = await Support.find({ userId }).sort({
      createdAt: -1,
    });
    res.json({ success: true, data: supportHistory });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
export const getreferalHistoryByID = async (req, res) => {
  try {
    const userId = req.user?._id || req.admin?._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const referalHistory = await ReferalBonus.find({ userId })
      .populate([
        { path: "userId", select: "username" },
        { path: "fromUser", select: "username" },
        { path: "investmentId" },
      ])
      .sort({ createdAt: -1 });

    if (!referalHistory || referalHistory.length === 0) {
      return res.status(200).json({
        success: false,
        message: "No referral history found for this user.",
      });
    }

    res.json({ success: true, data: referalHistory });
  } catch (error) {
    console.error("Error fetching referral history:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
export const getInvestmentHistoryById = async (req, res) => {
  try {
    const userId = req.user?._id || req.admin?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const investmentsHistory = await Investment.find({
      userId: userId,
    }).sort({ createdAt: -1 });

    if (!investmentsHistory || investmentsHistory.length === 0) {
      return res.status(200).json({
        success: false,
        message: "No investment history found for this user.",
      });
    }

    res.json({ success: true, data: investmentsHistory });
  } catch (error) {
    console.error("Error getting investment history:", error);
    return res.status(500).json({
      message: "Server error",
      success: false,
    });
  }
};
export const getRoiIncomeHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    console.log(userId);

    if (!userId) {
      return res.status(400).json({
        message: "Unauthorized",
        success: false,
      });
    }

    const getRois = await Aroi.find({ userId })
      .populate("userId", "username")
      .populate("investmentId")
      .sort({ createdAt: -1 });

    if (!getRois || getRois.length === 0) {
      return res.status(200).json({
        message: "No Roi history found",
        success: false,
      });
    }

    return res.status(200).json({
      message: "Roi History Fetched",
      success: true,
      data: getRois,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Server Error",
      success: false,
    });
  }
};

export const getLevelIncomeHistory = async (req, res) => {
  try {
    const userId = req.user._id;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
        success: false,
      });
    }

    const levelIncomesReport = await LevelIncome.find({ userId })
      .populate("fromUserId", "username")
      .sort({ createdAt: -1 });

    if (levelIncomesReport.length === 0) {
      return res.status(200).json({
        message: "No Level Income History Found",
        success: false,
      });
    }

    return res.status(200).json({
      message: "Level Income History Reports",
      data: levelIncomesReport,
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Server Error",
      success: false,
    });
  }
};

export const getUsersCountByLevel = async (req, res) => {
  try {
    const userId = req.user._id;

    let levelCounts = [];
    let currentLevelUsers = [userId];
    const visited = new Set();

    for (let level = 1; level <= 5; level++) {
      const users = await UserModel.find(
        { _id: { $in: currentLevelUsers } },
        { referedUsers: 1 },
      );

      let nextLevelUserIds = [];

      users.forEach((user) => {
        if (user.referedUsers && user.referedUsers.length > 0) {
          user.referedUsers.forEach((refId) => {
            const idStr = refId.toString();
            if (!visited.has(idStr)) {
              visited.add(idStr);
              nextLevelUserIds.push(refId);
            }
          });
        }
      });

      const nextLevelUsers = await UserModel.find(
        { _id: { $in: nextLevelUserIds } },
        {
          username: 1,
          referralCode: 1,
          walletAddress: 1,
          totalInvestment: 1,
        },
      );

      levelCounts.push({
        level,
        count: nextLevelUsers.length,
        users: nextLevelUsers,
      });

      currentLevelUsers = nextLevelUserIds;
    }

    res.status(200).json({
      success: true,
      data: levelCounts,
    });
  } catch (error) {
    console.error("Error in getUsersCountByLevel:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

export const withdrawalHistory = async (req, res) => {
  try {
    const userId = req.user;
    const allWithdrwal = await Withdrawal.find({ userId: userId })
      .sort({
        createdAt: -1,
      })
      .select("amount createdAt fee netAmountSent status transactionHash");
    if (!allWithdrwal) {
      return res.status(200).json({
        message: "No withdrwal History Found",
        data: [],
      });
    }
    return res.status(200).json({
      message: "Withdrwal History Fetched",
      success: false,
      data: allWithdrwal,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Server Error",
      success: false,
    });
  }
};

export const getAllTeamRewardsHistory = async (req, res) => {
  try {
    const userId = req.user._id;

    if (!userId) {
      return res.status(401).json({
        message: "User is not authorized",
      });
    }

    const teamRewardsHistory = await OneTimeReward.find({ userId })
      .populate("userId", "username")
      .select("amount creditedOn milestone");

    if (teamRewardsHistory.length === 0) {
      return res.status(200).json({
        message: "No Rewards History found",
        success: true,
        data: [],
      });
    }

    return res.status(200).json({
      message: "Rewards history fetched successfully",
      success: true,
      data: teamRewardsHistory,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error in Getting Team Rewards History",
      success: false,
    });
  }
};

export const getAllMonthlyRewardsHistory = async (req, res) => {
  try {
    const userId = req.user._id;

    if (!userId) {
      return res.status(401).json({
        message: "User is not authorized",
      });
    }

    const history = await MonthlyRewards.find({ userId })
      .populate("userId", "username")
      .select("amount creditedOn rewardTier level1 level2 level3");

    if (history.length === 0) {
      return res.status(200).json({
        message: "No Monthly Rewards History found",
        success: true,
        data: [],
      });
    }

    return res.status(200).json({
      message: "Monthly Rewards History fetched",
      success: true,
      data: history,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error in getting Monthly Rewards History",
      success: false,
    });
  }
};

export const claimRoi = async (req, res) => {
  try {
    const userId = req.user._id;
    const User = await UserModel.findById(userId);

    if (!User) {
      return res.status(404).json({
        message: "User not found",
        success: false,
      });
    }
    if (User.totalInvestment === 0) {
      return res.status(200).json({
        message: "You have no investment and cannot claim ROI",
        success: false,
      });
    }
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    const tomorrowStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );

    const roiEntry = await Aroi.findOne({
      userId,
      creditedOn: { $gte: todayStart, $lt: tomorrowStart },
      isClaimed: false,
    });

    if (!roiEntry) {
      return res
        .status(200)
        .json({ message: "ROI already claimed or not available for today." });
    }

    const user = await UserModel.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.dailyRoi = (user.dailyRoi || 0) + roiEntry.roiAmount;
    user.totalRoi = (user.totalRoi || 0) + roiEntry.roiAmount;
    user.totalEarnings = (user.totalEarnings || 0) + roiEntry.roiAmount;
    user.currentEarnings = (user.currentEarnings || 0) + roiEntry.roiAmount;

    await user.save();

    roiEntry.isClaimed = true;
    await roiEntry.save();

    res.status(200).json({
      message: "Today's Trade Profit is claimed successfully.",
      roiAmount: roiEntry.roiAmount,
      success: true,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Please try after sometime", success: false });
  }
};

export const getTeamBusiness = async (req, res) => {
  try {
    const userId = req.user._id;

    const levels = {
      level1: [],
      level2: [],
      level3: [],
      level4: [],
      level5: [],
    };

    const levelBusiness = {
      level1Business: 0,
      level2Business: 0,
      level3Business: 0,
      level4Business: 0,
      level5Business: 0,
    };

    const teamBusinessPerLevel = [];
    let totalTeamBusiness = 0;

    let currentLevelUserIds = [userId];

    for (let level = 1; level <= 5; level++) {
      // ✅ Populate sponsor info
      const users = await UserModel.find({
        sponserId: { $in: currentLevelUserIds },
      })
        .select("_id username email totalInvestment sponserId")
        .populate({
          path: "sponserId",
          select: "username",
        });

      if (users.length === 0) break;

      // ✅ Format each user with sponsor username
      const formattedUsers = users.map((user) => ({
        _id: user._id,
        username: user.username,
        email: user.email,
        totalInvestment: user.totalInvestment || 0,
        sponsorUsername: user.sponserId?.username || "N/A",
      }));

      levels[`level${level}`] = formattedUsers;

      const levelBusinessAmount = formattedUsers.reduce(
        (acc, user) => acc + (user.totalInvestment || 0),
        0,
      );
      levelBusiness[`level${level}Business`] = levelBusinessAmount;

      teamBusinessPerLevel.push({
        level: `Level ${level}`,
        business: levelBusinessAmount,
        userCount: formattedUsers.length,
      });

      totalTeamBusiness += levelBusinessAmount;

      currentLevelUserIds = users.map((u) => u._id);
    }

    return res.status(200).json({
      success: true,
      message: "Team business fetched successfully",
      ...levels,
      ...levelBusiness,
      teamBusinessPerLevel,
      totalTeamBusiness,
    });
  } catch (error) {
    console.error("Error in getTeamBusiness:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

// const getLevelPercent = (level) => {
//   const map = { 1: 10, 2: 5, 3: 3, 4: 1, 5: 1 };
//   return map[level] || 0;
// };

// // ===============================
// // LEVEL INCOME (claim ke time, on the spot)
// // Har upline ka alag LevelIncome record banta hai (= level income history)
// // ===============================
// const buildLevelIncomeOps = async (
//   fromUser,
//   roiAmount,
//   creditedAt,
//   session,
// ) => {
//   const records = [];
//   const userUpdates = [];
//   let totalDistributed = 0;

//   if (!fromUser?.sponserId) {
//     console.log(`     ⛔ No sponserId — level income skipped`);
//     return { records, userUpdates, totalDistributed };
//   }

//   let sponsorId = fromUser.sponserId;
//   let level = 1;

//   while (sponsorId && level <= 5) {
//     const sponsor = await UserModel.findById(sponsorId)
//       .select("username sponserId isVerified")
//       .session(session)
//       .lean();

//     if (!sponsor) {
//       console.log(`     ⛔ Level ${level} → sponsor not found — chain break`);
//       break;
//     }

//     if (sponsor.isVerified) {
//       const percent = getLevelPercent(level);
//       const income = Number(((roiAmount * percent) / 100).toFixed(2));

//       if (income > 0) {
//         console.log(
//           `     ✅ Level ${level} → ${sponsor.username} | +$${income} (${percent}%)`,
//         );

//         records.push({
//           insertOne: {
//             document: {
//               userId: sponsor._id,
//               fromUserId: fromUser._id,
//               fromUserName: fromUser.username,
//               toUserName: sponsor.username,
//               level,
//               percent,
//               roi: roiAmount,
//               amount: income,
//               creditedAt,
//               claimed: true,
//               claimedAt: creditedAt,
//             },
//           },
//         });

//         userUpdates.push({
//           updateOne: {
//             filter: { _id: sponsor._id },
//             update: {
//               $inc: {
//                 levelIncome: income,
//                 mainWallet: income,
//                 totalEarnings: income,
//                 currentEarnings: income,
//               },
//             },
//           },
//         });

//         totalDistributed += income;
//       }
//     } else {
//       console.log(
//         `     ⚠️  Level ${level} → ${sponsor.username} | not eligible`,
//       );
//     }

//     sponsorId = sponsor.sponserId;
//     level++;
//   }

//   return {
//     records,
//     userUpdates,
//     totalDistributed: Number(totalDistributed.toFixed(2)),
//   };
// };

// export const claimEarnings = async (req, res) => {
//   const userId = req.user?._id;
//   const session = await mongoose.startSession();
//   try {
//     session.startTransaction();
//     const now = new Date();

//     const user = await UserModel.findById(userId)
//       .select("username sponserId")
//       .session(session)
//       .lean();

//     if (!user) {
//       await session.abortTransaction();
//       return res
//         .status(404)
//         .json({ success: false, message: "User not found" });
//     }

//     const roiAgg = await Aroi.aggregate([
//       {
//         $match: {
//           userId: new mongoose.Types.ObjectId(userId),
//           claimed: { $ne: true },
//         },
//       },
//       { $group: { _id: null, total: { $sum: "$roiAmount" } } },
//     ]).session(session);

//     const roiTotal = Number((roiAgg[0]?.total || 0).toFixed(2));

//     if (roiTotal <= 0) {
//       await session.abortTransaction();
//       return res.status(400).json({
//         success: false,
//         message: "Claim karne ke liye koi pending ROI nahi hai",
//       });
//     }

//     await Aroi.updateMany(
//       { userId, claimed: { $ne: true } },
//       { $set: { claimed: true, claimedAt: now } },
//       { session },
//     );

//     await UserModel.updateOne(
//       { _id: userId },
//       {
//         $inc: {
//           mainWallet: roiTotal,
//           totalEarnings: roiTotal,
//           currentEarnings: roiTotal,
//         },
//         $set: { pendingRoi: 0 },
//       },
//       { session },
//     );
//     console.log(`  💸 ROI claimed → ${user.username} | +$${roiTotal} wallet`);

//     // Level income upline ko
//     const { records, userUpdates, totalDistributed } =
//       await buildLevelIncomeOps(user, roiTotal, now, session);

//     if (records.length) await LevelIncome.bulkWrite(records, { session });
//     if (userUpdates.length) await UserModel.bulkWrite(userUpdates, { session });

//     // 💽 DATABASE TRANSACTION COMMIT (Sab kuch safely DB me likha gaya)
//     await session.commitTransaction();
//     console.log(
//       `  ✅ Claim done → ROI $${roiTotal} | LevelIncome $${totalDistributed}`,
//     );

//     // =======================================================
//     // ⚡ NEW HASH BUCKET PARALLEL INVALIDATION (COMMIT KE BAAD)
//     // =======================================================
//     try {
//       const deletePromises = [];
//       const usersToInvalidate = new Set();

//       // 1. Sabse pehle claim karne wale user ki ID add karo
//       usersToInvalidate.add(userId.toString());

//       // 2. Jo-jo uplines bulkWrite (userUpdates) me update hue hain, unki IDs nikaal kar Set me daalo
//       if (userUpdates && userUpdates.length > 0) {
//         userUpdates.forEach((op) => {
//           const uplineId =
//             op.updateOne?.filter?._id || op.updateOne?.filter?._id?.$in;
//           if (uplineId) {
//             usersToInvalidate.add(uplineId.toString());
//           }
//         });
//       }

//       // 3. Sabhi affected users ka poora bucket parallelly delete karo
//       for (const uId of usersToInvalidate) {
//         deletePromises.push(redisClient.del(`risenest:cache:${uId}`));
//       }

//       await Promise.all(deletePromises);
//       console.log(
//         `🗑️ [Redis Bucket Evicted] Cleared cache for ${deletePromises.length} users after claim.`,
//       );
//     } catch (cacheError) {
//       // Redis fail hone par bhi claim process successfully response jana chahiye
//       console.error(
//         "⚠️ Redis Cache Clearing Failed in Claim Earnings:",
//         cacheError.message,
//       );
//     }

//     return res.status(200).json({
//       success: true,
//       message: "ROI claimed & level income distributed",
//       data: {
//         roiClaimed: roiTotal,
//         levelIncomeDistributed: totalDistributed,
//         levelsPaid: records.length,
//       },
//     });
//   } catch (err) {
//     await session.abortTransaction();
//     console.error(`❌ Claim Failed → ${userId} | ${err.message}`);
//     return res
//       .status(500)
//       .json({ success: false, message: "Claim process me error" });
//   } finally {
//     session.endSession();
//   }
// };

const getLevelPercent = (level) => {
  const map = { 1: 10, 2: 5, 3: 3, 4: 1, 5: 1 };
  return map[level] || 0;
};

const buildLevelIncomeOps = async (
  fromUser,
  roiAmount,
  creditedAt,
  session,
) => {
  const records = [];
  const userUpdates = [];
  let totalDistributed = 0;

  if (!fromUser?.sponserId) {
    console.log(`     ⛔ No sponserId — level income skipped`);
    return { records, userUpdates, totalDistributed };
  }

  let sponsorId = fromUser.sponserId;
  let level = 1;

  while (sponsorId && level <= 5) {
    const sponsor = await UserModel.findById(sponsorId)
      .select("username sponserId isVerified")
      .session(session)
      .lean();

    if (!sponsor) {
      console.log(`     ⛔ Level ${level} → sponsor not found — chain break`);
      break;
    }

    if (sponsor.isVerified) {
      const percent = getLevelPercent(level);
      const income = Number(((roiAmount * percent) / 100).toFixed(2));

      if (income > 0) {
        console.log(
          `     ✅ Level ${level} → ${sponsor.username} | +$${income} (${percent}% of base ROI $${roiAmount})`,
        );

        records.push({
          insertOne: {
            document: {
              userId: sponsor._id,
              fromUserId: fromUser._id,
              fromUserName: fromUser.username,
              toUserName: sponsor.username,
              level,
              percent,
              roi: roiAmount, // base ROI (jis pe % laga)
              amount: income,
              creditedAt,
              claimed: true,
              claimedAt: creditedAt,
            },
          },
        });

        userUpdates.push({
          updateOne: {
            filter: { _id: sponsor._id },
            update: {
              $inc: {
                levelIncome: income,
                totalEarnings: income,
                currentEarnings: income,
              },
            },
          },
        });

        totalDistributed += income;
      }
    } else {
      console.log(
        `     ⚠️  Level ${level} → ${sponsor.username} | not eligible`,
      );
    }

    sponsorId = sponsor.sponserId;
    level++;
  }

  return {
    records,
    userUpdates,
    totalDistributed: Number(totalDistributed.toFixed(2)),
  };
};

export const claimEarnings = async (req, res) => {
  const userId = req.user?._id;
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const now = new Date();

    const user = await UserModel.findById(userId)
      .select("username sponserId")
      .session(session)
      .lean();

    if (!user) {
      await session.abortTransaction();
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const roiAgg = await Aroi.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          claimed: { $ne: true },
        },
      },
      { $group: { _id: null, total: { $sum: "$roiAmount" } } },
    ]).session(session);

    const roiTotal = Number((roiAgg[0]?.total || 0).toFixed(2));

    if (roiTotal <= 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "No pending ROI to claim",
      });
    }

    await Aroi.updateMany(
      { userId, claimed: { $ne: true } },
      { $set: { claimed: true, claimedAt: now } },
      { session },
    );

    // User ko PURA roiTotal milta hai (2x basis wala) — yahan koi change nahi
    await UserModel.updateOne(
      { _id: userId },
      {
        $inc: {
          totalEarnings: roiTotal,
          currentEarnings: roiTotal,
          totalEarnings: roiTotal,
        },
        $set: { pendingRoi: 0 },
      },
      { session },
    );
    console.log(`  💸 ROI claimed → ${user.username} | +$${roiTotal} wallet`);

    // =======================================================
    // 🆕 LEVEL INCOME — sirf BASE amount ke ROI pe
    // ROI 2x basis pe banta hai (deposit $50 → ROI $100 ke hisaab se),
    // isliye base ROI = roiTotal / 2
    // =======================================================
    const baseRoiForLevel = Number(roiTotal.toFixed(2));
    console.log(
      `  📐 Level income basis → claimed ROI: $${roiTotal} | base ROI: $${baseRoiForLevel}`,
    );

    const { records, userUpdates, totalDistributed } =
      await buildLevelIncomeOps(user, baseRoiForLevel, now, session);

    if (records.length) await LevelIncome.bulkWrite(records, { session });
    if (userUpdates.length) await UserModel.bulkWrite(userUpdates, { session });

    // 💽 DATABASE TRANSACTION COMMIT (Sab kuch safely DB me likha gaya)
    await session.commitTransaction();
    console.log(
      `  ✅ Claim done → ROI $${roiTotal} | LevelIncome $${totalDistributed} (base basis)`,
    );

    // =======================================================
    // ⚡ HASH BUCKET PARALLEL INVALIDATION (COMMIT KE BAAD)
    // =======================================================
    try {
      const deletePromises = [];
      const usersToInvalidate = new Set();

      // 1. Claim karne wala user
      usersToInvalidate.add(userId.toString());

      // 2. Saare affected uplines
      if (userUpdates && userUpdates.length > 0) {
        userUpdates.forEach((op) => {
          const uplineId = op.updateOne?.filter?._id;
          if (uplineId) {
            usersToInvalidate.add(uplineId.toString());
          }
        });
      }

      // 3. Sabka bucket parallelly delete
      for (const uId of usersToInvalidate) {
        deletePromises.push(redisClient.del(`aiprofit:cache:${uId}`));
      }

      await Promise.all(deletePromises);
      console.log(
        `🗑️ [Redis Bucket Evicted] Cleared cache for ${deletePromises.length} users after claim.`,
      );
    } catch (cacheError) {
      console.error(
        "⚠️ Redis Cache Clearing Failed in Claim Earnings:",
        cacheError.message,
      );
    }

    return res.status(200).json({
      success: true,
      message: "Profit claimed successfully",
      data: {
        roiClaimed: roiTotal,
        levelIncomeBasis: baseRoiForLevel,
        levelIncomeDistributed: totalDistributed,
        levelsPaid: records.length,
      },
    });
  } catch (err) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error(`❌ Claim Failed → ${userId} | ${err.message}`);
    return res
      .status(500)
      .json({ success: false, message: "Claim process me error" });
  } finally {
    session.endSession();
  }
};

export const getClaimableEarnings = async (req, res) => {
  const userId = req.user?._id;
  try {
    const roiAgg = await Aroi.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          claimed: { $ne: true },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$roiAmount" },
          count: { $sum: 1 },
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      data: {
        claimableRoi: Number((roiAgg[0]?.total || 0).toFixed(2)),
        records: roiAgg[0]?.count || 0,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getSalaryIncomeHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const salaryIncomeHistory = await RewardPayout.find({
      userId,
      status: "paid",
    })
      .populate("userId", "username")
      .sort({
        createdAt: -1,
      });
    res.json({ success: true, data: salaryIncomeHistory });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getDepositAddress = async (req, res) => {
  try {
    const userId = req.user._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const admin = await Admin.findOne({});
    if (!admin) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    res.json({ success: true, data: admin.walletAddress });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
