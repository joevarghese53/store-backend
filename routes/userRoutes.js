// userRoutes.js
import express from "express";
import {
  initiateRegistration, createUser, refreshAccessToken, loginUser, logoutCurrentUser, getAllUsers, getCurrentUserProfile,
  updateCurrentUserProfile, deleteUserById, getUserById, updateUserById, generateResetPasswordLink, resetPassword
} from "../controllers/userController.js";
import { authenticate, authorizeAdmin } from "../middlewares/authMiddleware.js";
import { createRateLimiter } from "../utils/rateLimit.js";

// RateLimiters
const initiateRegistrationLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: "Too many OTP requests. Try again in a minute."
});

const refreshLimiter = createRateLimiter({ windowMs: 60*1000, max: 30 });

const router = express.Router();

router.post("/initiate-registration", initiateRegistrationLimiter, initiateRegistration);
router.post("/register", createUser)
router.post("/login", loginUser);
router.post("/logout", logoutCurrentUser);
router.post("/refresh-token" , refreshLimiter, refreshAccessToken);
router
  .route("/profile")
  .get(authenticate, getCurrentUserProfile)
  .put(authenticate, updateCurrentUserProfile);
router.post("/resetPasswordLink", generateResetPasswordLink);
router.post("/resetPassword", resetPassword);

// ADMIN ROUTES 👇
router.get("/admin/allUsers", authenticate, authorizeAdmin, getAllUsers);
router
  .route("/admin/:id")
  .get(authenticate, authorizeAdmin, getUserById)
  .put(authenticate, authorizeAdmin, updateUserById)
  .delete(authenticate, authorizeAdmin, deleteUserById);


export default router;
