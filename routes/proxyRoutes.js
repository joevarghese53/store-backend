//proxyRoutes.js

import express from "express";
const router = express.Router();

import {
initiatePayment,
checkPaymentStatus,
} from "../controllers/proxyController.js";

router.route("/initiate-payment").post(initiatePayment);
router.route("/status").post(checkPaymentStatus);

export default router;
