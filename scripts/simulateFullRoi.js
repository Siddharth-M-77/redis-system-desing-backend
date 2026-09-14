import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({});
import UserModel from "../models/user.model.js";
import Investment from "../models/investment.model.js";
import Aroi from "../models/roi.model.js";
import { processUserRoi } from "../utils/distributeDailyROI.js";

const MAX_DAYS = 35;

const main = async () => {
  const input = "6a2a53f6cf799772dc74b7bc";

  if (!input) {
    console.log(
      "❌ Usage: node scripts/simulateFullRoi.js <userId ya username>",
    );
    process.exit(1);
  }

  await mongoose.connect(
    "mongodb+srv://bhaisiddharth63:9696607477@cluster0.um4bii2.mongodb.net/NEXO",
  );
  console.log("✅ MongoDB connected\n");

  const user = mongoose.isValidObjectId(input)
    ? await UserModel.findById(input)
        .select("username sponserId currentEarnings pendingRoi totalRoi")
        .lean()
    : await UserModel.findOne({ username: input })
        .select("username sponserId currentEarnings pendingRoi totalRoi")
        .lean();

  if (!user) {
    console.log("❌ User nahi mila:", input);
    process.exit(1);
  }

  console.log("👤 User:", user.username || user._id.toString());
  console.log(
    "📊 BEFORE → currentEarnings:",
    user.currentEarnings || 0,
    "| pendingRoi:",
    user.pendingRoi || 0,
    "| totalRoi:",
    user.totalRoi || 0,
  );

  const investments = await Investment.find({
    userId: user._id,
    status: "active",
  }).lean();

  if (!investments.length) {
    console.log("\n⚠️ Koi active investment nahi hai is user ki.");
    process.exit(0);
  }

  console.log("\n📦 Active Investments:");
  for (const inv of investments) {
    console.log(
      `   • $${inv.investmentAmount} (${inv.packageName || "no name"}) | earned so far: $${inv.totalRoiEarned || 0} | cap: $${inv.investmentAmount * 2}`,
    );
  }

  // ================= SIMULATION LOOP =================
  console.log("\n🚀 Simulation start...\n" + "=".repeat(50));

  // Aaj se start karo, har iteration pe +1 din
  const startDay = new Date();
  let day = 0;
  let totalCredited = 0;
  let totalToEarnings = 0;

  while (day < MAX_DAYS) {
    // Business day banao (IST midnight UTC form me)
    const creditedOn = new Date(
      Date.UTC(
        startDay.getUTCFullYear(),
        startDay.getUTCMonth(),
        startDay.getUTCDate() + day,
      ),
    );

    const result = await processUserRoi(user, creditedOn);

    if (result?.error) {
      console.log(`❌ Day ${day + 1} ERROR:`, result.message);
      break;
    }

    if (result?.skipped) {
      console.log(
        `\n🏁 Day ${day + 1}: Koi active investment nahi bachi — sab complete!`,
      );
      break;
    }

    totalCredited += result.totalRoi || 0;
    totalToEarnings += result.creditedToEarnings || 0;

    console.log(
      `📅 Day ${String(day + 1).padStart(2)} (${creditedOn.toISOString().slice(0, 10)}) → ROI: $${(result.totalRoi || 0).toFixed(2)}` +
        (result.creditedToEarnings > 0
          ? ` | 💰 EARNINGS CREDIT: $${result.creditedToEarnings.toFixed(2)} (${result.completedInvestments} investment complete)`
          : ""),
    );

    day++;
  }

  // ================= FINAL REPORT =================
  console.log("=".repeat(50));

  const userAfter = await UserModel.findById(user._id)
    .select("currentEarnings pendingRoi totalRoi")
    .lean();

  const invAfter = await Investment.find({ userId: user._id }).lean();

  const roiDocs = await Aroi.aggregate([
    { $match: { userId: user._id } },
    {
      $group: {
        _id: "$claimed",
        count: { $sum: 1 },
        total: { $sum: "$roiAmount" },
      },
    },
  ]);

  console.log("\n📊 FINAL REPORT");
  console.log("─".repeat(50));
  console.log(`Days simulated         : ${day}`);
  console.log(`Total ROI generated    : $${totalCredited.toFixed(2)}`);
  console.log(`Total → currentEarnings: $${totalToEarnings.toFixed(2)}`);
  console.log("─".repeat(50));
  console.log("👤 USER WALLET (AFTER):");
  console.log(
    `   currentEarnings : ${user.currentEarnings || 0} → ${userAfter.currentEarnings || 0}`,
  );
  console.log(
    `   pendingRoi      : ${user.pendingRoi || 0} → ${userAfter.pendingRoi || 0}`,
  );
  console.log(
    `   totalRoi        : ${user.totalRoi || 0} → ${userAfter.totalRoi || 0}`,
  );
  console.log("─".repeat(50));
  console.log("📦 INVESTMENTS (AFTER):");
  for (const inv of invAfter) {
    const ok = (inv.totalRoiEarned || 0) >= inv.investmentAmount * 2 - 0.01;
    console.log(
      `   • $${inv.investmentAmount} | status: ${inv.status} | earned: $${(inv.totalRoiEarned || 0).toFixed(2)} / $${inv.investmentAmount * 2} ${
        ok && inv.status === "completed"
          ? "✅"
          : inv.status === "active"
            ? "⏳"
            : "⚠️ MISMATCH"
      }`,
    );
  }
  console.log("─".repeat(50));
  console.log("🧾 AROI DOCS:");
  for (const g of roiDocs) {
    console.log(
      `   claimed=${g._id} → ${g.count} docs, total $${g.total.toFixed(2)}`,
    );
  }

  // ✅ Sanity check
  const expectedTotal = investments.reduce(
    (sum, inv) => sum + (inv.investmentAmount * 2 - (inv.totalRoiEarned || 0)),
    0,
  );
  console.log("─".repeat(50));
  console.log(
    `🔍 Expected ROI (cap - already earned): $${expectedTotal.toFixed(2)}`,
  );
  console.log(
    `🔍 Actually generated this run        : $${totalCredited.toFixed(2)}`,
  );
  console.log(
    Math.abs(expectedTotal - totalCredited) < 0.05
      ? "✅ MATCH — system sahi credit kar raha hai!"
      : "❌ MISMATCH — kahin gadbad hai, difference: $" +
          Math.abs(expectedTotal - totalCredited).toFixed(2),
  );

  await mongoose.disconnect();
  process.exit(0);
};

main().catch((err) => {
  console.error("💥 Script crashed:", err);
  process.exit(1);
});
