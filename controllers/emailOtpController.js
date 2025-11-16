import nodemailer from 'nodemailer';
import asyncHandler from '../middlewares/asyncHandler.js';
import { redisClient } from '../config/redisClient.js';

// Generate & send OTP
const sendEmailOtp = asyncHandler(async (req, res) => {
  const { name, email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  const finalName = name || "User";

  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresIn = 300; // 5 minutes

  const redisKey = `otp:email:${email.toLowerCase()}`;

  // Save OTP in Redis
  await redisClient.setEx(redisKey, expiresIn, otp);

  // Create email transporter
  const transporter = nodemailer.createTransport({
    host: 'smtp.zeptomail.in',
    port: 587,
    secure: false,
    auth: {
      user: 'emailapikey',
      pass: process.env.ZEPTO_API_KEY,
    },
  });

  // Email template
  const mailOptions = {
    from: `"Flow State" <noreply@flowstateproject.in>`,
    to: email,
    subject: 'OTP Verification',
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
  };

  await transporter.sendMail(mailOptions);

  res.status(200).json({ status: "success", message: "OTP sent successfully" });
});

// Verify OTP
const verifyEmailOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP required" });
  }

  const redisKey = `otp:email:${email.toLowerCase()}`;

  const storedOtp = await redisClient.get(redisKey);

  if (!storedOtp) {
    return res.status(400).json({ message: "OTP expired or not found" });
  }

  if (storedOtp !== otp) {
    return res.status(400).json({ message: "Invalid OTP" });
  }

  // Valid OTP — remove from Redis
  await redisClient.del(redisKey);

  return res.status(200).json({ message: "OTP verified successfully" });
});

export {
  sendEmailOtp,
  verifyEmailOtp
}