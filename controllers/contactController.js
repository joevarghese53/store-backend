import asyncHandler from "../middlewares/asyncHandler.js";
import ContactMessage from "../models/contactMessageModel.js";
import sendEmail from "../utils/sendEmail.js";

const topics = {
  order: "Order support",
  custom: "Custom designs",
  returns: "Returns and cancellations",
  other: "Something else",
};

const escapeHtml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const submitContactMessage = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, topic, message } = req.body ?? {};

  if (
    typeof firstName !== "string" ||
    typeof lastName !== "string" ||
    typeof email !== "string" ||
    typeof topic !== "string" ||
    typeof message !== "string"
  ) {
    res.status(400);
    throw new Error("Please provide all required contact details.");
  }

  const normalized = {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: email.trim().toLowerCase(),
    topic,
    message: message.trim(),
  };
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email);

  if (
    !normalized.firstName ||
    normalized.firstName.length > 80 ||
    !normalized.lastName ||
    normalized.lastName.length > 80 ||
    !validEmail ||
    normalized.email.length > 254 ||
    !Object.hasOwn(topics, normalized.topic) ||
    !normalized.message ||
    normalized.message.length > 5000
  ) {
    res.status(400);
    throw new Error("Please check your contact details and try again.");
  }

  const contactMessage = await ContactMessage.create({
    ...normalized,
    isCompleted: false,
    completedAt: null,
  });
  const inboxEmail = process.env.CONTACT_INBOX_EMAIL;

  if (!inboxEmail) {
    console.error(
      "CONTACT_INBOX_EMAIL is not configured; contact message was saved without an email notification."
    );
  } else {
    const emailSent = await sendEmail({
      to: inboxEmail,
      name: "Flow State Support",
      subject: `New contact form submission: ${topics[normalized.topic]}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>New contact message</h2>
          <p><strong>Name:</strong> ${escapeHtml(normalized.firstName)} ${escapeHtml(normalized.lastName)}</p>
          <p><strong>Email:</strong> ${escapeHtml(normalized.email)}</p>
          <p><strong>Topic:</strong> ${topics[normalized.topic]}</p>
          <p><strong>Message:</strong></p>
          <p>${escapeHtml(normalized.message).replace(/\n/g, "<br>")}</p>
          <p><small>Message ID: ${contactMessage.id}</small></p>
        </div>
      `,
    });

    if (emailSent) {
      contactMessage.notificationSent = true;
      await contactMessage.save();
    }
  }

  res.status(201).json({
    success: true,
    message: "Your message has been received.",
    id: contactMessage.id,
  });
});

export { submitContactMessage };
