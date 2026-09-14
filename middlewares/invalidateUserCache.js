import CacheManager from "../cache/CacheManager.js";
import CacheKeyBuilder from "../cache/CacheKeyBuilder.js";

const invalidateUserCache = async (req, res, next) => {
  if (["POST", "PUT", "DELETE"].includes(req.method) && req.user?._id) {
    const bucketKey = CacheKeyBuilder.buildBucketKey({
      scope: "user",
      id: req.user._id,
    });
    await CacheManager.invalidate(bucketKey);
  }
  next();
};

export default invalidateUserCache;
