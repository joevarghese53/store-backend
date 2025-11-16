import express from "express";
import {
  generateImage,
  getJobStatus,
  getQueuePositionOfJob,
} from "../controllers/generateImageController.js";
import { authenticate } from "../middlewares/authMiddleware.js";
import { createRateLimiter } from "../utils/rateLimit.js";

const router = express.Router();

// Strict limiter for expensive AI generation
const generateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 3,              // 3 images/minute
  message: "Rate limit exceeded. Wait one minute before generating again."
});

// Medium limiter for job status checks
const statusLimiter = createRateLimiter({
  windowMs: 30 * 1000, // 30 seconds
  max: 15              // 15 checks/30s
});

// Medium limiter for queue position checks
const queueLimiter = createRateLimiter({
  windowMs: 30 * 1000,
  max: 15
});

router.post("/", authenticate, generateLimiter, generateImage);
router.get("/status/:id", authenticate, statusLimiter, getJobStatus);
router.get("/queue-position/:id", authenticate, queueLimiter, getQueuePositionOfJob);

export default router;
