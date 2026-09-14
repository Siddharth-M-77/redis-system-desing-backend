import mongoose from "mongoose";
import OneTimeReward from "../models/oneTime.model.js";
import UserModel from "../models/user.model.js";

const BATCH_SIZE = 200;

const getMilestone = (teamSize) => {
  if (teamSize >= 10000) return 6000;
  if (teamSize >= 3500) return 1700;
  if (teamSize >= 1100) return 600;
  if (teamSize >= 500) return 400;
  if (teamSize >= 101) return 200;
  if (teamSize >= 51) return 120;
  if (teamSize >= 21) return 70;
  return 0;
};

const getReward = (milestone) => {
  const rewards = {
    70: 70,
    51: 120,
    101: 200,
    500: 400,
    1100: 600,
    3500: 1700,
    10000: 600,
  };
  return rewards[milestone] || 0;
};

export const distributeOneTimeIncome = async () => {
  try {
    const cursor = UserModel.find({}).cursor();

    let batch = [];
    let processed = 0;

    for await (const user of cursor) {
      batch.push(user);

      if (batch.length >= BATCH_SIZE) {
        await processBatch(batch);
        processed += batch.length;
        // console.log(`✅ Processed ${processed} users`);
        batch = [];
      }
    }

    if (batch.length > 0) {
      await processBatch(batch);
      processed += batch.length;
      // console.log(`✅ Processed remaining ${batch.length} users`);
    }

    // console.log("🎉 One-Time rewards distribution completed.");
  } catch (error) {
    console.error("❌ Error distributing one-time rewards:", error.message);
  }
};

const processBatch = async (users) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const userOps = [];
    const rewardOps = [];

    for (const user of users) {
      const teamSize = user.referedUsers?.length || 0;
      console.log(teamSize, "teamSize");
      // console.log(teamSize, "teamSize");
      const currentMilestone = getMilestone(teamSize);
      const lastMilestone = user.lastRewardMilestone || 0;

      // console.log(
      //   `➡️ User: ${
      //     user.name || user._id
      //   } | Team: ${teamSize} | Last: ${lastMilestone} | Current: ${currentMilestone}`
      // );

      if (currentMilestone > lastMilestone) {
        const reward = getReward(currentMilestone);
        // console.log(
        //   `💰 Eligible for reward: ${reward} at milestone ${currentMilestone}`
        // );

        userOps.push({
          updateOne: {
            filter: { _id: user._id },
            update: {
              $set: {
                lastRewardMilestone: currentMilestone,
                teamRewards: reward,
              },
              $inc: {
                currentEarnings: reward,
                totalEarnings: reward,
                totalTeamRewards: reward,
              },
            },
          },
        });

        rewardOps.push({
          insertOne: {
            document: {
              userId: user._id,
              amount: reward,
              milestone: currentMilestone,
              date: new Date(),
              month: new Date().getMonth() + 1,
              year: new Date().getFullYear(),
            },
          },
        });
      } else {
        console.log(`❌ Not eligible for any new milestone.`);
      }
    }

    if (userOps.length > 0) {
      await UserModel.bulkWrite(userOps, { session });
      // console.log(`✅ Updated ${userOps.length} user documents`);
    } else {
      // console.log(`⚠️ No user updates required`);
    }

    if (rewardOps.length > 0) {
      await OneTimeReward.bulkWrite(rewardOps, { session });
      // console.log(`✅ Inserted ${rewardOps.length} reward records`);
    } else {
      // console.log(`⚠️ No reward records inserted`);
    }

    await session.commitTransaction();
    // console.log(`✅ Transaction committed successfully`);
  } catch (error) {
    console.error("❌ Error processing batch:", error.message);
    await session.abortTransaction();
    console.error("⚠️ Transaction aborted");
  } finally {
    session.endSession();
    // console.log("🔚 Session ended");
  }
};
