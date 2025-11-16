// controllers/wishlistController.js
import Wishlist from "../models/wishlistModel.js";
import asyncHandler from "../middlewares/asyncHandler.js";

// @desc    Get current user's wishlist
// @route   GET /api/wishlist
// @access  Private
const getWishlist = asyncHandler(async (req, res) => {
  const wishlist = await Wishlist.findOne({ userId: req.user._id }).populate({
    path: "items.productId",
    populate: {
      path: "category",
    },
  });

  if (!wishlist) {
    // Return an empty list instead of 404 so frontend can handle it easily
    return res.json({
      userId: req.user._id,
      items: [],
    });
  }

  res.json(wishlist.toObject());
});

// @desc    Add product to wishlist
// @route   POST /api/wishlist
// @access  Private
const addToWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.body;

  if (!productId) {
    res.status(400);
    throw new Error("Product ID is required.");
  }

  let wishlist = await Wishlist.findOne({ userId: req.user._id });

  if (!wishlist) {
    // Create wishlist if user doesn't have one yet
    wishlist = new Wishlist({
      userId: req.user._id,
      items: [{ productId }],
    });
  } else {
    const itemExists = wishlist.items.some(
      (item) => item.productId.toString() === productId
    );

    if (itemExists) {
      res.status(400);
      throw new Error("Product is already in the wishlist.");
    }

    wishlist.items.push({ productId });
  }

  const savedWishlist = await wishlist.save();
  res.status(201).json(savedWishlist);
});

// @desc    Remove one product from current user's wishlist
// @route   DELETE /api/wishlist/:productId
// @access  Private
const removeFromWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const wishlist = await Wishlist.findOne({ userId: req.user._id });

  if (!wishlist) {
    res.status(404);
    throw new Error("Wishlist not found");
  }

  const originalLength = wishlist.items.length;

  wishlist.items = wishlist.items.filter(
    (item) => item.productId.toString() !== productId
  );

  if (wishlist.items.length === originalLength) {
    // Nothing was removed
    res.status(404);
    throw new Error("Product not found in wishlist");
  }

  await wishlist.save();
  res.json(wishlist);
});

// @desc    Check if a product is in current user's wishlist
// @route   GET /api/wishlist/:productId
// @access  Private
const checkItemInWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  if (!productId) {
    res.status(400);
    throw new Error("Product ID is required.");
  }

  const wishlist = await Wishlist.findOne({ userId: req.user._id });

  if (!wishlist) {
    return res.json({ exists: false });
  }

  const itemExists = wishlist.items.some(
    (item) => item.productId.toString() === productId
  );

  res.json({ exists: itemExists });
});

// @desc    Remove a product from all users' wishlists (admin)
// @route   DELETE /api/wishlist/all/:productId
// @access  Admin
const removeFromAllWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  await Wishlist.updateMany(
    {},
    {
      $pull: {
        items: { productId },
      },
    }
  );

  res.json({ success: true });
});

export {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  checkItemInWishlist,
  removeFromAllWishlist,
};
