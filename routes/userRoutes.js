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

const router = express.Router();

router.post("/initiate-registration", initiateRegistrationLimiter, initiateRegistration);
router.post("/register", createUser)
router.post("/login", loginUser);
router.post("/logout", logoutCurrentUser);
router.post("/refresh-token" , refreshAccessToken);
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
  .delete(authenticate, authorizeAdmin, deleteUserById)
  .get(authenticate, authorizeAdmin, getUserById)
  .put(authenticate, authorizeAdmin, updateUserById);


export default router;
