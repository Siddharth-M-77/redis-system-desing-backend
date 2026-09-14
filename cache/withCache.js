import CacheManager from "./CacheManager.js";
import CacheKeyBuilder from "./CacheKeyBuilder.js";
import CacheLock from "./CacheLock.js";

export const withCache = (controllerFn, { scope, ttl }) => {
  return async (req, res, next) => {
    const id = scope === "admin" ? "global1" : req.user?._id || "guest";
    const bucketKey = CacheKeyBuilder.buildBucketKey({ scope, id });
    const fieldKey = CacheKeyBuilder.buildFieldKey(req);

    try {
      const { hit, data, lockAcquired } = await CacheManager.getWithLock(
        bucketKey,
        fieldKey,
      );

      if (hit) {
        console.log(`⚡ Cache Hit: ${fieldKey}`);
        return res.json(data);
      }

      const result = await controllerFn(req, res, next, { skipSend: true });

      if (result !== undefined) {
        await CacheManager.set(bucketKey, fieldKey, result, ttl);
        if (lockAcquired) await CacheLock.releaseLock(bucketKey);
        return res.json(result);
      }

      if (lockAcquired) await CacheLock.releaseLock(bucketKey);
    } catch (err) {
      console.error("❌ withCache error:", err.message);
      next(); // fallback — controller normally chalne do
    }
  };
};
