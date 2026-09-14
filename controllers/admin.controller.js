import Admin from "../models/admin.model.js";
import Investment from "../models/investment.model.js";
import LevelIncome from "../models/LevelIncome.model.js";
import ReferalBonus from "../models/referalbonus.model.js";
import Aroi from "../models/roi.model.js";
import Support from "../models/support.model.js";
import UserModel from "../models/user.model.js";
import Withdrawal from "../models/withdrwal.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import path, { dirname } from "path";
import fs from "fs";
import Banner from "../models/banner.model.js";
import { fileURLToPath } from "url";
import Settings from "../models/settings.model.js";
import MonthlyRewards from "../models/monthlyRewards.js";
import OneTimeReward from "../models/oneTime.model.js";
import { generateRandomTxResponse } from "../utils/Random.js";
import { AdminTopUp } from "../models/adminTopUp.model.js";
import RewardPayout from "../models/rewardPayout.model.js";
import mongoose from "mongoose";
import redisClient from "../config/redis.js";

export const adminRegister = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        message: "All Feild are requireds",
        success: false,
      });
    }

    const hashPassword = await bcrypt.hash(password, 10);

    const newAdmin = await Admin.create({
      email,
      password: hashPassword,
    });
    if (!newAdmin) {
      return res.status(400).json({
        message: "User Not Created",
        success: false,
      });
    }
    const admin = await newAdmin.save();

    return res.status(200).json({
      message: "Register Successfull",
      success: true,
      data: admin,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Server Error",
      success: false,
    });
  }
};
export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "All fields are required",
        success: false,
      });
    }

    const user = await Admin.findOne({ email: email });
    if (!user) {
      return res.status(404).json({
        message: "User not found",
        success: false,
      });
    }

    // Compare passwords
    const matchPassword = await bcrypt.compare(password, user.password);
    if (!matchPassword) {
      return res.status(401).json({
        message: "Invalid credentials",
        success: false,
      });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    // Set cookie and send response
    return res
      .cookie("token", token, {
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "none",
      })
      .status(200)
      .json({
        success: true,
        token,
        data: {
          _id: user._id,
          email: user.email,
          walletAddress: user.walletAddress,
        },
      });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: error.message || "Server error",
      success: false,
    });
  }
};
export const getProfile = async (req, res) => {
  try {
    const userId = req.admin;
    if (!userId) {
      return res.status(404).json({
        message: "Unauthorized",
      });
    }
    const user = await Admin.findById(userId);
    if (!user) {
      return res.status(200).json({
        message: "User not found",
      });
    }
    return res.status(200).json({
      message: "User Profile",
      data: user,
      success: true,
    });
  } catch (error) {}
};
export const getDailyRoi = async (req, res) => {
  try {
    const userId = req.admin;
    if (!userId) {
      return res.status(404).json({
        message: "Unauthorized",
      });
    }
    const dailyRoi = await Aroi.find({})
      .populate("userId investmentId")
      .sort({ date: -1 });
    return res.status(200).json({
      message: "All User DailyRoi History",
      data: dailyRoi,
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Server Error",
      success: false,
    });
  }
};
export const allUsers = async (req, res) => {
  try {
    const admin = req.admin;
    if (!admin) {
      return res.status(401).json({
        message: "Unauthorized",
        success: false,
      });
    }

    const users = await UserModel.find();
    if (!users || users.length === 0) {
      return res.status(200).json({
        message: "No users found",
        data: [],
        success: true,
      });
    }

    return res.status(200).json({
      message: "All Users",
      data: users,
      success: true,
    });
  } catch (error) {
    console.error("Error in allUsers:", error);
    return res.status(500).json({
      message: "Server Error",
      success: false,
    });
  }
};
export const getAllUsers = async (req, res) => {
  try {
    const users = await UserModel.find({});
    if (!users) {
      return res.status(200).json({
        message: "no users",
        data: [],
      });
    }

    return res.status(200).json({
      message: "All Users",
      data: users,
    });
  } catch (error) {}
};
export const getAllLevelIncome = async (req, res) => {
  try {
    const userId = req.admin;
    if (!userId) {
      return res.status(404).json({
        message: "Unauthorized",
      });
    }
    const levelIncome = await LevelIncome.find({}).populate(
      "userId fromUserId",
    );
    return res.status(200).json({
      message: "All User Level Income History",
      data: levelIncome,
      success: true,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server Error",
      success: false,
    });
  }
};

export const getAllReferalBonus = async (req, res) => {
  try {
    const userId = req.admin || req.user;
    if (!userId) {
      return res.status(404).json({
        message: "Unauthorized",
      });
    }
    const referalBonus = await ReferalBonus.find({})
      .populate("userId fromUser investmentId")
      .sort({ createdAt: -1 });
    if (!referalBonus) {
      return res.status(200).json({
        message: "No referal bonus found",
      });
    }
    return res.status(200).json({
      message: "All User Referal Bonus History",
      data: referalBonus,
      success: true,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server Error",
      success: false,
    });
  }
};

export const getAllIncomes = async (req, res) => {
  try {
    const admin = req.admin;

    if (!admin) {
      return res.status(401).json({
        message: "Unauthorized",
        success: false,
      });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const getTotalAmount = async (Model, field, match = {}) => {
      const result = await Model.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            total: { $sum: `$${field}` },
          },
        },
      ]);

      return result[0]?.total || 0;
    };

    // ⚡ parallel execution (fast)
    const [
      totalUsers,

      totalInvestment,
      todayInvestment,

      totalRoi,
      todayRoi,

      totalLevelIncome,
      todayLevelIncome,

      totalDirectReferral,
      todayDirectReferral,

      totalWithdrawals,
      todayWithdrawal,

      totalSalaryIncome,
      todaySalaryIncome,
    ] = await Promise.all([
      UserModel.countDocuments(),

      // Investment
      getTotalAmount(UserModel, "totalInvestment"),
      getTotalAmount(UserModel, "totalInvestment", {
        investmentDate: { $gte: todayStart, $lte: todayEnd },
      }),

      // ROI
      getTotalAmount(Aroi, "roiAmount"),
      getTotalAmount(Aroi, "roiAmount", {
        creditedOn: { $gte: todayStart, $lte: todayEnd },
      }),

      // Level Income
      getTotalAmount(LevelIncome, "amount"),
      getTotalAmount(LevelIncome, "amount", {
        createdAt: { $gte: todayStart, $lte: todayEnd },
      }),

      // Referral Income
      getTotalAmount(ReferalBonus, "amount"),
      getTotalAmount(ReferalBonus, "amount", {
        date: { $gte: todayStart, $lte: todayEnd },
      }),

      // Withdrawals
      getTotalAmount(Withdrawal, "amount"),
      getTotalAmount(Withdrawal, "amount", {
        createdAt: { $gte: todayStart, $lte: todayEnd },
      }),

      // ⭐ SALARY INCOME (FIXED - ONLY PAID)
      getTotalAmount(RewardPayout, "amount", {
        status: "paid",
      }),

      getTotalAmount(RewardPayout, "amount", {
        status: "paid",
        createdAt: { $gte: todayStart, $lte: todayEnd },
      }),
    ]);

    return res.status(200).json({
      message: "Platform Income Summary",
      success: true,
      data: {
        totalUsers,

        totalInvestment,
        todayInvestment,

        totalRoi,
        todayRoi,

        totalLevelIncome,
        todayLevelIncome,

        totalDirectReferral,
        todayDirectReferral,

        totalSalaryIncome,
        todaySalaryIncome,

        totalWithdrawals,
        todayWithdrawal,
      },
    });
  } catch (error) {
    console.error("Error in getAllIncomes:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};
export const getTotalInvestedUsers = async (_, res) => {
  try {
    const allInvestUsers = await Investment.find({}).populate("userId");

    if (!allInvestUsers) {
      return res.status(200).json({
        message: "No Invested Users",
        success: false,
      });
    }

    return res.status(200).json({
      message: "All Invested Users",
      success: false,
      data: allInvestUsers,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "server error",
      success: false,
    });
  }
};

export const getLevelIncomeHistory = async (_, res) => {
  try {
    const getAllLevelIncomes = await LevelIncome.find({})
      .sort({ createdAt: -1 })
      .populate({
        path: "userId fromUserId",
        select: "username walletAddress levelIncome",
      });

    if (!getAllLevelIncomes) {
      return res.status(404).json({
        message: "No Level Income History Found",
        success: false,
      });
    }
    return res.status(200).json({
      message: "LevelIncome History",
      success: true,
      data: getAllLevelIncomes,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Server Errro",
    });
  }
};

export const getAllMessage = async (req, res) => {
  try {
    const allTickets = await Support.find({}).sort({ createdAt: -1 });
    if (!allTickets) {
      return res.sta(200).json({
        messae: "No Tickets Founds",
        success: false,
      });
    }
    return res.status(200).json({
      message: "All Tickets Fetched",
      success: false,
      data: allTickets,
    });
  } catch (error) {}
};

export const ticketApprove = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { message } = req.body;

    if (!ticketId || !message) {
      return res.status(400).json({
        message: "Ticket Id && message are required",
        success: false,
      });
    }

    const ticket = await Support.findById(ticketId);

    if (!ticket) {
      return res.status(404).json({
        message: "Ticket not found",
        success: false,
      });
    }

    ticket.status = "Approved";
    ticket.response = message;
    await ticket.save();

    return res.status(200).json({
      message: "Ticket Approved Successfully",
      success: true,
      data: ticket,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Server Error",
      success: false,
    });
  }
};

export const ticketReject = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { message } = req.body;

    if (!ticketId || !message) {
      return res.status(400).json({
        message: "Ticket Id  & message are required",
        success: false,
      });
    }

    const ticket = await Support.findById(ticketId);

    if (!ticket) {
      return res.status(404).json({
        message: "Ticket not found",
        success: false,
      });
    }

    ticket.status = "Rejected";
    ticket.response = message;
    await ticket.save();

    return res.status(200).json({
      message: "Ticket Rejected Successfully",
      success: true,
      data: ticket,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Server Error",
      success: false,
    });
  }
};

export const getRoiHistory = async (req, res) => {
  try {
    const roiHistories = await Aroi.find({}).populate("userId investmentId");
    if (!roiHistories) {
      return res.status(200).json({
        message: "Roi history not found",
        success: false,
      });
    }

    return res.status(200).json({
      message: "ROI History Fetched",
      success: false,
      data: roiHistories,
    });
  } catch (error) {}
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let currentBanner = null;

export const uploadBanner = async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({
        message: "title is required",
        success: false,
      });
    }
    if (!req.file) {
      return res.status(400).json({ message: "No banner uploaded" });
    }

    const newBanner = new Banner({
      imageUrl: `/uploads/banners/${req.file.filename}`,
      title: title,
    });

    await newBanner.save();

    res.status(201).json({
      message: "Banner uploaded successfully",
      banner: newBanner,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Banner upload failed", error: error.message });
  }
};

export const getBanners = async (req, res) => {
  try {
    const banners = await Banner.find().sort({ createdAt: -1 });
    res.status(200).json({
      message: "Banners fetched successfully",
      success: true,
      data: banners,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch banners",
      success: false,
      error: error.message,
    });
  }
};

export const deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ message: "Banner not found" });
    }

    const imagePath = path.join(__dirname, ".. ", banner.imageUrl);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    await Banner.findByIdAndDelete(req.params.id);

    res.json({ message: "Banner deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to delete banner", error: error.message });
  }
};

export const updateGlobalLimit = async (req, res) => {
  const { newLimit } = req.body;

  if (!newLimit || isNaN(newLimit)) {
    return res.status(400).json({ message: "Invalid limit" });
  }

  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({ withdrawalLimit: newLimit });
    } else {
      settings.withdrawalLimit = newLimit;
      await settings.save();
    }

    res.json({ message: "Global withdrawal limit updated", success: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to update", error: err.message });
  }
};

export const allWithdrwal = async (req, res) => {
  try {
    const userId = req.admin._id;
    if (!userId) {
      return res.status(400).json({
        messae: "Please Login First",
        success: false,
      });
    }
    const allWithdrwals = await Withdrawal.find({}).populate(
      "userId",
      "username",
    );
    if (!allWithdrwals) {
      return res.status(200).json({
        message: "No Withdrwal Founds",
        success: false,
      });
    }
    return res.status(200).json({
      message: "All withdrwal fetched",
      success: true,
      data: allWithdrwals,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.messae || "Server Error",
      success: false,
    });
  }
};

export const monthlyIncomeHistory = async (req, res) => {
  try {
    const userId = req.admin._id;

    if (!userId) {
      return res.status(404).json({
        message: "User not found",
        success: false,
      });
    }

    const monthlyHistory = await MonthlyRewards.find({}).populate({
      path: "userId",
      select: "username",
    });
    if (!monthlyHistory || monthlyHistory.length === 0) {
      return res.status(200).json({
        message: "No History Found",
        success: true,
        data: [],
      });
    }

    return res.status(200).json({
      message: "History fetched Successfully",
      success: true,
      data: monthlyHistory,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Monthly History Error",
      success: false,
    });
  }
};

export const getOneTimeTeamRewardsHistory = async (req, res) => {
  try {
    const userId = req.admin._id;
    if (!userId) {
      return res.status(404).json({
        message: "user not found",
        success: false,
      });
    }

    const oneTimeHistory = await OneTimeReward.find({}).populate({
      path: "userId",
      select: "username",
    });

    if (!oneTimeHistory || oneTimeHistory.length === 0) {
      return res.status(200).json({
        message: "No History Found",
        success: true,
        data: [],
      });
    }

    return res.status(200).json({
      message: "History Fetched Successfully",
      success: true,
      data: oneTimeHistory,
    });
  } catch (error) {
    return res.status(500).json({
      message: "One Time Rewards Error",
      success: false,
    });
  }
};

export const adminManualAddMoney = async (req, res) => {
  try {
    const { username, amount } = req.body;
    if (!username || !amount) {
      return res.status(400).json({
        message: "Username or amount is required",
        success: false,
      });
    }

    const user = await UserModel.findOne({ username });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
        success: false,
      });
    }

    if (isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({
        message: "Amount must be a positive number",
        success: false,
      });
    }

    const txhash = await generateRandomTxResponse();

    const investment = await Investment.create({
      userId: user._id,
      investmentAmount: amount,
      investmentDate: Date.now(),
      txResponse: txhash,
      type: "topup By Admin",
    });

    user.investments.push(investment._id);
    user.totalInvestment += Number(amount);
    user.isVerified = true;
    user.status = true;
    user.activeDate = new Date();
    await user.save();

    await AdminTopUp.create({
      userId: user._id,
      amount,
      creditedOn: Date.now(),
    });

    if (user.sponserId) {
      const parentUser = await UserModel.findById(user.sponserId);

      if (parentUser) {
        const referralBonus = amount * 0.05;

        parentUser.directReferalAmount += referralBonus;
        parentUser.totalEarnings += referralBonus;
        parentUser.currentEarnings += referralBonus;
        await parentUser.save();

        await ReferalBonus.create({
          userId: parentUser._id,
          fromUser: user._id,
          amount: referralBonus,
          investmentId: investment._id,
          percent: 5,
          date: new Date(),
        });
      }
    }

    return res.status(200).json({
      message: "User TopUp successfully",
      success: true,
      investment,
    });
  } catch (error) {
    console.error("Error in AdminTopUp:", error);
    return res.status(500).json({
      message: error.message || "Server error",
      success: false,
    });
  }
};

export const toggleWithdrawalAccess = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const user = await UserModel.findOne({ _id: userId });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const updatedUser = await UserModel.findOneAndUpdate(
      { _id: userId },
      { $set: { canWithdraw: !user.canWithdraw } },
      { new: true },
    );

    res.status(200).json({
      success: true,
      message: `Withdrawal ${
        updatedUser.canWithdraw ? "unblocked" : "blocked"
      } successfully`,
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error in toggleWithdrawalAccess:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const toggleUserLogin = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const user = await UserModel.findOne({ _id: userId });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const updatedUser = await UserModel.findOneAndUpdate(
      { _id: userId },
      { $set: { isLoginBlocked: !user.isLoginBlocked } },
      { new: true },
    );

    res.status(200).json({
      success: true,
      message: `User login ${
        updatedUser.isLoginBlocked ? "blocked" : "unblocked"
      } successfully`,
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error in toggleUserLogin:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getSalaryIncomeHistory = async (req, res) => {
  try {
    const adminId = req.admin._id;
    if (!adminId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const userId = req.admin._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const salaryIncomeHistory = await RewardPayout.find({
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

export const addWalletAddress = async (req, res) => {
  try {
    const { walletAddress } = req.body;
    const userId = req.admin._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const user = await Admin.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    user.walletAddress = walletAddress;
    await user.save();
    res.json({ success: true, message: "Wallet address added successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getWalletAddress = async (req, res) => {
  try {
    const userId = req.admin._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const user = await Admin.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    res.json({ success: true, data: user.walletAddress });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const setPrivateKey = async (req, res) => {
  try {
    const { privateKey } = req.body;
    const userId = req.admin._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const user = await Admin.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    user.privateKey = privateKey;
    await user.save();
    res.json({ success: true, message: "Private key added successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getKey = async (req, res) => {
  try {
    const userId = req.admin._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const user = await Admin.findById(userId).lean();
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    res.json({ success: true, data: user.privateKey });
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

export const adminTopupInvestment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  const profileUsersToInvalidate = new Set();

  try {
    const adminId = req.admin?._id;
    if (!adminId) throw new Error("Unauthorized — admin access required");

    const { username } = req.body;
    const amount = Number(req.body.investmentAmount);

    if (!username || !amount)
      throw new Error("username aur investmentAmount dono chahiye");
    if (amount < 25 || amount > 100000)
      throw new Error("Investment must be between $50 and $100,000");

    const user = await UserModel.findOne({ username }).session(session);
    if (!user) throw new Error(`User not found: ${username}`);

    const userId = user._id;

    const [newInvestment] = await Investment.create(
      [
        {
          userId,
          investmentAmount: amount,
          activeInvestment: amount,
          totalRoiEarned: 0,
          status: "active",
          investmentDate: new Date(),
          isAdminTopup: true,
          topupBy: adminId,
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
        },
      },
      { session },
    );
    profileUsersToInvalidate.add(userId.toString());
    console.log(`\n🔗 Referral Income Distribution Started...`);
    let currentUser = user;
    for (const config of referralLevelConfig) {
      if (!currentUser.sponserId) {
        console.log(`⛔ Level ${config.level} → No sponsor found, chain break`);
        break;
      }
      const parentUser = await UserModel.findById(
        currentUser.sponserId,
      ).session(session);
      if (!parentUser) {
        console.log(
          `⛔ Level ${config.level} → Parent user not found, chain break`,
        );
        break;
      }
      const isEligible = parentUser.isVerified;
      if (isEligible) {
        const income = amount * config.percent;
        await UserModel.updateOne(
          { _id: parentUser._id },
          {
            $inc: {
              directReferalAmount: income,
              totalEarnings: income,
              currentEarnings: income,
            },
          },
          { session },
        );
        await ReferalBonus.create(
          [
            {
              userId: parentUser._id,
              fromUser: userId,
              amount: income,
              investmentId: newInvestment._id,
              percent: config.percent * 100,
              type: config.type,
              level: config.level,
              date: new Date(),
            },
          ],
          { session },
        );
        console.log(
          `✅ Level ${config.level} → ${parentUser.email} | +$${income} (${config.percent * 100}%)`,
        );

        profileUsersToInvalidate.add(parentUser._id.toString());
      } else {
        console.log(
          `⚠️  Level ${config.level} → ${parentUser.email} | Skipped (blocked/unverified/no investment)`,
        );
      }
      currentUser = parentUser;
    }
    console.log(`✅ Referral Income Distribution Done`);
    await session.commitTransaction();
    console.log(
      `\n🎉 [ADMIN TOPUP] Successful → admin: ${adminId} | user: ${username} | amount: $${amount}\n`,
    );
    try {
      const deletePromises = [];
      for (const uId of profileUsersToInvalidate) {
        deletePromises.push(redisClient.del(`risenest:cache:${uId}`));
      }
      await Promise.all(deletePromises);
      console.log(
        `🗑️ [Redis Bucket Evicted] Cleared all hash cache for ${deletePromises.length} affected users.`,
      );
    } catch (cacheError) {
      console.error("⚠️ Redis Cache Clearing Failed:", cacheError.message);
    }
    return res.status(201).json({
      success: true,
      message: ` Topup successful for ${username} of $${amount}`,
      investment: newInvestment,
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error(`\n🔥 [ADMIN TOPUP] Failed → ${error.message}\n`);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  } finally {
    session.endSession();
  }
};

export const getUserInfo = async (req, res) => {
  try {
    const username = req.params.username;
    const user = await UserModel.findOne({ username })
      .select("username isVerified totalInvestment")
      .lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res
      .status(200)
      .json({ success: true, message: "User fetched", data: user });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
