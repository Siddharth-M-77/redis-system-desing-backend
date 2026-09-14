import mongoose from "mongoose";

const rewardHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserModel",
      required: true,
      index: true,
    },
    level: {
      type: Number,
      required: true,
    },
    business: {
      type: Number,
      required: true,
    },
    reward: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

// 🔒 one reward per level
rewardHistorySchema.index({ userId: 1, level: 1 }, { unique: true });

const RewardHistory = mongoose.model("RewardHistory", rewardHistorySchema);

export default RewardHistory;
