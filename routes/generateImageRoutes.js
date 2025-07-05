//generateImageRoutes.js
import express from "express";
import { generateImage, getJobStatus, getQueuePositionOfJob } from "../controllers/generateImageController.js";
import { authenticate } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.route("/").post(authenticate, generateImage);
router.route("/status/:id").get(authenticate, getJobStatus)
router.route("/queue-position/:id").get(authenticate, getQueuePositionOfJob);

export default router;