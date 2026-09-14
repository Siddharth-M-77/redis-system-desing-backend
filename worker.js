import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import "./workers/referralWorker.js";

const startWorkerProcess = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("🟢 Worker Process → MongoDB Connected");
    console.log("👷 All Workers Running & Listening for Jobs...");
  } catch (err) {
    console.error("🔴 Worker Process → MongoDB Connection Failed:", err);
    process.exit(1);
  }
};

startWorkerProcess();
