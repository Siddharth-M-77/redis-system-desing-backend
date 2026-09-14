import mongoose from "mongoose";

const monthlyRewardSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserModel",
      required: true,
    },
    amount: {
      type: Number,
      default: 0,
    },
    creditedOn: {
      type: Date,
      default: Date.now,
    },
    level1: {
      type: Number,
      default: 0,
    },
    level2: {
      type: Number,
      default: 0,
    },
    level3: {
      type: Number,
      default: 0,
    },
    rewardTier: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

const MonthlyRewards = mongoose.model("MonthlyRewards", monthlyRewardSchema);
export default MonthlyRewards;
