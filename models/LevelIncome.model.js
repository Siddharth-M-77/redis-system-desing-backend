import mongoose from "mongoose";

const levelIncomeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "UserModel" },
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: "UserModel" },
    fromUserName: { type: String },
    toUserName: { type: String },
    investmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Investment" },
    investmentAmount: { type: Number, default: 0 },
    amount: { type: Number },
    roi: { type: Number },
    percent: { type: Number },
    level: { type: Number },
    dayCount: { type: Number },
    creditedAt: { type: Date },

    // 👇 NEW — claim tracking
    claimed: {
      type: Boolean,
      default: false,
      index: true,
    },
    claimedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

// 👇 NEW — claimable query fast karne ke liye
levelIncomeSchema.index({ userId: 1, claimed: 1 });

const LevelIncome = mongoose.model("LevelIncome", levelIncomeSchema);
export default LevelIncome;
