import redisClient from "../config/redis.js";

export const invalidateAdminOnUserAction = async (req, res, next) => {
  // Agar user koi data badal raha hai (POST, PUT, DELETE)
  if (["POST", "PUT", "DELETE"].includes(req.method)) {
    try {
      // Chupchaap background me admin ka cache uda do
      await redisClient.del("admin:cache:global1");
      console.log(
        `🧹 [Global Admin Evict] Admin cache cleared via User Action: ${req.originalUrl}`,
      );
    } catch (err) {
      console.error("❌ Global Admin Eviction Error:", err.message);
    }
  }
  next();
};
