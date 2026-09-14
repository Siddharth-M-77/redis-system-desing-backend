import { Worker } from "bullmq";
import mongoose from "mongoose";
import UserModel from "../models/user.model.js";
import Investment from "../models/investment.model.js";
import ReferalBonus from "../models/referalbonus.model.js";
import redisClient from "../config/redis.js";
import { bullConnection } from "../config/queueConnection.js";
import { QUEUE_NAMES } from "../messageQueue/queueNames.js";

const referralLevelConfig = [
  { level: 1, percent: 0.05, type: "REFERRAL_LEVEL_1" },
  { level: 2, percent: 0.02, type: "REFERRAL_LEVEL_2" },
  { level: 3, percent: 0.01, type: "REFERRAL_LEVEL_3" },
  { level: 4, percent: 0.01, type: "REFERRAL_LEVEL_4" },
  { level: 5, percent: 0.01, type: "REFERRAL_LEVEL_5" },
];

const worker = new Worker(
  QUEUE_NAMES.REFERRAL_DISTRIBUTION,
  async (job) => {
    const { userId, amount, investmentId } = job.data;

    const session = await mongoose.startSession();
    session.startTransaction();

    const profileUsersToInvalidate = new Set([userId]);

    try {
      const investment = await Investment.findOneAndUpdate(
        { _id: investmentId, referralProcessed: { $ne: true } },
        { $set: { referralProcessed: true } },
        { session, new: false },
      );

      if (!investment) {
        console.log(
          `⏭️ [Worker] Investment ${investmentId} not found OR already processed — skip kiya`,
        );
        await session.abortTransaction();
        return;
      }

      let currentUser = await UserModel.findById(userId).session(session);

      for (const config of referralLevelConfig) {
        if (!currentUser.sponserId) break;

        const parentUser = await UserModel.findById(
          currentUser.sponserId,
        ).session(session);
        if (!parentUser) break;

        if (parentUser.isVerified) {
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
                investmentId,
                percent: config.percent * 100,
                type: config.type,
                level: config.level,
                date: new Date(),
              },
            ],
            { session },
          );

          profileUsersToInvalidate.add(parentUser._id.toString());
        }
        currentUser = parentUser;
      }

      await session.commitTransaction();

      const deletePromises = [...profileUsersToInvalidate].map((uId) =>
        redisClient.del(`risenest:cache:${uId}`),
      );
      await Promise.all(deletePromises);
      console.log(
        `✅ [Worker] Referral distribution done for investment ${investmentId}`,
      );
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      console.error(`🔥 [Worker] Referral distribution failed:`, error.message);
      throw error;
    } finally {
      session.endSession();
    }
  },
  {
    connection: bullConnection,
    concurrency: 5,
  },
);

worker.on("completed", (job) => console.log(`🎉 Job ${job.id} completed`));
worker.on("failed", (job, err) =>
  console.error(`❌ Job ${job.id} failed:`, err.message),
);

export default worker;
