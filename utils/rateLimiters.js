import { createRateLimiter } from "./createRateLimiter.js";

const createPlaceholder = (name) => {
  let realLimiter = null;

  const middleware = (req, res, next) => {
    if (!realLimiter) {
      throw new Error(
        `Rate limiter "${name}" used before initRateLimiters() was called`
      );
    }
    return realLimiter(req, res, next);
  };

  middleware.set = (limiter) => {
    realLimiter = limiter;
  };

  return middleware;
};

export const rateLimiters = {
  otpLimiter: createPlaceholder("otpLimiter"),
  generateLimiter: createPlaceholder("generateLimiter"),
  statusLimiter: createPlaceholder("statusLimiter"),
  queueLimiter: createPlaceholder("queueLimiter"),
  paymentLimiter: createPlaceholder("paymentLimiter"),
  purchaseTriesLimiter: createPlaceholder("purchaseTriesLimiter"),
  initiateRegistrationLimiter: createPlaceholder("initiateRegistrationLimiter"),
  refreshLimiter: createPlaceholder("refreshLimiter"),
};

export const initRateLimiters = () => {
  rateLimiters.otpLimiter.set(
    createRateLimiter({
      windowMs: 60 * 1000,
      max: 5,
      message: "Too many OTP requests. Try again in a minute.",
    })
  );

  rateLimiters.generateLimiter.set(
    createRateLimiter({
      windowMs: 60 * 1000,
      max: 5,
      message: "Rate limit exceeded. Wait one minute before generating again.",
    })
  );

  rateLimiters.statusLimiter.set(
    createRateLimiter({
      windowMs: 30 * 1000,
      max: 15,
    })
  );

  rateLimiters.queueLimiter.set(
    createRateLimiter({
      windowMs: 30 * 1000,
      max: 15,
    })
  );

  rateLimiters.paymentLimiter.set(
    createRateLimiter({
      windowMs: 60 * 1000,
      max: 5,
      message: "Too many payment attempts. Try again later.",
    })
  );

  rateLimiters.purchaseTriesLimiter.set(
    createRateLimiter({
      windowMs: 60 * 1000,
      max: 5,
    })
  );

  rateLimiters.initiateRegistrationLimiter.set(
    createRateLimiter({
      windowMs: 60 * 1000,
      max: 5,
      message: "Too many requests. Try again in a minute.",
    })
  );

  rateLimiters.refreshLimiter.set(
    createRateLimiter({ windowMs: 60 * 1000, max: 10 })
  );

  console.log("✅ Rate limiters initialized");
};



// ------------------------Checked -------------------------