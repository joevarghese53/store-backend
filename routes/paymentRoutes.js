// routes/paymentRoutes.js
import express from "express";
const router = express.Router();
import { checkPaymentStatus } from "../controllers/paymentController.js";

router.get("/status", checkPaymentStatus);

export default router;
