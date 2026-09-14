import redisClient from "../config/redis.js";
import CacheLock from "./CacheLock.js";

class CacheManager {
  async get(bucketKey, fieldKey) {
    try {
      const data = await redisClient.hGet(bucketKey, fieldKey);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.error("❌ Cache GET error:", err.message);
      return null;
    }
  }

  async set(bucketKey, fieldKey, value, ttl) {
    try {
      await redisClient.hSet(bucketKey, fieldKey, JSON.stringify(value));
      await redisClient.expire(bucketKey, ttl);
    } catch (err) {
      console.error("❌ Cache SET error:", err.message);
    }
  }

  async invalidate(bucketKey) {
    try {
      await redisClient.del(bucketKey);
      console.log(`🗑️ Cache evicted: ${bucketKey}`);
    } catch (err) {
      console.error("❌ Cache INVALIDATE error:", err.message);
    }
  }

  async getWithLock(bucketKey, fieldKey) {
    const cached = await this.get(bucketKey, fieldKey);
    if (cached) return { hit: true, data: cached };

    const gotLock = await CacheLock.acquireLock(bucketKey);
    if (!gotLock) {
      const waited = await CacheLock.waitForCache(bucketKey, fieldKey);
      if (waited) return { hit: true, data: JSON.parse(waited) };
    }

    return { hit: false, lockAcquired: gotLock };
  }
}

export default new CacheManager();
