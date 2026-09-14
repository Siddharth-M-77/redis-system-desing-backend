import CacheManager from "../cache/CacheManager.js";
import CacheKeyBuilder from "../cache/CacheKeyBuilder.js";

const invalidateAdminCache = async (req, res, next) => {
  if (["POST", "PUT", "DELETE"].includes(req.method)) {
    const bucketKey = CacheKeyBuilder.buildBucketKey({
      scope: "admin",
      id: "global1",
    });
    await CacheManager.invalidate(bucketKey);
  }
  next();
};

export default invalidateAdminCache;
