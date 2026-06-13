// cProductRoutes.js
import express from "express";
const router = express.Router();
import formidable from "express-formidable";
import { addToCProducts, getCProducts, deleteCProduct, fetchCProductById } from "../controllers/cProductController.js";
import { authenticate } from "../middlewares/authMiddleware.js";

router.route("/")
    .post(authenticate, formidable(), addToCProducts)
    .get(authenticate, getCProducts);
router.route("/:productId")
    .delete(authenticate, deleteCProduct)
    .get(authenticate, fetchCProductById);

export default router;