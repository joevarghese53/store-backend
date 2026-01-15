// utils/sendEmail.js
const sendEmail = async ({ to, name = "User", subject, html }) => {
  try {
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
              address: to,
              name,
            },
          },
        ],
        subject,
        htmlbody: html,
        textbody: html.replace(/<[^>]*>/g, ""),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Email send failed:", data);
      return false;
    }

    console.log("✅ Email sent successfully to:", to);
    return true;
  } catch (err) {
    console.error("❌ Email helper error:", err);
    return false;
  }
};

export default sendEmail;

// ----------------Checked------------------