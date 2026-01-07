import express from "express";
import {
  generateImage,
  getJobStatus,
  getQueuePositionOfJob,
} from "../controllers/generateImageController.js";
import { authenticate } from "../middlewares/authMiddleware.js";
import { rateLimiters } from "../utils/rateLimiters.js";

const router = express.Router();

router.post("/", authenticate, rateLimiters.generateLimiter, generateImage);
router.get("/status/:id", authenticate, rateLimiters.statusLimiter, getJobStatus);
router.get("/queue-position/:id", authenticate, rateLimiters.queueLimiter, getQueuePositionOfJob);

export default router;
