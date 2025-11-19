import asyncHandler from '../middlewares/asyncHandler.js';
import { redisClient } from '../config/redisClient.js';

// Verify OTP
const verifyEmailOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    res.status(400);
    throw new Error("Email and OTP required");
  }

  const normalizedEmail = email.toLowerCase();
  const otpKey = `otp:email:${normalizedEmail}`;

  const storedOtp = await redisClient.get(otpKey);

  if (!storedOtp) {
    res.status(400);
    throw new Error("OTP expired or not found");
  }

  if (storedOtp !== otp) {
    res.status(400);
    throw new Error("Invalid OTP");
  }

  // Valid OTP — remove OTP from Redis
  await redisClient.del(otpKey);

  // ✅ Mark registration as OTP-verified for this email
  const verifiedKey = `registration:verified:${normalizedEmail}`;
  await redisClient.setEx(verifiedKey, 300, "true");

  return res.status(200).json({
    success: true,
    message: "OTP verified successfully",
  });
});

export {
  verifyEmailOtp
}