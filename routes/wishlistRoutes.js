// routes/cartRoutes.js
import express from "express";
const router = express.Router();
import { getWishlist, addToWishlist, removeFromWishlist, checkItemInWishlist } from "../controllers/wishlistController.js";
import { authenticate } from "../middlewares/authMiddleware.js";

router.route("/")
  .get(authenticate, getWishlist)
  .post(authenticate, addToWishlist)

router.route("/:productId")
  .delete(authenticate, removeFromWishlist)
  .get(authenticate, checkItemInWishlist)

export default router;
