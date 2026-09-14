import mongoose from "mongoose";

const investmentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserModel",
      required: true,
    },

    totalRoiEarned: {
      type: Number,
      default: 0,
    },
    referralProcessed: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      default: "active",
    },
    roiCreditedToEarnings: {
      type: Boolean,
      default: false,
    },

    investmentAmount: {
      type: Number,
      required: true,
    },
    investmentDate: {
      type: Date,
      default: Date.now,
    },
    lastTradeDate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

const Investment = mongoose.model("Investment", investmentSchema);

export default Investment;
