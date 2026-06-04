// productRoutes.js
import express from "express";
import formidable from "express-formidable";
const router = express.Router();

// controllers
import {
  addProduct,
  updateProductDetails,
  removeProduct,
  removeProductImage,
  fetchProducts,
  fetchProductById,
  fetchAllProducts,
  addProductReview,
  fetchTopProducts,
  fetchNewProducts,
  filterProducts,
  uploadImages
} from "../controllers/productController.js";
import { authenticate, authorizeAdmin } from "../middlewares/authMiddleware.js";
import { uploadFields } from "../utils/multer.js";
import checkId from "../middlewares/checkId.js";

router.route("/").get(fetchProducts);
router.route("/allproducts").get(fetchAllProducts);
router.route("/filtered-products").post(filterProducts);
router.get("/top", fetchTopProducts);
router.get("/new", fetchNewProducts);
router.route("/reviews/add-review/:id").post(authenticate, checkId, addProductReview);
router.route("/:id").get(checkId, fetchProductById);


// Admin Routes

router.route("/admin").post(authenticate, authorizeAdmin, formidable(), addProduct)

router.delete("/admin/delete-image", authenticate, authorizeAdmin, removeProductImage);
router.post("/admin/upload-images",  authenticate, authorizeAdmin, uploadFields, uploadImages)

router.route("/admin/:id")
  .put(authenticate, authorizeAdmin, formidable(), updateProductDetails)
  .delete(authenticate, authorizeAdmin, removeProduct);

export default router;
