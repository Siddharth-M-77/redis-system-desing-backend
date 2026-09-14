import mongoose from "mongoose";

const adminTopUpSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      default: 0,
    },
    creditedOn: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export const AdminTopUp = mongoose.model("AdminTopUp", adminTopUpSchema);
