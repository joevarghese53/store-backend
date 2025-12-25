// routes/paymentRoutes.js
import express from "express";
const router = express.Router();
import { checkPaymentStatus } from "../controllers/paymentController.js";

router.post("/status", checkPaymentStatus);

export default router;
