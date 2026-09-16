// middleware/tokenBucketLimiter.js
import redisClient from "../config/redis.js";

const BUCKET_CAPACITY = 20;
const REFILL_RATE = 1;
const REFILL_INTERVAL_MS = 1000;

export const tokenBucketLimiter = (identifierFn) => {
  return async (req, res, next) => {
    const identifier = identifierFn(req);
    const key = `ratelimit:bucket:${identifier}`;

    try {
      const now = Date.now();

      const bucketData = await redisClient.get(key);
      let tokens, lastRefill;

      if (bucketData) {
        const parsed = JSON.parse(bucketData);
        tokens = parsed.tokens;
        lastRefill = parsed.lastRefill;
      } else {
        tokens = BUCKET_CAPACITY;
        lastRefill = now;
      }

      const elapsedMs = now - lastRefill;
      const tokensToAdd =
        Math.floor(elapsedMs / REFILL_INTERVAL_MS) * REFILL_RATE;
      tokens = Math.min(BUCKET_CAPACITY, tokens + tokensToAdd);

      if (tokens < 1) {
        return res.status(429).json({
          success: false,
          message: "Too many requests — please slow down",
        });
      }

      // Ek token consume karo
      tokens -= 1;

      await redisClient.set(
        key,
        JSON.stringify({ tokens, lastRefill: now }),
        { EX: 120 }, // 2 minute mein auto-expire, agar user inactive ho jaaye
      );

      next();
    } catch (error) {
      console.error("Rate limiter error:", error.message);
      next(); // Fail-open — agar Redis down ho, request ko block mat karo (availability > strictness)
    }
  };
};
