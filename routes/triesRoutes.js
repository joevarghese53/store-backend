// triesRoutes.js
import express from "express";
import {
    getUserTries,
    useTry,
    initiatePayment,
} from "../controllers/triesController.js";
import { authenticate } from "../middlewares/authMiddleware.js";
import { rateLimiters } from "../utils/rateLimiters.js";

const router = express.Router();

router.route("/").get(authenticate, getUserTries);
router.route("/use").put(authenticate, useTry);
router.route("/purchase-tries").post(authenticate, rateLimiters.purchaseTriesLimiter, initiatePayment);

export default router;

// ------------------------Checked -------------------------