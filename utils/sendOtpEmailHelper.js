const sendOtpEmailHelper = async ({ username, email, otp }) => {
  console.log("Sending OTP email to:", email);

  const response = await fetch("https://api.zeptomail.in/v1.1/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Zoho-enczapikey ${process.env.ZEPTO_API_KEY}`,
    },
    body: JSON.stringify({
      from: {
        address: "noreply@flowstateproject.in",
        name: "Flow State",
      },
      to: [
        {
          email_address: {
            address: email,
            name: username,
          },
        },
      ],
      subject: "OTP Verification",
      htmlbody: `
        <div style="font-family: Arial; border: 1px solid #ddd; padding: 20px; max-width: 600px; margin: auto;">
          <h2 style="background-color: #2874F0; color: white; padding: 10px; text-align: center;">Flow State</h2>
          <h3>Hi ${username},</h3>
          <p>This is your OTP for verifying your account. Valid for 5 minutes.</p>
          <h2 style="color:#2874F0">${otp}</h2>
          <p>Please do not share this OTP with anyone.</p>
          <p>Best Regards,<br>Flow State Team</p>
        </div>
      `,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("ZeptoMail error:", data);
    throw new Error("Failed to send OTP email");
  }

  console.log("OTP email sent successfully");
};

export { sendOtpEmailHelper };
