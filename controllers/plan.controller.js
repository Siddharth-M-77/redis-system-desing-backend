import mongoose from "mongoose";
import Plan from "../models/plan.model.js";

export const createPlan = async (req, res) => {
  try {
    const { name, price } = req.body;
    if (!price) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const plan = await new Plan({ name, price }).save();
    res.status(201).json(plan);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Server error", message: error.message, success: false });
  }
};
