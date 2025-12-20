import asyncHandler from '../middlewares/asyncHandler.js';
import { redisClient } from '../config/redisClient.js';
import sendEmail from "../utils/sendEmail.js";

//Resend Otp Email
const resendOtpEmail = asyncHandler(async (req, res) => {
  const { name, email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  const finalName = name || "User";
  const normalizedEmail = email.toLowerCase();

  //Remove Old OTP if exists
  await redisClient.del(`otp:email:${normalizedEmail}`);

  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  const redisKey = `otp:email:${normalizedEmail}`;

  // Save OTP in Redis
  await redisClient.setEx(redisKey, 300, otp);

  const emailSent = await sendEmail({
    to: normalizedEmail,
    name: finalName,
    subject: "OTP Verification",
    html: `
        <div style="font-family: Arial; border: 1px solid #ddd; padding: 20px; max-width: 600px; margin: auto;">
          <h2 style="background-color: #2874F0; color: white; padding: 10px; text-align: center;">Flow State</h2>
          <h3>Hi ${finalName},</h3>
          <p>This is your OTP for verifying your account. Valid for 5 minutes.</p>
          <h2 style="color:#2874F0">${otp}</h2>
          <p>Please do not share this OTP with anyone.</p>
          <p>Best Regards,<br>Flow State Team</p>
        </div>
      `,
  });

    // ❗ If email failed → rollback OTP
  if (!emailSent) {
    await redisClient.del(redisKey);
    res.status(500);
    throw new Error("Failed to send OTP email. Please try again.");
  }
    
  res.status(200).json({ success: true, message: "OTP sent successfully" });
});


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
  resendOtpEmail,
  verifyEmailOtp
}