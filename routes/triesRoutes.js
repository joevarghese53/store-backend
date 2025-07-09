// triesRoutes.js
import express from "express";
import {
    getUserTries,
    useTry,
    initiatePayment,
    checkPaymentStatus,
} from "../controllers/triesController.js";

import { authenticate } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.route("/").get(authenticate, getUserTries);
router.route("/use").put(authenticate, useTry);
router.route("/purchase-tries").post(authenticate, initiatePayment);
router.route("/status").post(checkPaymentStatus).get(checkPaymentStatus);

export default router;
