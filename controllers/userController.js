// userController.js
import User from "../models/userModel.js";
import Tries from "../models/triesModel.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import bcrypt from "bcryptjs";
import generateTokens from "../utils/createToken.js";
import crypto from "crypto";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";
import { redisClient } from "../config/redisClient.js";
import { sendOtpEmailHelper } from "../utils/sendOtpEmailHelper.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// @desc    Initate Registration - store user details in redis
// @route   POST /api/users/initiate-registration
// @access  Public
const initiateRegistration = asyncHandler(async (req, res) => {

  // Data Validation
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    res.status(400);
    throw new Error("Please fill all the inputs.");
  }
  const normalizedEmail = email.toLowerCase();

  // Check if user already exists
  const userExists = await User.findOne({ email: normalizedEmail });
  if (userExists) {
    res.status(400);
    throw new Error("User with this email already exists.");
  }

  // Hash password before storing anywhere
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  //Redis Keys
  const registrationKey = `registration:${normalizedEmail}`;
  const otpKey = `otp:email:${normalizedEmail}`;

  // Try Catch for All or Nothing Behaviour
  try {

    // Store User Data in Redis
    const tempData = {
      username,
      email: normalizedEmail,
      password: hashedPassword,
    };
    await redisClient.setEx(registrationKey, 300, JSON.stringify(tempData));

    // Generate and Store OTP in Redis
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await redisClient.setEx(otpKey, 300, otp);

    // Send OTP Email
    await sendOtpEmailHelper({ username, email: normalizedEmail, otp });

  } catch (e) {

    //Delete Stored Values in Case of Failure
    await redisClient.del(registrationKey);
    await redisClient.del(otpKey);

    console.error("Error during Initiate Registration:", e);
    throw new Error("Failed to initiate registration. Please try again.");

  }

  return res.status(200).json({
    success: true,
    message: "Registration initiated. Please verify OTP within 5 minutes.",
  });

});

// @desc    Register new user
// @route   POST /api/users/register
// @access  Public
const createUser = asyncHandler(async (req, res) => {

  //Data Validation
  const { email } = req.body;
  if (!email) {
    res.status(400);
    throw new Error("Email is required.");
  }
  const normalizedEmail = email.toLowerCase();

  // 1) Check OTP verified flag
  const verifiedKey = `registration:verified:${normalizedEmail}`;
  const isVerified = await redisClient.get(verifiedKey);
  if (!isVerified) {
    res.status(400);
    throw new Error("OTP not verified. Please verify your email first.");
  }

  // 2) Read temp registration data from Redis
  const registrationKey = `registration:${normalizedEmail}`;
  const tempDataJson = await redisClient.get(registrationKey);
  if (!tempDataJson) {
    res.status(400);
    throw new Error(
      "Registration data expired or not found. Please initiate registration again."
    );
  }
  const tempData = JSON.parse(tempDataJson);
  const { username, email: storedEmail, password } = tempData;
  if (normalizedEmail !== storedEmail) {
    res.status(400);
    throw new Error("Email mismatch. Please restart registration.");
  }

  // 3) Safety: ensure user still doesn't exist
  const userExists = await User.findOne({ email: storedEmail });
  if (userExists) {
    await redisClient.del(registrationKey);
    await redisClient.del(verifiedKey);
    res.status(400);
    throw new Error("User with this email already exists.");
  }

  // 4) Create user
  const newUser = new User({
    username,
    email: storedEmail,
    password, // already hashed
  });
  await newUser.save();

  // 5) Clean up Redis keys
  await redisClient.del(registrationKey);
  await redisClient.del(verifiedKey);

  // 6) Set refresh cookie + return access token
  const accessToken = generateTokens(res, newUser._id);

  // 7) Initialize free tries
  await new Tries({
    user: newUser._id,
    freeTriesRemaining: 5,
    purchasedTriesRemaining: 0,
  }).save();

  res.status(201).json({
    success: true,
    _id: newUser._id,
    username: newUser.username,
    email: newUser.email,
    isAdmin: newUser.isAdmin,
    accessToken,
  });
});


// @desc    Login user
// @route   POST /api/users/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("Please provide both email and password.");
  }

  const existingUser = await User.findOne({ email }).select("+password");
  console.log("user", existingUser)
  if (!existingUser) {
    res.status(401);
    throw new Error("Invalid email or password.");
  }

  const isPasswordValid = await bcrypt.compare(password, existingUser.password);
  if (!isPasswordValid) {
    res.status(401);
    throw new Error("Invalid email or password.");
  }

  const accessToken = generateTokens(res, existingUser._id);

  res.status(200).json({
    _id: existingUser._id,
    username: existingUser.username,
    email: existingUser.email,
    isAdmin: existingUser.isAdmin,
    accessToken,
  });
});

// @desc    Issue new access token using refresh token cookie
// @route   GET /api/users/refresh-token
// @access  Public (cookie-based)
const refreshAccessToken = asyncHandler(async (req, res) => {
  console.log("Received refresh token request");
  console.log("🍪 All cookies:", req.cookies);

  const rawToken = req.cookies.refreshToken;
  console.log("➡️ Refresh token received:", rawToken);

  const token = rawToken?.replace(/^"|"$/g, ""); // strip accidental quotes

  if (!token) {
    res.status(401);
    throw new Error("No refresh token provided");
  }

  console.log("Token about to verify:", token);
  console.log(
    "Secret used:",
    (process.env.JWT_REFRESH_SECRET || "").slice(0, 10) + "..."
  );

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    console.log("Decoded refresh token:", decoded);

    const accessToken = jwt.sign(
      { userId: decoded.userId },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    res.status(200).json({ accessToken });
  } catch (err) {
    res.status(403);
    throw new Error(err.message || "Invalid refresh token");
  }
});

// @desc    Logout user (clear refresh cookie)
// @route   POST /api/users/logout
// @access  Public (cookie-based)
const logoutCurrentUser = asyncHandler(async (req, res) => {
  console.log("Logging out user, clearing refresh token cookie");
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
    path: "/api/users/refresh-token", // must match path used when setting the cookie
  });

  console.log("Refresh token cleared:", res.getHeader("Set-Cookie"));

  res.status(200).json({ message: "Logged out successfully" });
});

// @desc    Get all users
// @route   GET /api/users/admin/allUsers
// @access  Admin
const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find({});
  res.status(200).json(users);
});

// @desc    Get current user's profile
// @route   GET /api/users/profile
// @access  Private
const getCurrentUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error("User not found.");
  }

  res.status(200).json({
    _id: user._id,
    username: user.username,
    email: user.email,
  });
});

// @desc    Update current user's profile
// @route   PUT /api/users/profile
// @access  Private
const updateCurrentUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const { username, password, email } = req.body;
  user.username = username.trim() || user.username;
  user.email = email || user.email;

  if (password) {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
  }

  const updatedUser = await user.save();

  res.status(200).json({
    _id: updatedUser._id,
    username: updatedUser.username,
    email: updatedUser.email,
    isAdmin: updatedUser.isAdmin,
  });
});

// @desc    Delete user by ID
// @route   DELETE /api/users/admin/:id
// @access  Admin
const deleteUserById = asyncHandler(async (req, res) => {

  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error("User not found.");
  }

  if (user.isAdmin) {
    res.status(400);
    throw new Error("Cannot delete admin user");
  }

  await User.deleteOne({ _id: user._id });

  res.status(200).json({ 
    success: true,
    message: "User removed" 
  });

});

// @desc    Get user by ID (admin)
// @route   GET /api/users/admin/:id
// @access  Admin
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("-password");

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  res.json(user);
});

// @desc    Update user by ID (admin)
// @route   PUT /api/users/admin/:id
// @access  Admin
const updateUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  user.username = req.body.username || user.username;
  user.email = req.body.email || user.email;
  user.isAdmin = Boolean(req.body.isAdmin);

  const updatedUser = await user.save();

  res.json({
    _id: updatedUser._id,
    username: updatedUser.username,
    email: updatedUser.email,
    isAdmin: updatedUser.isAdmin,
  });
});

// @desc    Generate password reset link
// @route   POST /api/users/resetPasswordLink
// @access  Public
const generateResetPasswordLink = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    res.status(400);
    throw new Error("Email is required");
  }

  const user = await User.findOne({ email });

  // Always respond the same to avoid email enumeration
  if (!user) {
    await sleep(2000);
    return res
      .status(200)
      .json({ message: "If a user with this email exists, a reset link will be sent." });
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  user.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  user.resetPasswordExpires = Date.now() + 30 * 60 * 1000; // 30 minutes
  await user.save();

  const resetUrl = `${process.env.FRONTEND_URL}/ResetPassword/${resetToken}`;

  const transporter = nodemailer.createTransport({
    host: "smtp.zeptomail.in",
    port: 587,
    auth: {
      user: "emailapikey",
      pass: process.env.ZEPTO_API_KEY,
    },
  });

  const mailOptions = {
    from: `"Flow State" <noreply@flowstateproject.in>`,
    to: email,
    subject: "Password Reset Request",
    html: `
      <h1>Reset Your Password</h1>
      <p>Click the link below to reset your password</p>
      <a href="${resetUrl}">Reset Password</a>
      <p>If you did not request a password reset, please ignore this email</p>
      <p>Please do not reply to this email as it is sent from an unmonitored address.</p>
      <p>For any queries, please contact us at <a href="mailto:info@flowstateproject.in"></p>
    `,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log("Password reset email sent:", info.messageId);

  res
    .status(200)
    .json({ message: "If a user with this email exists, a reset link will be sent." });
});

// @desc    Reset password
// @route   POST /api/users/resetPassword
// @access  Public
const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    res.status(400);
    throw new Error("Token and new password are required");
  }

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    res.status(400);
    throw new Error("Invalid or expired token");
  }

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(newPassword, salt);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;

  await user.save();

  res.status(200).json({ message: "Password reset successfully" });
});

export {
  initiateRegistration,
  createUser,
  loginUser,
  refreshAccessToken,
  logoutCurrentUser,
  getAllUsers,
  getCurrentUserProfile,
  updateCurrentUserProfile,
  deleteUserById,
  getUserById,
  updateUserById,
  generateResetPasswordLink,
  resetPassword,
};
