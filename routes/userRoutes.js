// userRoutes.js
import express from "express";
import {
  initiateRegistration, createUser, refreshAccessToken, loginUser, logoutCurrentUser, getAllUsers, getCurrentUserProfile,
  updateCurrentUserProfile, deleteUserById, getUserById, updateUserById, generateResetPasswordLink, resetPassword
} from "../controllers/userController.js";
import { authenticate, authorizeAdmin } from "../middlewares/authMiddleware.js";
import { rateLimiters } from "../utils/rateLimiters.js";

const router = express.Router();

router.post("/initiate-registration", rateLimiters.initiateRegistrationLimiter, initiateRegistration);
router.post("/register", createUser)
router.post("/login", loginUser);
router.post("/logout", logoutCurrentUser);
router.post("/refresh-token" , rateLimiters.refreshLimiter, refreshAccessToken);
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


// -----------------------Checked -------------------------