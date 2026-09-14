import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    referralCode: {
      type: String,
      required: true,
      unique: true,
    },
    monthlyRewards: {
      type: Number,
      default: 0,
    },
    referralIncome: { type: Number, default: 0 },
    currentPackage: { type: String },
    leftBusiness: { type: Number, default: 0 },
    rightBusiness: { type: Number, default: 0 },
    totalBusiness: { type: Number, default: 0 },
    isLoginBlocked: {
      type: Boolean,
      default: false,
    },
    pendingRoi: {
      type: Number,
      default: 0,
    },
    currentPlan25: {
      type: Number,
      default: 0,
    },
    currentPlan50: {
      type: Number,
      default: 0,
    },
    currentPlan100: {
      type: Number,
      default: 0,
    },
    currentPlan300: {
      type: Number,
      default: 0,
    },
    currentPlan500: {
      type: Number,
      default: 0,
    },

    totalMonthlyRewards: {
      type: Number,
      default: 0,
    },
    lastRewardMilestone: {
      type: Number,
      default: 0,
    },
    rank: {
      type: String,
      default: "",
    },
    salaryRank: {
      type: Number,
      default: 0,
    },
    monthlySalary: {
      type: Number,
      default: 0,
    },
    currentReward: {
      type: Number,
      default: 0,
    },
    totalSalary: {
      type: Number,
      default: 0,
    },

    teamRewards: {
      type: Number,
      default: 0,
    },
    totalTeamRewards: {
      type: Number,
      default: 0,
    },
    teamRewardsget: {
      type: Boolean,
      default: false,
    },
    lastRewardDate: {
      type: Date,
      default: null,
    },
    sponserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserModel",
      default: null,
    },
    username: {
      type: String,
      unique: true,
    },
    parentReferedCode: {
      type: String,
      default: null,
    },
    left: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserModel",
      default: null,
    },
    right: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserModel",
      default: null,
    },
    position: { type: String, default: null },
    referedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "UserModel" }],
    totalEarnings: { type: Number, default: 0 },
    currentEarnings: { type: Number, default: 0 },
    walletAddress: { type: String, required: true },
    isVerified: { type: Boolean, default: false },
    role: { type: String, enum: ["user", "admin", "subadmin"] },
    status: { type: Boolean, default: false },
    activeDate: { type: Date, default: null },
    canWithdraw: {
      type: Boolean,
      default: false,
    },
    totalPayouts: {
      type: Number,
      default: 0,
    },
    investments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Investment" }],
    totalInvestment: {
      type: Number,
      default: 0,
    },
    dailyRoi: {
      type: Number,
      default: 0,
    },
    totalRoi: {
      type: Number,
      default: 0,
    },
    levelIncome: {
      type: Number,
      default: 0,
    },
    directReferalAmount: {
      type: Number,
      default: 0,
    },
    withdrawalCount: {
      type: Number,
      default: 0,
    },
    lastWithdrawalDate: {
      type: Date,
    },
  },

  { timestamps: true },
);

userSchema.index({ walletAddress: 1 }, { unique: true });
userSchema.index({ sponserId: 1 });

const UserModel = mongoose.model("UserModel", userSchema);
export default UserModel;
