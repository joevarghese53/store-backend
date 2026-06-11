// routes/cartRoutes.js
import express from "express";
const router = express.Router();
import { getCart, addToCart, removeFromCart, updateCartItem, removeAllOfProductFromCart, removeAllOfProductFromAllOfCart } from "../controllers/cartController.js";
import { authenticate, authorizeAdmin } from "../middlewares/authMiddleware.js";

router.route("/")
  .get(authenticate, getCart)
  .post(authenticate, addToCart)
  .put(authenticate, updateCartItem);

router.route("/removeItem/:productId")
  .delete(authenticate, removeFromCart);


//Admin Routes
router.route("/allCart/:productId")
  .delete(authenticate, authorizeAdmin, removeAllOfProductFromAllOfCart);

export default router;
