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

export const getPowerLegBusiness = (user) => {
  return Math.min(
    Number(user.leftBusiness || 0),
    Number(user.rightBusiness || 0)
  );
};

export const checkAndGiveReward = async (userId, session) => {
  const user = await UserModel.findById(userId).session(session);
  if (!user) return;

  const powerBusiness = getPowerLegBusiness(user);
  let lastLevel = user.lastRewardLevel || 0;

  for (const slab of REWARD_SLABS) {
    if (slab.level > lastLevel && powerBusiness >= slab.business) {
      // 🔒 prevent duplicate reward
      const exists = await RewardHistory.findOne({
        userId,
        level: slab.level,
      }).session(session);

      if (exists) continue;

      // ✅ credit reward
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
          $set: {
            lastRewardLevel: slab.level,
          },
        },
        { session }
      );

      lastLevel = slab.level;
    }
  }
};
