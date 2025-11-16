//proxyRoutes.js

import express from "express";
import {
initiatePayment,
checkPaymentStatus,
} from "../controllers/proxyController.js";
import { authenticate } from "../middlewares/authMiddleware.js";
import { createRateLimiter } from "../utils/rateLimit.js";

const router = express.Router();
const paymentLimiter = createRateLimiter({
  windowMs: 60 * 1000,  // 1 minute
  max: 5,
  message: "Too many payment attempts. Try again later."
});

router.route("/initiate-payment").post(authenticate, paymentLimiter, initiatePayment);
router.get("/status", checkPaymentStatus);

export default router;
