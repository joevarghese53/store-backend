// triesRoutes.js
import express from "express";
import {
    getUserTries,
    useTry,
    purchaseTries,
    initiatePayment,
    checkPaymentStatus,
} from "../controllers/triesController.js";

import { authenticate } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.route("/").get(authenticate, getUserTries);
router.route("/use").put(authenticate, useTry);
router.route("/purchase").post(authenticate, purchaseTries);
router.route("/initiate-payment").post(initiatePayment);
router.route("/status").post(checkPaymentStatus);

export default router;
