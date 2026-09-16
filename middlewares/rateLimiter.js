// middleware/rateLimiter.js
import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import redisClient from "../config/redis.js";

export const betPlacementLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
  }),
  windowMs: 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: "Too many requests, please slow down",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
