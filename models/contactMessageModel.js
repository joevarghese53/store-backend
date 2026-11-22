import mongoose from "mongoose";

const contactMessageSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    topic: {
      type: String,
      required: true,
      enum: ["order", "custom", "returns", "other"],
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    isCompleted: {
      type: Boolean,
      required: true,
      default: false,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    notificationSent: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

contactMessageSchema.index({ isCompleted: 1, createdAt: -1 });

const ContactMessage = mongoose.model("ContactMessage", contactMessageSchema);

export default ContactMessage;
