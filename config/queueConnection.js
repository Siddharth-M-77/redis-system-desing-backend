// config/queueConnection.js
import IORedis from "ioredis";
import dotenv from "dotenv";
dotenv.config();

export const bullConnection = new IORedis(
  process.env.REDIS_URL || "redis://127.0.0.1:6379",
  {
    maxRetriesPerRequest: null,
  },
);

bullConnection.on("connect", () =>
  console.log("⚡ Queue Redis (BullMQ) Connected"),
);
bullConnection.on("error", (err) =>
  console.error("❌ Queue Redis (BullMQ) Error:", err.message),
);
