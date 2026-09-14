import redisClient from "../config/redis.js";

class CacheLock {
  async acquireLock(key, lockTtlMs = 5000) {
    const lockKey = `lock:${key}`;
    const acquired = await redisClient.set(lockKey, "1", "PX", lockTtlMs, "NX");
    return acquired === "OK";
  }

  async releaseLock(key) {
    await redisClient.del(`lock:${key}`);
  }

  async waitForCache(bucketKey, fieldKey, maxRetries = 5, delayMs = 200) {
    for (let i = 0; i < maxRetries; i++) {
      await new Promise((r) => setTimeout(r, delayMs));
      const data = await redisClient.hGet(bucketKey, fieldKey);
      if (data) return data;
    }
    return null;
  }
}

export default new CacheLock();
