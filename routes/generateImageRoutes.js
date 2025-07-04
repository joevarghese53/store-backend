import express from "express";
import { generateImage } from "../controllers/generateImageController.js";
import { authenticate } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.route("/").post(authenticate, generateImage);

export default router;