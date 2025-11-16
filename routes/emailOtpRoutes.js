import express from "express";
import { createRateLimiter } from "../utils/rateLimit.js";
import { sendEmailOtp, verifyEmailOtp } from "../controllers/emailOtpController.js";

const router = express.Router();
const otpLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: "Too many OTP requests. Try again in a minute."
});

router.post("/send", otpLimiter, sendEmailOtp);

router.post("/verify", verifyEmailOtp);

export default router;