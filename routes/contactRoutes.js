import express from "express";
import {
  getContactMessages,
  submitContactMessage,
  updateContactMessageStatus,
} from "../controllers/contactController.js";
import { authenticate, authorizeAdmin } from "../middlewares/authMiddleware.js";
import checkId from "../middlewares/checkId.js";
import { rateLimiters } from "../utils/rateLimiters.js";

const router = express.Router();

router.get("/admin", authenticate, authorizeAdmin, getContactMessages);
router.patch(
  "/admin/:id",
  authenticate,
  authorizeAdmin,
  checkId,
  updateContactMessageStatus
);
router.post("/", rateLimiters.contactLimiter, submitContactMessage);

export default router;
