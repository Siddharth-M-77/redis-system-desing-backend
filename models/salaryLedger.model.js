import mongoose from "mongoose";

const salaryLedgerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    rank: Number,
    rankName: String,

    totalSalary: {
      type: Number,
      default: 0,
    },

    paidSalary: {
      type: Number,
      default: 0,
    },

    pendingSalary: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["active", "paused", "completed"],
      default: "active",
    },

    payoutCount: {
      type: Number,
      default: 0,
    },

    maxPayoutAllowed: {
      type: Number,
      default: 1,
    },
  },
  { timestamps: true },
);

const SalaryLedger = mongoose.model("SalaryLedger", salaryLedgerSchema);

export default SalaryLedger;
