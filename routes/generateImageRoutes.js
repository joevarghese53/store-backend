import express from "express";
import { generateImage } from "../controllers/generateImageController.js";

const router = express.Router();

router.route("/").post(authenticate, generateImage);

export default router;