import express from "express";
import { verifyEmailOtp } from "../controllers/emailOtpController.js";
import { createRateLimiter } from "../utils/rateLimit.js";

// RateLimiters
const otpLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: "Too many OTP requests. Try again in a minute."
});


const router = express.Router();

router.post("/verify", otpLimiter, verifyEmailOtp);

export default router;