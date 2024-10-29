// routes/cartRoutes.js
import express from "express";
const router = express.Router();
import { getWishlist, addToWishlist, removeFromWishlist, checkItemInWishlist, removeFromAllWishlist } from "../controllers/wishlistController.js";
import { authenticate, authorizeAdmin } from "../middlewares/authMiddleware.js";

router.route("/")
  .get(authenticate, getWishlist)
  .post(authenticate, addToWishlist)

router.route("/:productId")
  .delete(authenticate, removeFromWishlist)
  .get(authenticate, checkItemInWishlist)

router.route("/all/:productId")
  .delete(authenticate, authorizeAdmin, removeFromAllWishlist)

export default router;
