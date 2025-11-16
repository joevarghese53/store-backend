// userModel.js
import mongoose from "mongoose";

const userSchema = mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, match: [/^\S+@\S+\.\S+$/, "Invalid email"] },
    password: { type: String, required: true, select: false },
    isAdmin: { type: Boolean, required: true, default: false },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
