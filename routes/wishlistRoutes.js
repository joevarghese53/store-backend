// routes/wishlistRoutes.js
import express from "express";
const router = express.Router();
import { getWishlist, addToWishlist, removeFromWishlist, checkItemInWishlist, removeFromAllWishlist } from "../controllers/wishlistController.js";
import { authenticate, authorizeAdmin } from "../middlewares/authMiddleware.js";
import checkId from "../middlewares/checkId.js";

router.route("/")
  .get(authenticate, getWishlist)
  .post(authenticate, addToWishlist)

router.route("/:id")
  .delete(authenticate, checkId, removeFromWishlist)
  .get(authenticate, checkId, checkItemInWishlist)

router.route("/all/:id")
  .delete(authenticate, authorizeAdmin, checkId, removeFromAllWishlist)

export default router;
