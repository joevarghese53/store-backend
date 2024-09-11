// routes/cartRoutes.js
import express from "express";
const router = express.Router();
import { getCart, addToCart, removeFromCart, updateCartItem } from "../controllers/cartController.js";
import { authenticate } from "../middlewares/authMiddleware.js";

router.route("/")
  .get(authenticate, getCart)
  .post(authenticate, addToCart)
  .put(authenticate, updateCartItem);

router.route("/:productId")
  .delete(authenticate, removeFromCart);

export default router;
