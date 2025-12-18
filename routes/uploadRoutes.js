import express from "express";
import { authenticate, authorizeAdmin } from "../middlewares/authMiddleware.js";
import { uploadFields } from "../utils/multer.js";
import { uploadImages } from "../controllers/uploadController.js";

const router = express.Router();

router.post(
  "/",
  authenticate,
  authorizeAdmin,
  uploadFields,
  uploadImages
);

export default router;

// ------------------- Checked -------------------------
