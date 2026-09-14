import mongoose from "mongoose";

const salaryRankSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rank: { type: Number, required: true },
    rankName: { type: String },
    directAtAchievement: { type: Number, default: 0 },
    teamSizeAtAchievement: { type: Number, default: 0 },
    businessAtAchievement: { type: Number, default: 0 },
    daysTaken: { type: Number, default: 0 },
    salary: { type: Number, default: 0 },
    reward: { type: Number, default: 0 },
    achievedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// ek user ek rank sirf ek baar achieve kare
salaryRankSchema.index({ userId: 1, rank: 1 }, { unique: true });

const SalaryRank =
  mongoose.models.SalaryRank || mongoose.model("SalaryRank", salaryRankSchema);

export default SalaryRank;
