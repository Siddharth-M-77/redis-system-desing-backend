import mongoose from "mongoose";

const aroiSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserModel",
      required: true,
      index: true,
    },

    investmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Investment",
      required: true,
      index: true,
    },

    roiPercent: {
      type: Number,
      required: true,
    },
    investmentAmount: {
      type: Number,
      required: true,
    },

    roiAmount: {
      type: Number,
      required: true,
    },

    percentage: {
      type: Number,
      default: 0,
    },

    creditedOn: {
      type: Date,
      required: true,
      index: true,
    },

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

aroiSchema.index({ userId: 1, creditedOn: 1 });

aroiSchema.index({ investmentId: 1, creditedOn: -1 });

aroiSchema.index({ userId: 1, claimed: 1 });

const Aroi = mongoose.model("Aroi", aroiSchema);
export default Aroi;
