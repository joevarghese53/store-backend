// routes/cartRoutes.js
import express from "express";
const router = express.Router();
import { getCart, addToCart, removeFromCart, updateCartItem, removeAllOfProductFromCart, removeAllOfProductFromAllOfCart } from "../controllers/cartController.js";
import { authenticate, authorizeAdmin } from "../middlewares/authMiddleware.js";

router.route("/")
  .get(authenticate, getCart)
  .post(authenticate, addToCart)
  .put(authenticate, updateCartItem);

router.route("/allCart/:id")
  .delete(authenticate, authorizeAdmin, removeAllOfProductFromAllOfCart);

router.route("/all/:id")
  .delete(authenticate, removeAllOfProductFromCart);

router.route("/:id")
  .delete(authenticate, removeFromCart);

export default router;
