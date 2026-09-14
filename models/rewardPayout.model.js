import mongoose from "mongoose";

const rewardPayoutSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserModel",
      required: true,
    },
    rank: { type: Number, required: true },
    rankName: { type: String },
    monthIndex: { type: Number, required: true }, // 1..4
    amount: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: ["pending", "paid"], default: "pending" },
    paidAt: { type: Date },
  },
  { timestamps: true },
);

// ek hi installment dubara insert ya settle na ho — ye guard zaruri hai
rewardPayoutSchema.index(
  { userId: 1, rank: 1, monthIndex: 1 },
  { unique: true },
);

const RewardPayout =
  mongoose.models.RewardPayout ||
  mongoose.model("RewardPayout", rewardPayoutSchema);
export default RewardPayout;
