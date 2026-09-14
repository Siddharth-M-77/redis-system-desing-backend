import mongoose from "mongoose";

const salaryEarningSchema = new mongoose.Schema(
  {
    userId: mongoose.Schema.Types.ObjectId,

    rank: Number,
    rankName: String,

    totalSalary: Number,

    monthlyInstallment: Number,

    totalMonths: Number,

    paidMonths: {
      type: Number,
      default: 0,
    },

    remainingMonths: Number,

    status: {
      type: String,
      enum: ["active", "completed"],
      default: "active",
    },
  },
  { timestamps: true },
);

const SalaryEarning = mongoose.model("SalaryEarning", salaryEarningSchema);

export default SalaryEarning;
