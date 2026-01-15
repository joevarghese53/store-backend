// routes/phonepeWebhookRoutes.js
import express from "express";
const router = express.Router();
import { phonepeWebhook } from "../controllers/phonepeWebhookController.js";

router.post("/",  express.json({ type: "*/*" }), phonepeWebhook);

export default router;

// ------------- Checked -----------------