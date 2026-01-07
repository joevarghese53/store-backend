import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { redisClient } from "../config/redisClient.js";

export const createRateLimiter = (options = {}) => {
  const {
    windowMs = 60 * 1000,
    max = 5,
    message = "Too many requests. Try again later.",
  } = options;

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,

    // ✅ Use Redis only if available
    store: redisClient && redisClient.isOpen
      ? new RedisStore({
          sendCommand: (...args) => redisClient.sendCommand(args),
        })
      : undefined,

    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: "RATE_LIMIT_EXCEEDED",
        message,
      });
    },
  });
};

// ------------------------Checked -------------------------
