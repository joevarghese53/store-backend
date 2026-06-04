// userController.js
import User from "../models/userModel.js";
import Tries from "../models/triesModel.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import bcrypt from "bcryptjs";
import generateTokens from "../utils/createToken.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import RefreshToken from "../models/refreshTokenModel.js";
import { createRefreshTokenDoc } from "../utils/refreshTokenDocHelper.js"
import { hashToken } from "../utils/hashTokenHelper.js"
import { redisClient } from "../config/redisClient.js";
import sendEmail from "../utils/sendEmail.js";

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

  //Redis Keys
  const registrationKey = `registration:${normalizedEmail}`;
  const otpKey = `otp:email:${normalizedEmail}`;

  // Try Catch for All or Nothing Behaviour
  try {

    // Store User Data in Redis
    const tempData = {
      username,
      email: normalizedEmail,
      password: password,
    };
    await redisClient.setEx(registrationKey, 300, JSON.stringify(tempData));

    // Generate and Store OTP in Redis
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await redisClient.setEx(otpKey, 300, otp);

    // Send OTP Email
    const emailSent = await sendEmail({
      to: normalizedEmail,
      name: username,
      subject: "OTP Verification",
      html: ` <div style="font-family: Arial; border: 1px solid #ddd; padding: 20px; max-width: 600px; margin: auto;">
          <h2 style="background-color: #2874F0; color: white; padding: 10px; text-align: center;">Flow State</h2>
          <h3>Hi ${username},</h3>
          <p>This is your OTP for verifying your account. Valid for 5 minutes.</p>
          <h2 style="color:#2874F0">${otp}</h2>
          <p>Please do not share this OTP with anyone.</p>
          <p>Best Regards,<br>Flow State Team</p>
        </div>`,
    });

    if (!emailSent) {
      throw new Error("Failed to send OTP email");
    }

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
const register = asyncHandler(async (req, res) => {

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
    password, // Will be hashed by pre-save hook
  });
  await newUser.save();

  // 5) Clean up Redis keys
  await redisClient.del(registrationKey);
  await redisClient.del(verifiedKey);

  // 6) Set refresh cookie + return access token
  const accessToken = await generateTokens(req, res, newUser);

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

  const normalizedEmail = email.toLowerCase();
  const existingUser = await User.findOne({ email: normalizedEmail }).select("+password");

  if (!existingUser) {
    res.status(401);
    throw new Error("Invalid email or password.");
  }

  const isPasswordValid = await bcrypt.compare(password, existingUser.password);
  if (!isPasswordValid) {
    res.status(401);
    throw new Error("Invalid email or password.");
  }

  const accessToken = await generateTokens(req, res, existingUser);

  res.status(200).json({
    _id: existingUser._id,
    username: existingUser.username,
    email: existingUser.email,
    isAdmin: existingUser.isAdmin,
    accessToken,
  });
});

// @desc    Issue new access token using refresh token cookie
// @route   POST /api/users/refresh-token
// @access  Public (cookie-based)
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const BUFFER_MS = 24 * 60 * 60 * 1000; // 1 day buffer

const refreshAccessToken = asyncHandler(async (req, res) => {
  // Validate token (strip accidental quotes)
  const rawToken = req.cookies.refreshToken;
  const token = rawToken?.replace(/^"|"$/g, "");
  if (!token) {
    res.clearCookie("refreshToken", { path: "/api/users/refresh-token" });
    res.status(401);
    throw new Error("No refresh token provided");
  }

  const tokenHash = hashToken(token);

  // Find stored token record
  const existing = await RefreshToken.findOne({ tokenHash });

  // Token not found -> possible reuse or invalid token
  if (!existing) {
    // Clear cookie to remove bad token client-side
    res.clearCookie("refreshToken", { path: "/api/users/refresh-token" });

    res.status(401);
    throw new Error("Invalid refresh token");
  }

  // Check active
  if (!existing.isActive) {
    // Reuse detection: token is expired or revoked (someone attempted to reuse an old token)
    // Revoke all tokens for this user as a precaution
    await RefreshToken.updateMany(
      { userId: existing.userId, revokedAt: null },
      { revokedAt: new Date() }
    );

    res.clearCookie("refreshToken", { path: "/api/users/refresh-token" });
    res.status(401);
    throw new Error("Refresh token revoked. Please login again.");
  }

  // At this point token is valid and active => ROTATE
  // Revoke the old token and record lastUsed info
  existing.revokedAt = new Date();
  existing.lastUsedAt = new Date();
  existing.lastUsedIp = req.ip;

  const { plain: newRefreshPlain, doc: newTokenDoc } = await createRefreshTokenDoc({
    userId: existing.userId,
    ip: req.ip || "",
    userAgent: req.get("user-agent") || "",
    ttlMs: REFRESH_TOKEN_TTL_MS,
    bufferMs: BUFFER_MS
  });


  // Link old -> new
  existing.replacedByToken = newTokenDoc._id;
  await existing.save();

  // Issue new access token (short-lived JWT)
  const accessToken = jwt.sign(
    { userId: existing.userId },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );

  // Send new refresh token as secure HttpOnly cookie (same path as your generator)
  res.cookie("refreshToken", newRefreshPlain, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
    maxAge: REFRESH_TOKEN_TTL_MS,
    path: "/api/users/refresh-token",
  });

  // Return new access token
  res.status(200).json({ accessToken });
});


// @desc    Logout user (clear refresh cookie)
// @route   POST /api/users/logout
// @access  Public (cookie-based)
const logoutCurrentUser = asyncHandler(async (req, res) => {

  const rawToken = req.cookies.refreshToken;
  const token = rawToken?.replace(/^"|"$/g, "");
  if (token) {
    const tokenHash = hashToken(token); // reuse your hashToken helper
    await RefreshToken.updateOne({ tokenHash }, { revokedAt: new Date() });
  }
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
    path: "/api/users/refresh-token",
  });
  res.status(200).json({ success: true, message: "Logged out successfully" });
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

  const { username, password } = req.body;
  user.username = username.trim() || user.username;

  if (password) {
    user.password = password; // Will be hashed by pre-save hook
  }

  const updatedUser = await user.save();
  await RefreshToken.updateMany({ userId: updatedUser._id, revokedAt: null }, { revokedAt: new Date() });

  res.status(200).json({
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

  const normalizedEmail = email.toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });

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

  // const resetUrl = `${process.env.FRONTEND_URL}/ResetPassword/${resetToken}`;
  const resetUrl = `${process.env.FRONTEND_URL.replace(/\/$/, "")}/ResetPassword/${encodeURIComponent(resetToken)}`;

  const emailSent = await sendEmail({
    to: email,
    name: user.name || "User",
    subject: "Password Reset Request",
    html: `
       <h1>Reset Your Password</h1>
      <p>Click the link below to reset your password:</p>
          <p>
            <a href="${resetUrl}" style="color:#2874F0;">
              Reset Password
            </a>
          </p>
          <p>This link is valid for 30 minutes.</p>
          <p>If you did not request a password reset, please ignore this email.</p>
          <p>Please do not reply to this email.</p>
          <p>
            For queries, contact
            <a href="mailto:info@flowstateproject.in">info@flowstateproject.in</a>
          </p>
    `,
  });

  if (!emailSent) {
    res.status(500);
    throw new Error("Failed to send reset email. Please try again later.");
  }

  res.status(200).json({ message: "If a user with this email exists, a reset link will be sent." });
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

  user.password = newPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;

  await user.save();
  await RefreshToken.updateMany({ userId: user._id, revokedAt: null }, { revokedAt: new Date() });

  res.status(200).json({ message: "Password reset successfully" });
});

// @desc    Get all users
// @route   GET /api/users/admin/allUsers
// @access  Admin
const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find({}).select("-password -resetPasswordToken -resetPasswordExpires");
  res.status(200).json(users);
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
  const updatedUser = await user.save();

  res.json({
    _id: updatedUser._id,
    username: updatedUser.username,
    email: updatedUser.email,
  });
});

// @desc    Delete user by ID
// @route   DELETE /api/users/admin/:id
// @access  Admin
const deleteUserById = asyncHandler(async (req, res) => {

  // validating Admin user is making the request
  const adminUser = req.user;
  if (!adminUser.isAdmin) {
    res.status(403);
    throw new Error("Access denied. Admins only.");
  }

  // Validating user to delete
  const { id } = req.params;
  const userToDelete = await User.findById(id);
  if (!userToDelete) {
    res.status(404);
    throw new Error("User not found.");
  }
  if (userToDelete.isAdmin) {
    res.status(400);
    throw new Error("Cannot delete admin user");
  }

  //Delete User
  await userToDelete.deleteOne();

  //Response
  res.status(200).json({
    success: true,
    message: "User removed"
  });

});

const createTestUsers = asyncHandler(async (req, res) => {
  const { users } = req.body;

  if (!Array.isArray(users) || users.length === 0) {
    res.status(400);
    throw new Error("Users array is required.");
  }

  const createdUsers = [];
  const failedUsers = [];

  for (const userData of users) {
    try {
      const { username, email, password } = userData;

      if (!username || !email || !password) {
        failedUsers.push({
          email,
          reason: "username, email and password are required",
        });
        continue;
      }

      const normalizedEmail = email.toLowerCase();

      const existingUser = await User.findOne({
        email: normalizedEmail,
      });

      if (existingUser) {
        failedUsers.push({
          email: normalizedEmail,
          reason: "User already exists",
        });
        continue;
      }

      const newUser = await User.create({
        username,
        email: normalizedEmail,
        password,
      });

      await Tries.create({
        user: newUser._id,
        freeTriesRemaining: 5,
        purchasedTriesRemaining: 0,
      });

      createdUsers.push({
        _id: newUser._id,
        username: newUser.username,
        email: newUser.email,
      });
    } catch (error) {
      failedUsers.push({
        email: userData.email,
        reason: error.message,
      });
    }
  }

  res.status(201).json({
    success: true,
    createdCount: createdUsers.length,
    failedCount: failedUsers.length,
    createdUsers,
    failedUsers,
  });
});

export {
  initiateRegistration,
  register,
  loginUser,
  refreshAccessToken,
  logoutCurrentUser,
  getCurrentUserProfile,
  updateCurrentUserProfile,
  generateResetPasswordLink,
  resetPassword,
  getAllUsers,
  getUserById,
  updateUserById,
  deleteUserById,
  createTestUsers
};


// ----------checked----------------------
