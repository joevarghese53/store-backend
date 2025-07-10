import nodemailer from 'nodemailer';
import redisClient from '../config/redisClient.js';

const sendEmailOtp = async (req, res) => {
    const { name, email } = req.body;

    if (!email) {
        return res.status(400).json({ message: "Email is required" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresIn = 300;

    console.log(`OTP for ${email}: ${otp}`);

    try {
        await redisClient.setEx(`otp:${email}`, expiresIn, otp);

        const transporter = nodemailer.createTransport({
            host: 'smtp.zeptomail.in',
            port: 587,
            auth: {
                user: 'emailapikey',
                pass: process.env.ZEPTO_API_KEY,
            },
        });

        const mailOptions = {
            from: `"Flow State" <noreply@flowstateproject.in>`,
            to: email, // recipient email from order
            subject: 'OTP Verification',
            html: `
    <div style="font-family: Arial, sans-serif; border: 1px solid #ddd; padding: 20px; max-width: 600px; margin: auto;">
      <h2 style="background-color: #2874F0; color: white; padding: 10px; text-align: center;">Flow State</h2>
      <h3>Hi ${name},</h3>
      <p>This is your OTP for verifying your account. Valid for 5 minutes</p>
      <p><strong>OTP : </strong> ${otp}</p>
      <p>Best Regards,<br>Flow State Team</p>
    </div>
  `,
        };
        await transporter.sendMail(mailOptions);

        return res.status(200).json({ status: "success", message: "OTP sent successfully" });

    }
    catch (error) {
        console.error(`Error sending OTP to ${email}:`, error);
        return res.status(500).json({ message: "Failed to send OTP. Please try again later." });
    }
}

const verifyEmailOtp = async (req, res) => {
  const { email, otp } = req.body;

  console.log(`Verifying OTP for ${email}: ${otp}`);

  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP required" });
  }

  try {
    const storedOtp = await redisClient.get(`otp:${email}`);

    if (!storedOtp) {
      return res.status(400).json({ message: "OTP expired or not found" });
    }

    if (storedOtp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // OTP is valid — delete it from Redis
    await redisClient.del(`otp:${email}`);

    return res.status(200).json({ message: "OTP verified successfully" });
  } catch (error) {
    console.error("OTP verification error:", error);
    return res.status(500).json({ message: "Error verifying OTP" });
  }
};

export { sendEmailOtp, verifyEmailOtp };