import { CACHE_VERSION, PROJECT_NAME } from "./cache.config.js";

class CacheKeyBuilder {
  buildBucketKey({ scope, id }) {
    return `${PROJECT_NAME}:${CACHE_VERSION}:${scope}:cache:${id}`;
  }

  buildFieldKey(req) {
    return req.originalUrl;
  }
}

export default new CacheKeyBuilder();
