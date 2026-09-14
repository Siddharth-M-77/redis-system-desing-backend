import mongoose from "mongoose";
import UserModel from "../models/user.model.js";
import RewardHistory from "../models/rewardHistory.model.js";

export const REWARD_SLABS = [
  { level: 1, business: 10000, reward: 250 },
  { level: 2, business: 25000, reward: 500 },
  { level: 3, business: 55000, reward: 1100 },
  { level: 4, business: 110000, reward: 11000 },
  { level: 5, business: 500000, reward: 21000 },
  { level: 6, business: 1100000, reward: 51000 },
];

const getPowerLegBusiness = (user) => {
  return Math.min(
    Number(user.leftBusiness || 0),
    Number(user.rightBusiness || 0)
  );
};

export const runRewardCron = async () => {
  console.log("🏆 Reward Cron Started");
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log("🏆 Reward Cron Started");

    // 🔥 Only users jinke dono legs me business hai
    const users = await UserModel.find({
      leftBusiness: { $gt: 0 },
      rightBusiness: { $gt: 0 },
    }).session(session);

    console.log(`👥 Users to check: ${users.length}`);

    for (const user of users) {
      const powerBusiness = getPowerLegBusiness(user);
      let lastRewardLevel = user.lastRewardLevel || 0;

      for (const slab of REWARD_SLABS) {
        if (slab.level > lastRewardLevel && powerBusiness >= slab.business) {
          // 🔒 Double reward safety
          const exists = await RewardHistory.findOne({
            userId: user._id,
            level: slab.level,
          }).session(session);

          if (exists) continue;

          // ✅ Credit reward
          await RewardHistory.create(
            [
              {
                userId: user._id,
                level: slab.level,
                business: slab.business,
                reward: slab.reward,
              },
            ],
            { session }
          );

          await UserModel.updateOne(
            { _id: user._id },
            {
              $inc: {
                rewardIncome: slab.reward,
                totalEarnings: slab.reward,
                currentEarnings: slab.reward,
              },
              $set: { lastRewardLevel: slab.level },
            },
            { session }
          );

          console.log(
            `✅ Reward given → User:${user.username} | Level:${slab.level}`
          );

          lastRewardLevel = slab.level;
        }
      }
    }

    await session.commitTransaction();
    console.log("🏁 Reward Cron Finished");
  } catch (err) {
    await session.abortTransaction();
    console.error("❌ Reward Cron Error:", err.message);
  } finally {
    session.endSession();
  }
};
