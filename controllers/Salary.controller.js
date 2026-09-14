import mongoose from "mongoose";
import UserModel from "../models/user.model.js";
import SalaryRank from "../models/salary.model.js";
import RewardPayout from "../models/rewardPayout.model.js";

const WALLET_FIELD = "currentEarnings";

const REWARD_MONTHS = 4;

const SALARY_RANKS = [
  {
    rank: 1,
    name: "Rank 1",
    directRequired: 5,
    teamSizeRequired: 15,
    businessRequired: 5000,
    withinDays: 7,
    salary: 0,
    reward: 40,
  },
  {
    rank: 2,
    name: "Rank 2",
    directRequired: 10,
    teamSizeRequired: 30,
    businessRequired: 60000,
    withinDays: 10,
    salary: 0,
    reward: 75,
  },
  {
    rank: 3,
    name: "Rank 3",
    directRequired: 10,
    teamSizeRequired: 75,
    businessRequired: 30000,
    withinDays: 21,
    salary: 0,
    reward: 150,
  },
  {
    rank: 4,
    name: "Rank 4",
    directRequired: 25,
    teamSizeRequired: 125,
    businessRequired: 0,
    withinDays: 30,
    salary: 0,
    reward: 300,
  },
];

const RANKS_DESC = [...SALARY_RANKS].sort((a, b) => b.rank - a.rank);
const MAX_RANK = Math.max(...SALARY_RANKS.map((r) => r.rank));
const MAX_WITHIN_DAYS = Math.max(...SALARY_RANKS.map((r) => r.withinDays));

// ───────────────────────────────────────────────
// HELPERS
// ───────────────────────────────────────────────

const addMonths = (date, months) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

const getDownlineUsers = async (userId) => {
  const visited = new Set();
  const result = [];

  const dfs = async (id) => {
    const user = await UserModel.findById(id).select(
      "referedUsers totalInvestment", // 👈 referedUsers (DB jaisa)
    );

    if (!user?.referedUsers?.length) return; // 👈

    for (const childId of user.referedUsers) {
      // 👈
      const uid = childId.toString();
      if (visited.has(uid)) continue;
      visited.add(uid);
      result.push(await UserModel.findById(uid).select("_id totalInvestment"));
      await dfs(uid);
    }
  };

  await dfs(userId);
  return result;
};

const getUserStats = async (userId) => {
  const _id = new mongoose.Types.ObjectId(userId);

  const directCount = await UserModel.countDocuments({ sponserId: _id });

  const team = await getDownlineUsers(_id);
  const teamSize = team.length;

  const business = team.reduce((sum, u) => sum + (u.totalInvestment || 0), 0);

  return {
    direct: directCount,
    teamSize,
    business: Number(business.toFixed(2)),
  };
};

// ───────────────────────────────────────────────
// SINGLE USER PROCESS — eligible hua toh 4 reward history insert
// (no req/res — internal, cron se call hota hai)
// ───────────────────────────────────────────────

export const processSalaryForUser = async (userId) => {
  if (!mongoose.isValidObjectId(userId)) return null;

  const user = await UserModel.findById(userId)
    .select("username createdAt salaryRank")
    .lean();
  if (!user) return null;

  const currentRank = user.salaryRank || 0;
  const stats = await getUserStats(userId);

  const daysTaken = Math.floor(
    (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24),
  );

  const qualified = RANKS_DESC.find(
    (r) =>
      r.rank > currentRank &&
      stats.direct >= r.directRequired &&
      stats.teamSize >= r.teamSizeRequired &&
      stats.business >= r.businessRequired &&
      daysTaken <= r.withinDays,
  );

  if (!qualified) return null;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const achievedAt = new Date();

      if (qualified.reward > 0) {
        const payouts = [];
        for (let i = 0; i < REWARD_MONTHS; i++) {
          payouts.push({
            userId,
            rank: qualified.rank,
            rankName: qualified.name,
            monthIndex: i + 1,
            amount: qualified.reward,
            dueDate: addMonths(achievedAt, i),
            status: "pending",
          });
        }

        console.log("DEBUG payouts:", JSON.stringify(payouts, null, 2));

        await RewardPayout.create(payouts, { session, ordered: true });
      }

      await UserModel.updateOne(
        { _id: userId },
        {
          $set: {
            salaryRank: qualified.rank,
            monthlySalary: qualified.salary,
            currentReward: qualified.reward,
          },
        },
        { session },
      );
    });

    return qualified;
  } catch (err) {
    if (err.code !== 11000) {
      console.error("Salary Error:", userId?.toString?.(), err);
    }
    return null;
  } finally {
    await session.endSession();
  }
};

// ───────────────────────────────────────────────
// MAIN CRON — sab eligible users check + history create
// (koi response nahi, sirf log)
// ───────────────────────────────────────────────

export const runSalaryRankCron = async () => {
  const cutoff = new Date(Date.now() - MAX_WITHIN_DAYS * 24 * 60 * 60 * 1000);
  const candidates = await UserModel.find({
    createdAt: { $gte: cutoff },
    salaryRank: { $not: { $gte: MAX_RANK } },
  })
    .select("_id")
    .lean();
  let achieved = 0;
  for (const u of candidates) {
    try {
      const result = await processSalaryForUser(u._id);
      if (result) achieved += 1;
    } catch (err) {
      console.error("Salary cron error:", u._id?.toString(), err);
    }
  }

  console.log(
    `[salary-cron] checked=${candidates.length} achieved=${achieved}`,
  );
  return { checked: candidates.length, achieved };
};

// ───────────────────────────────────────────────
// DISTRIBUTION CRON — alag cron me wire karna (tu handle karega)
// due + pending reward credit karta hai, double-pay safe
// ───────────────────────────────────────────────

export const settleDueRewards = async () => {
  const now = new Date();

  const dueList = await RewardPayout.find({
    status: "pending",
    dueDate: { $lte: now },
  })
    .select("_id userId amount")
    .lean();

  let settled = 0;

  for (const p of dueList) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // atomic claim: pending -> paid; tabhi credit. double-pay impossible.
        const claim = await RewardPayout.updateOne(
          { _id: p._id, status: "pending" },
          { $set: { status: "paid", paidAt: now } },
          { session },
        );

        if (claim.modifiedCount === 0) return; // koi aur cron utha le gaya

        await UserModel.updateOne(
          { _id: p.userId },
          {
            $inc: { [WALLET_FIELD]: p.amount },
            $inc: { totalEarnings: p.amount },
            totalSalary: p.amount,
          },
          { session },
        );

        settled += 1;
      });
    } catch (err) {
      console.error("Reward settle error:", p._id?.toString(), err);
    } finally {
      await session.endSession();
    }
  }

  console.log(`[reward-cron] processed=${dueList.length} settled=${settled}`);
  return { processed: dueList.length, settled };
};
