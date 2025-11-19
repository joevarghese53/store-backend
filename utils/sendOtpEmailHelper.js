import nodemailer from 'nodemailer';

const sendOtpEmailHelper = async ({ username, email, otp }) => {
    console.log("Sending OTP email to:", email);
    
    const transporter = nodemailer.createTransport({
        host: 'smtp.zeptomail.in',
        port: 587,
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
            <h3>Hi ${username},</h3>
            <p>This is your OTP for verifying your account. Valid for 5 minutes.</p>
            <h2 style="color:#2874F0">${otp}</h2>
            <p>Please do not share this OTP with anyone.</p>
            <p>Best Regards,<br>Flow State Team</p>
          </div>
        `,
    };

    transporter.sendMail(mailOptions);
};

export {
    sendOtpEmailHelper
}