import express from "express";
import { verifyEmailOtp, resendOtpEmail } from "../controllers/emailOtpController.js";
import { rateLimiters } from "../utils/rateLimiters.js";

const router = express.Router();

router.post("/resend-otp", rateLimiters.otpLimiter, resendOtpEmail);
router.post("/verify", rateLimiters.otpLimiter, verifyEmailOtp);

export default router;