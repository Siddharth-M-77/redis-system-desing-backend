import mongoose from "mongoose";

const withdrawalSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserModel",
      required: true,
    },
    userWalletAddress: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    netAmountSent: {
      type: Number,
      required: true,
    },
    feeAmount: {
      type: Number,
    },
    feePercent: {
      type: Number,
      default: 15,
    },

    walletType: {
      type: String,
      default: "roiWallet",
    },
    networkType: {
      type: String,
      default: "BEP20",
    },
    transactionHash: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "success", "failed"],
      default: "pending",
      required: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    rejectReason: {
      type: String,
      default: "",
    },
    processedAt: {
      type: Date,
      default: null,
    },
    isDirect: {
      type: Boolean,
      default: false,
    },
    error: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

// Admin panel ke liye useful index
withdrawalSchema.index({ status: 1, createdAt: 1 });
withdrawalSchema.index({ userId: 1, createdAt: -1 });

const Withdrawal = mongoose.model("Withdrawal", withdrawalSchema);

export default Withdrawal;
