// triesRoutes.js
import express from "express";
import {
    getUserTries,
    useTry,
    initiatePayment,
    checkPaymentStatus,
} from "../controllers/triesController.js";
import { authenticate } from "../middlewares/authMiddleware.js";
import { createRateLimiter } from "../utils/rateLimit.js";

const router = express.Router();
const purchaseTriesLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
});

router.route("/").get(authenticate, getUserTries);
router.route("/use").put(authenticate, useTry);
router.route("/purchase-tries").post(authenticate, purchaseTriesLimiter, initiatePayment);
router.get("/status", checkPaymentStatus);

export default router;
