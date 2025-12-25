// routes/phonepeRoutes.js
import express from "express";
const router = express.Router();
import { phonepeWebhook } from "../controllers/phonepeController.js";

router.post("/",  express.json({ type: "*/*" }), phonepeWebhook);

export default router;
