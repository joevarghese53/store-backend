// userController.js
import User from "../models/userModel.js";
import Tries from "../models/triesModel.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import bcrypt from "bcryptjs";
import generateTokens from "../utils/createToken.js";
import crypto from "crypto";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const createUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: "Please fill all the inputs." });
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    return res.status(400).json({ message: "User with this email already exists." });
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  const newUser = new User({ username, email, password: hashedPassword });

  try {
    await newUser.save();

    // Set tokens
    const accessToken = generateTokens(res, newUser._id);

    // Initialize free tries
    const newTries = new Tries({
      user: newUser._id,
      freeTriesRemaining: 5,
      purchasedTriesRemaining: 0,
    });
    await newTries.save();

    res.status(201).json({
      success: true,
      _id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      isAdmin: newUser.isAdmin,
      accessToken,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("Please provide both email and password.");
  }

  const existingUser = await User.findOne({ email });
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
    accessToken, // return short-lived access token
  });
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  console.log("Received refresh token request");
  const token = req.cookies.refreshToken?.replace(/^"|"$/g, ""); // Remove leading/trailing quotes
  console.log("🍪 All cookies:", req.cookies);
  console.log("➡️ Refresh token received:", req.cookies.refreshToken);

  if (!token) {
    res.status(401);
    throw new Error("No refresh token provided");
  }

  try {
    
    console.log("Token about to verify:", token);
    console.log("Secret used:", process.env.JWT_REFRESH_SECRET.slice(0, 10) + '...');
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    console.log("Decoded refresh token:", decoded);
    const accessToken = jwt.sign({ userId: decoded.userId }, process.env.JWT_SECRET, {
      expiresIn: "15m",
    });

    res.status(200).json({ accessToken });
  } catch (err) {
    res.status(403);
    throw new Error(err.message || "Invalid refresh token");
  }
});

const logoutCurrentUser = asyncHandler(async (req, res) => {
  console.log("Logging out user, clearing refresh token cookie");
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
    path: '/', // must match path used when setting the cookie
  });

  console.log("Refresh token cleared:", res.getHeader("Set-Cookie"));

  res.status(200).json({ message: "Logged out successfully" });
});

const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find({});
  res.json(users);
});

const getCurrentUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
    });
  } else {
    res.status(404);
    throw new Error("User not found.");
  }
});

const updateCurrentUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    user.username = req.body.username || user.username;
    user.email = req.body.email || user.email;

    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(req.body.password, salt);
      user.password = hashedPassword;
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      username: updatedUser.username,
      email: updatedUser.email,
      isAdmin: updatedUser.isAdmin,
    });
  } else {
    res.status(404);
    throw new Error("User not found");
  }
});

const deleteUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (user) {
    if (user.isAdmin) {
      res.status(400);
      throw new Error("Cannot delete admin user");
    }

    await User.deleteOne({ _id: user._id });
    res.json({ message: "User removed" });
  } else {
    res.status(404);
    throw new Error("User not found.");
  }
});

const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("-password");

  if (user) {
    res.json(user);
  } else {
    res.status(404);
    throw new Error("User not found");
  }
});

const updateUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (user) {
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
  } else {
    res.status(404);
    throw new Error("User not found");
  }
});

const generateResetPasswordLink = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email: email });
    if (!user) {
      await sleep(2000); // Delay response to prevent email enumeration attacks
      return res.status(200).json({ message: "If a user with this email exists, a reset link will be sent." });
    }
    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    user.resetPasswordExpires = Date.now() + 30 * 60 * 1000; // 30 minutes
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/ResetPassword/${resetToken}`;

    const transporter = nodemailer.createTransport({
      host: 'smtp.zeptomail.in',
      port: 587,
      auth: {
        user: 'emailapikey',
        pass: process.env.ZEPTO_API_KEY,
      },
    });

    // Email content
    const mailOptions = {
      from: `"Flow State" <noreply@flowstateproject.in>`, // sender address
      to: email, // recipient email from order
      subject: 'Password Reset Request', // Subject line
      html: `
          <h1>Reset Your Password</h1>
          <p>Click the link below to reset your password</p>
          <a href="${resetUrl}">Reset Password</a>
          <p>If you did not request a password reset, please ignore this email</p>
          <p>Please do not reply to this email as it is sent from an unmonitored address.</p>
          <p>For any queries, please contact us at <a href="mailto:info@flowstateproject.in"></p>
      `,
    };

    // Send the email
    let info = await transporter.sendMail(mailOptions);
    console.log('Message sent: %s', info.messageId);
    res.status(200).json({ message: "If a user with this email exists, a reset link will be sent." });
  }
  catch (error) {
    res.status(500).json({ message: error.message });
  }
}

const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  try {

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
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({ message: "Password reset successfully" });
  }
  catch (error) {
    res.status(500).json({ message: error.message });
  }
}

const checkUserExists = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    res.status(400);
    throw new Error("Email is required");
  }
  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(200).json({ exists: true });
  }
  else {
    res.status(200).json({ exists: false });
  }
});



export {
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
  checkUserExists
};