import MonthlyRewards from "../models/monthlyRewards.js";
import UserModel from "../models/user.model.js";
import { calculateTeams } from "../utils/calculateTeam.js";

export const distributeMontlyRewards = async () => {
  try {
    const users = await UserModel.find({});

    const currentMonth = new Date().getMonth();

    for (const user of users) {
      const lastRewardDate = user.lastRewardDate;
      const lastRewardMonth = new Date(lastRewardDate).getMonth();

      if (lastRewardMonth === currentMonth) {
        // console.log(
        //   `User: ${user.username} already received a reward this month. Skipping...`
        // );
        continue;
      }

      const { teamA, teamB, teamC } = await calculateTeams(user._id);
      // console.log(
      //   `Team A: ${JSON.stringify(teamA)}, Team B: ${JSON.stringify(
      //     teamB
      //   )}, Team C: ${JSON.stringify(teamC)}`
      // );

      const level1 = teamA.count;
      const level2 = teamB.count;
      const level3 = teamC.count;

      // console.log(
      //   `User: ${user.username} | L1: ${level1}, L2: ${level2}, L3: ${level3}`
      // );

      let reward = 0;
      let rewardTier = "";

      if (level1 >= 15 && level2 >= 40 && level3 >= 300) {
        reward = 600;
        rewardTier = "L1:15, L2:40, L3:300";
      } else if (level1 >= 5 && level2 >= 10 && level3 >= 110) {
        reward = 300;
        rewardTier = "L1:5, L2:10, L3:110";
      }

      if (reward > 0) {
        await UserModel.findByIdAndUpdate(user._id, {
          monthlyRewards: reward,
          $inc: {
            totalMonthlyRewards: reward,
            currentEarnings: reward,
            totalEarnings: reward,
          },
          lastRewardDate: Date.now(),
        });

        await MonthlyRewards.create({
          userId: user._id,
          amount: reward,
          creditedOn: Date.now(),
          level1,
          level2,
          level3,
          rewardTier,
        });

        // console.log(`✅ ${user.username} rewarded: $${reward}`);
      }
    }
    // console.log("🎉 Monthly rewards distribution completed.");
  } catch (error) {
    console.error("❌ Error distributing monthly rewards:", error.message);
  }
};
