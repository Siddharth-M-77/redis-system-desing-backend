import redis from "redis";
import dotenv from "dotenv";

dotenv.config();

const redisClient = redis.createClient({
  url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
});

redisClient.on("connect", () => console.log("⚡ Redis Client Connected!"));
redisClient.on("error", (err) => console.error("❌ Redis Client Error:", err));

(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error("❌ Redis Initial Connection Failed:", err);
  }
})();

export default redisClient;
