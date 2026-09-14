import mongoose from "mongoose";
import dotenv from "dotenv";
import Package from "../models/package.model.js";
dotenv.config();

const plans = [
  { planName: "A", depositAmount: 25, durationDays: 30, multiplier: 2.25 },
  { planName: "B", depositAmount: 50, durationDays: 35, multiplier: 2.4 },
  { planName: "C", depositAmount: 100, durationDays: 27, multiplier: 2.5 },
  { planName: "D", depositAmount: 250, durationDays: 25, multiplier: 2.6 },
  { planName: "E", depositAmount: 500, durationDays: 22, multiplier: 2.5 },
  { planName: "F", depositAmount: 1000, durationDays: 22, multiplier: 2.5 },
];

const seedPackages = async () => {
  try {
    await mongoose.connect();

    for (const plan of plans) {
      const result = await Package.findOneAndUpdate(
        { depositAmount: plan.depositAmount }, // match field
        { $set: plan }, // update/insert ye data
        { upsert: true, new: true, runValidators: true },
      );
    }
  } catch (err) {
  } finally {
    await mongoose.disconnect();
  }
};

seedPackages();
