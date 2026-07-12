import express from "express";
import {
  generateImage
} from "../controllers/generateImageController.js";
import { authenticate } from "../middlewares/authMiddleware.js";
import { rateLimiters } from "../utils/rateLimiters.js";

const router = express.Router();

router.post("/", rateLimiters.generateLimiter, authenticate, generateImage);

export default router;
