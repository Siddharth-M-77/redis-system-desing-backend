import {
  JsonRpcProvider,
  Wallet,
  Contract,
  isAddress,
  parseUnits,
} from "ethers";
import dotenv from "dotenv";
import Settings from "../models/settings.model.js";
import UserModel from "../models/user.model.js";

import Withdrawal from "../models/withdrwal.model.js";
dotenv.config();
const provider = new JsonRpcProvider("https://bsc-dataseed.binance.org/");
const wallet = new Wallet(process.env.PRIVATE_KEY, provider);

const usdtAddress = "0x55d398326f99059fF775485246999027B3197955";
const usdtABI = [
  "function transfer(address to, uint256 amount) public returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
];
const usdtContract = new Contract(usdtAddress, usdtABI, wallet);

export const processWithdrawal = async (req, res) => {
  const userId = req.user._id;

  try {
    // ❌ Block withdrawal on Saturday (6) and Sunday (0)
    const today = new Date().getDay();
    if (today === 0 || today === 6) {
      return res.status(403).json({
        success: false,
        message: "Withdrawals are not allowed on Saturday and Sunday.",
      });
    }

    // ✅ Find user
    const user = await UserModel.findById(userId);
    if (!user)
      return res
        .status(404)
        .json({ message: "User not found", success: false });

    // ❌ Block if user is restricted from withdrawal
    if (user.canWithdraw) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to withdraw at this time.",
      });
    }

    const { userWalletAddress, amount } = req.body;

    // ❌ Validate request body
    if (!userWalletAddress || !amount)
      return res
        .status(400)
        .json({ error: "Missing wallet address or amount" });
    if (!isAddress(userWalletAddress))
      return res.status(400).json({ error: "Invalid wallet address" });
    if (isNaN(amount) || Number(amount) <= 0)
      return res.status(400).json({ error: "Invalid amount" });

    const gross = Number(amount);

    // ✅ Get today's date range
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    // ✅ Check how many times user withdrew today
    const todayWithdrawals = await Withdrawal.find({
      userId,
      createdAt: { $gte: start, $lte: end },
    });

    // ❌ Limit to 3 withdrawals per day
    if (todayWithdrawals.length >= 3) {
      return res.status(400).json({
        message: "You can only withdraw 3 times per day.",
        success: false,
      });
    }

    // ❌ Limit to ₹600 total per day
    const totalWithdrawnToday = todayWithdrawals.reduce(
      (total, tx) => total + tx.amount,
      0,
    );

    if (totalWithdrawnToday + gross > 600) {
      return res.status(400).json({
        message: `Daily withdrawal limit ₹600 exceeded. You can withdraw ₹${600 - totalWithdrawnToday} more today.`,
        success: false,
      });
    }

    // ✅ Apply fee and check earnings
    const feePct = 10;
    const feeAmount = (gross * feePct) / 100;
    const netAmount = gross - feeAmount;

    if (user.currentEarnings < gross) {
      return res.status(400).json({
        message: "Insufficient earnings",
        success: false,
      });
    }

    // ✅ Convert amount to USDT format
    const decimals = await usdtContract.decimals();
    const amountWei = parseUnits(netAmount.toString(), decimals);

    // ✅ Check if server wallet has enough USDT
    const serverBalance = await usdtContract.balanceOf(wallet.address);
    if (serverBalance < amountWei) {
      return res.status(400).json({
        success: false,
        message:
          "Transaction could not be processed at the moment. Please try again later.",
      });
    }

    // ✅ Transfer to user's wallet
    const tx = await usdtContract.transfer(userWalletAddress, amountWei, {
      gasLimit: 210000,
    });
    const receipt = await tx.wait();
    const txStatus = receipt.status ? "success" : "failed";

    // ✅ Save withdrawal record
    await Withdrawal.create({
      userId,
      userWalletAddress,
      amount: gross,
      feeAmount,
      netAmountSent: netAmount,
      transactionHash: receipt.hash,
      status: txStatus,
    });

    // ✅ Update user stats if successful
    if (txStatus === "success") {
      user.currentEarnings -= gross;
      user.totalPayouts += gross;
      await user.save();
    }

    return res.status(200).json({
      message: `Withdrawal ${txStatus}`,
      transactionHash: receipt.hash,
      success: txStatus === "success",
    });
  } catch (err) {
    console.error("Withdrawal error:", err);
    return res.status(500).json({ error: err.message, success: false });
  }
};

// export const processWithdrawal = async (req, res) => {
//   const userId = req.user._id;

//   try {
//     const user = await UserModel.findById(userId);
//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found.",
//       });
//     }

//     const { userWalletAddress, amount } = req.body;

//     if (!userWalletAddress || !amount) {
//       return res.status(400).json({
//         success: false,
//         message: "All fields are required.",
//       });
//     }

//     if (!isAddress(userWalletAddress)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid wallet address.",
//       });
//     }

//     const numericAmount = Number(amount);

//     if (!Number.isFinite(numericAmount) || numericAmount < 10) {
//       return res.status(400).json({
//         success: false,
//         message: "Minimum withdrawal amount is $10.",
//       });
//     }

//     if (user.currentEarnings < numericAmount) {
//       return res.status(400).json({
//         success: false,
//         message: "Insufficient wallet balance.",
//       });
//     }

//     // 🔒 OPTIONAL: prevent multiple pending withdrawals
//     const pendingExists = await Withdrawal.findOne({
//       userId,
//       status: "pending",
//     });

//     if (pendingExists) {
//       return res.status(403).json({
//         success: false,
//         message: "You already have a pending withdrawal.",
//       });
//     }

//     // 💸 Fee calculation
//     const fee = Number(((numericAmount * 10) / 100).toFixed(2));
//     const netAmount = Number((numericAmount - fee).toFixed(2));

//     // 🧮 Update user wallet
//     user.currentEarnings -= numericAmount;
//     user.totalPayouts = (user.totalPayouts || 0) + numericAmount;
//     await user.save();

//     // 📦 Create withdrawal request
//     await Withdrawal.create({
//       userId,
//       userWalletAddress,
//       amount: numericAmount,
//       feeAmount: fee,
//       netAmountSent: netAmount,
//       status: "pending",
//       transactionHash: "",
//     });

//     return res.status(200).json({
//       success: true,
//       message: `Withdrawal request submitted successfully. Net amount: $${netAmount}`,
//     });
//   } catch (error) {
//     console.error("Withdrawal Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error during withdrawal.",
//     });
//   }
// };

// export const approveWithdrawal = async (req, res) => {
//   const { withdrawalId } = req.body;
//   if (!withdrawalId) {
//     return res.status(400).json({
//       message: "withdrawal ID is required",
//       success: false,
//     });
//   }

//   try {
//     const withdrawal = await Withdrawal.findById(withdrawalId);
//     if (!withdrawal) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Withdrawal not found" });
//     }

//     if (withdrawal.status !== "pending") {
//       return res
//         .status(400)
//         .json({ success: false, message: "Withdrawal is not pending" });
//     }

//     withdrawal.status = "approved";
//     withdrawal.approvedDate = new Date();
//     await withdrawal.save();

//     return res
//       .status(200)
//       .json({ success: true, message: "Withdrawal approved successfully" });
//   } catch (error) {
//     console.error("Approve Withdrawal Error:", error);
//     return res
//       .status(500)
//       .json({ success: false, message: "Internal server error" });
//   }
// };
// export const rejectWithdrawal = async (req, res) => {
//   const { withdrawalId } = req.body;

//   try {
//     const withdrawal = await Withdrawal.findById(withdrawalId);
//     if (!withdrawal) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Withdrawal not found" });
//     }

//     if (withdrawal.status !== "pending") {
//       return res
//         .status(400)
//         .json({ success: false, message: "Withdrawal is not pending" });
//     }

//     const user = await UserModel.findById(withdrawal.userId);
//     if (!user) {
//       return res
//         .status(404)
//         .json({ success: false, message: "User not found" });
//     }

//     const amount = withdrawal.amount;

//     user.currentEarnings += amount;
//     user.totalPayouts -= amount;
//     if (user.totalPayouts < 0) user.totalPayouts = 0;

//     await user.save();

//     withdrawal.status = "rejected";
//     withdrawal.transactionHash = "";
//     withdrawal.approvedDate = new Date();
//     await withdrawal.save();

//     return res.status(200).json({
//       success: true,
//       message: "Withdrawal rejected and balance reverted",
//     });
//   } catch (error) {
//     console.error("Reject Withdrawal Error:", error);
//     return res
//       .status(500)
//       .json({ success: false, message: "Internal server error" });
//   }
// };
