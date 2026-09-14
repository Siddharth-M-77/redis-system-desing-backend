import { parseUnits, Wallet, Contract } from "ethers";
import UserModel from "../models/user.model.js";
import Withdrawal from "../models/withdrwal.model.js";
import AdminModel from "../models/admin.model.js";
import { provider, usdtAddress, usdtAbi } from "../walletSetup/walletSetup.js";
import mongoose from "mongoose";

const MIN_WITHDRAWAL = 20;
const FEE_PERCENT = 15;
let cached = null;

export const getServerWallet = async () => {
  if (cached) return cached;

  const admin = await AdminModel.findOne({}).select("+privateKey").lean();

  let pk = admin?.privateKey?.trim();
  if (!pk) {
    throw new Error("Server wallet private key admin model me set nahi hai");
  }

  // 0x prefix nahi hai to laga do
  if (!pk.startsWith("0x")) pk = "0x" + pk;

  // ✅ validate: private key = 0x + 64 hex chars (address 40 chars ka hota hai, wo reject hoga)
  if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    throw new Error(
      `Private key format galat hai (length=${pk.length}). ` +
        `Expected: 0x + 64 hex chars. Lagta hai address ya incomplete key DB me padi hai.`,
    );
  }

  const wallet = new Wallet(pk, provider);
  const usdtContract = new Contract(usdtAddress, usdtAbi, wallet);

  console.log(`🔐 Server wallet loaded: ${wallet.address}`);

  cached = { wallet, usdtContract };
  return cached;
};
export const clearWalletCache = () => {
  cached = null;
};
export const executeWithdrawalOnChain = async (withdrawal) => {
  const user = await UserModel.findById(withdrawal.userId);
  if (!user) {
    console.log(`❌ User not found for withdrawal ID: ${withdrawal._id}`);
    return { success: false, reason: "User not found" };
  }

  const amountWei = parseUnits(withdrawal.netAmountSent.toString(), 18);

  // 🔑 wallet + contract DB private key se
  const { wallet, usdtContract } = await getServerWallet();

  // server ka on-chain balance
  const serverBalance = await usdtContract.balanceOf(wallet.address);

  console.log(`💰 Server balance: ${serverBalance.toString()}`);
  console.log(`💸 Withdrawal amount: ${amountWei.toString()}`);

  if (serverBalance < BigInt(amountWei.toString())) {
    console.log(`⚠️ Insufficient balance for withdrawal ID: ${withdrawal._id}`);

    user.currentEarnings += withdrawal.amount;
    user.totalPayouts -= withdrawal.amount;
    withdrawal.status = "failed";
    withdrawal.transactionHash = "";
    withdrawal.error = "Insufficient server balance";
    await user.save();
    await withdrawal.save();
    console.log(`↩️ Amount reverted to user, marked withdrawal as failed.`);
    return { success: false, reason: "Insufficient server balance" };
  }

  try {
    const tx = await usdtContract.transfer(
      withdrawal.userWalletAddress,
      amountWei,
      { gasLimit: 210000 },
    );
    const receipt = await tx.wait();

    withdrawal.status = receipt.status ? "success" : "failed";
    withdrawal.transactionHash = receipt.hash;
    withdrawal.processedAt = new Date();

    if (!receipt.status) {
      user.currentEarnings += withdrawal.amount;
      user.totalPayouts -= withdrawal.amount;
      console.log(`❌ Transaction failed. Reverting amount to user earnings`);
    } else {
      console.log(`✅ Transaction successful: ${receipt.hash}`);
    }

    await withdrawal.save();
    await user.save();

    return { success: !!receipt.status, txHash: receipt.hash };
  } catch (txError) {
    // Tx bhejne me hi error (gas, network, revert etc.)
    console.error(`❌ Tx error for ${withdrawal._id}:`, txError.message);

    user.currentEarnings += withdrawal.amount;
    user.totalPayouts -= withdrawal.amount;

    withdrawal.status = "failed";
    withdrawal.transactionHash = "";
    withdrawal.error = txError.message;

    await user.save();
    await withdrawal.save();

    return { success: false, reason: txError.message };
  }
};

export const requestWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const amount = Number(req.body.amount);
    const walletType = req.body.walletType || "roiWallet";

    // ✅ Step 1: Amount validation first
    if (!amount || isNaN(amount) || amount <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Valid amount is required" });
    }

    if (amount < MIN_WITHDRAWAL) {
      return res.status(400).json({
        success: false,
        message: `Minimum withdrawal is $${MIN_WITHDRAWAL}`,
      });
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const userWalletAddress = user.walletAddress?.trim();

    if (!userWalletAddress) {
      return res.status(400).json({
        success: false,
        message:
          "Wallet address not found. Please add your BEP20 wallet address in profile first.",
      });
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(userWalletAddress)) {
      return res.status(400).json({
        success: false,
        message: "Invalid wallet address format. Please update your profile.",
      });
    }

    const directUsers = await UserModel.find({ sponserId: userId })
      .select("_id")
      .lean();

    // if (directUsers.length < 2) {
    //   return res.status(400).json({
    //     success: false,
    //     message: `You need at least 2 direct users to withdraw. You currently have ${directUsers.length} direct user(s).`,
    //   });
    // }

    const directUserIds = directUsers.map((u) => u._id);

    // ✅ Step 4: Direct users ka combined totalInvestment check
    const directBusinessResult = await UserModel.aggregate([
      {
        $match: {
          _id: { $in: directUserIds },
        },
      },
      {
        $group: {
          _id: null,
          totalBusiness: { $sum: "$totalInvestment" },
        },
      },
    ]);

    const totalDirectBusiness = directBusinessResult[0]?.totalBusiness ?? 0;
    const requiredBusiness = user.totalInvestment;

    if (totalDirectBusiness < requiredBusiness) {
      return res.status(400).json({
        success: false,
        message: `Total direct business is $${totalDirectBusiness} , minimum $${requiredBusiness} required. $${requiredBusiness - totalDirectBusiness} more required.`,
      });
    }

    // ✅ Step 5: Transaction
    let newWithdrawal = null;

    await session.withTransaction(async () => {
      const updatedUser = await UserModel.findOneAndUpdate(
        {
          _id: userId,
          currentEarnings: { $gte: amount },
          canWithdraw: { $ne: true },
          isLoginBlocked: { $ne: true },
        },
        {
          $inc: {
            currentEarnings: -amount,
            totalPayouts: amount,
          },
        },
        { new: true, session },
      );

      if (!updatedUser) {
        throw new Error("Insufficient balance");
      }

      const feeAmount = Number(((amount * FEE_PERCENT) / 100).toFixed(2));
      const netAmountSent = Number((amount - feeAmount).toFixed(2));

      const [created] = await Withdrawal.create(
        [
          {
            userId,
            userWalletAddress,
            amount,
            feeAmount,
            feePercent: FEE_PERCENT,
            netAmountSent,
            walletType,
            networkType: "BEP20",
            status: "pending",
            createdAt: new Date(),
          },
        ],
        { session },
      );

      newWithdrawal = created;

      await UserModel.updateOne(
        { _id: userId },
        { $inc: { withdrawalCount: 1 } },
        { session },
      );
    });

    console.log(
      `💸 [WITHDRAWAL REQUEST] user: ${userId} | $${amount} → ${userWalletAddress} | pending (admin approval)`,
    );

    try {
      await redisClient.del(`risenest:cache:${userId.toString()}`);
    } catch (cacheError) {
      console.error("⚠️ Redis evict failed:", cacheError.message);
    }

    return res.status(201).json({
      success: true,
      message: `Withdrawal request submitted successfully. Net amount: $${newWithdrawal.netAmountSent}`,
    });
  } catch (error) {
    console.error("❌ Withdrawal Request Error:", error.message);
    return res.status(400).json({
      success: false,
      message: error.message || "Withdrawal request failed",
    });
  } finally {
    session.endSession();
  }
};

export const approveAllWithdrawals = async (req, res) => {
  try {
    const adminId = req.admin?._id;
    if (!adminId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized — admin required" });
    }

    const pendingWithdrawals = await Withdrawal.find({
      status: "pending",
    }).sort({ createdAt: 1 });

    if (!pendingWithdrawals.length) {
      return res.status(200).json({
        success: true,
        message: "No pending withdrawals found",
        summary: { total: 0, success: 0, failed: 0 },
      });
    }

    console.log(
      `👮 [APPROVE ALL] ${adminId} → ${pendingWithdrawals.length} pending withdrawals`,
    );

    const results = [];
    let successCount = 0;
    let failedCount = 0;

    for (const w of pendingWithdrawals) {
      const withdrawal = await Withdrawal.findOneAndUpdate(
        { _id: w._id, status: "pending" },
        {
          $set: {
            status: "approved",
            approvedBy: adminId,
            approvedAt: new Date(),
          },
        },
        { new: true },
      );

      if (!withdrawal) {
        results.push({
          withdrawalId: w._id,
          username: w.username,
          status: "skipped",
          reason: "Already processed",
        });
        continue;
      }

      const result = await executeWithdrawalOnChain(withdrawal);

      if (result.success) {
        successCount++;
        results.push({
          withdrawalId: withdrawal._id,
          amount: withdrawal.amount,
          status: "success",
          txHash: result.txHash,
        });
      } else {
        failedCount++;
        results.push({
          withdrawalId: withdrawal._id,
          amount: withdrawal.amount,
          status: "failed",
          reason: result.reason,
        });

        if (result.reason === "Insufficient server balance") {
          console.log(
            `🛑 Server balance khatam — baaki withdrawals pending hi rahenge`,
          );
          break;
        }
      }
    }
    const processed = successCount + failedCount;
    const remaining =
      pendingWithdrawals.length -
      processed -
      results.filter((r) => r.status === "skipped").length;

    console.log(
      `✅ [APPROVE ALL DONE] success: ${successCount} | failed: ${failedCount} | remaining: ${remaining}`,
    );

    return res.status(200).json({
      success: true,
      message: `${successCount} withdrawals sent, ${failedCount} failed${remaining > 0 ? `, ${remaining} pending (balance issue)` : ""}`,
      summary: {
        total: pendingWithdrawals.length,
        success: successCount,
        failed: failedCount,
        remaining,
      },
      results,
    });
  } catch (error) {
    console.error("❌ Approve All Error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};
export const approveWithdrawal = async (req, res) => {
  try {
    const adminId = req.admin?._id;
    if (!adminId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized — admin required" });
    }
    const withdrawalId = req.params.id;
    const withdrawal = await Withdrawal.findOneAndUpdate(
      { _id: withdrawalId, status: "pending" },
      {
        $set: {
          status: "approved",
          approvedBy: adminId,
          approvedAt: new Date(),
        },
      },
      { new: true },
    );
    if (!withdrawal) {
      return res
        .status(404)
        .json({ success: false, message: "Withdrawal not found" });
    }
    const result = await executeWithdrawalOnChain(withdrawal);
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: "Withdrawal approved successfully",
        txHash: result.txHash,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Withdrawal approval failed",
        reason: result.reason,
      });
    }
  } catch (error) {
    console.error("Approve Withdrawal Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
export const rejectWithdrawal = async (req, res) => {
  try {
    const adminId = req.admin?._id;
    if (!adminId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized — admin required" });
    }
    const withdrawalId = req.params.id;
    const withdrawal = await Withdrawal.findOneAndUpdate(
      { _id: withdrawalId, status: "pending" },
      {
        $set: {
          status: "rejected",
          rejectedBy: adminId,
          rejectedAt: new Date(),
        },
      },
      { new: true },
    );
    if (!withdrawal) {
      return res
        .status(404)
        .json({ success: false, message: "Withdrawal not found" });
    }
    return res.status(200).json({
      success: true,
      message: "Withdrawal rejected successfully",
    });
  } catch (error) {
    console.error("Reject Withdrawal Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
