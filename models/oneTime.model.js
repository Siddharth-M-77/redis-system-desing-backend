import mongoose from "mongoose";

const oneTimeRewardsSchema = new mongoose.Schema(
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
    milestone: {
      type: Number,
      required: true,
    },
    creditedOn: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

const OneTimeReward = mongoose.model("OneTimeReward", oneTimeRewardsSchema);
export default OneTimeReward;
