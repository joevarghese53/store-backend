import express from "express";
import { submitContactMessage } from "../controllers/contactController.js";
import { rateLimiters } from "../utils/rateLimiters.js";

const router = express.Router();

router.post("/", rateLimiters.contactLimiter, submitContactMessage);

export default router;
