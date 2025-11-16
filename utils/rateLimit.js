import rateLimit from "express-rate-limit";

export const createRateLimiter = (options) => {
  return rateLimit({
    windowMs: options.windowMs || 60 * 1000, // default: 1 minute
    max: options.max || 5,                   // default: 5 requests
    message: options.message || "Too many requests. Try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  });
};
