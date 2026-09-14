import redisClient from "../config/redis.js";

const industryCache = (ttl = 3600) => {
  return async (req, res, next) => {
    // Sirf GET requests ko cache karenge
    if (req.method !== "GET") return next();

    let bucketKey;

    if (req.originalUrl.includes("/api/admin")) {
      bucketKey = "admin:cache:global1";
    } else {
      const userId = req.user?._id || "guest";
      bucketKey = `risenest:cache:${userId}`;
    }

    const fieldKey = req.originalUrl;

    try {
      const cachedData = await redisClient.hGet(bucketKey, fieldKey);

      if (cachedData) {
        console.log(`⚡ [Cache Hit] Serving ${fieldKey} from Redis cache.`);
        return res.json(JSON.parse(cachedData));
      }

      res.sendResponse = res.json;
      res.json = async (body) => {
        await redisClient.hSet(bucketKey, fieldKey, JSON.stringify(body));
        await redisClient.expire(bucketKey, ttl);
        res.sendResponse(body);
      };

      next();
    } catch (error) {
      console.error("❌ Redis Error:", error);
      next();
    }
  };
};

export default industryCache;
