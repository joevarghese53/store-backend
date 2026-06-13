// controllers/wishlistController.js
import Wishlist from "../models/wishlistModel.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import Product from "../models/productModel.js";

// @desc    Get current user's wishlist
// @route   GET /api/wishlist
// @access  Private
const getWishlist = asyncHandler(async (req, res) => {
  const wishlistDoc = await Wishlist.findOne({
    userId: req.user._id,
  }).populate({
    path: "items",
    populate: { path: "category" },
  });

  if (!wishlistDoc) {
    return res.json({
      userId: req.user._id,
      items: [],
    });
  }

  const validItems = wishlistDoc.items.filter(Boolean);

  if (validItems.length !== wishlistDoc.items.length) {
    await Wishlist.updateOne(
      { _id: wishlistDoc._id },
      {
        $set: {
          items: validItems.map(item => item._id),
        },
      }
    );
  }

  return res.json({
    ...wishlistDoc.toObject(),
    items: validItems,
  });
});

// @desc    Add product to wishlist
// @route   POST /api/wishlist
// @access  Private
const addToWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.body;

  if (!productId) {
    res.status(400);
    throw new Error("Product ID is required");
  }

  const product = await Product.findById(productId);

  if (!product) {
    return res.status(404).json({
      message: "Product not found",
    });
  }

  const wishlist = await Wishlist.findOneAndUpdate(
    { userId: req.user._id },
    {
      $setOnInsert: { userId: req.user._id },
      $addToSet: { items: productId },
    },
    { new: true, upsert: true }
  );

  return res.status(201).json(wishlist);
});


// @desc    Remove one product from current user's wishlist
// @route   DELETE /api/wishlist/:productId
// @access  Private
const removeFromWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const wishlist = await Wishlist.findOneAndUpdate(
    { userId: req.user._id },
    { $pull: { items: productId } },
    { new: true }
  );

  if (!wishlist) {
    res.status(404);
    throw new Error("Wishlist not found");
  }

  return res.json(wishlist);
});


// @desc    Check if a product is in current user's wishlist
// @route   GET /api/wishlist/:productId
// @access  Private
const checkItemInWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const exists = await Wishlist.exists({
    userId: req.user._id,
    items: productId,
  });

  return res.json({ exists: Boolean(exists) });
});

// @desc    Remove a product from all users' wishlists (admin)
// @route   DELETE /api/wishlist/all/:productId
// @access  Admin
const removeFromAllWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  if (process.env.NODE_ENV === "development") {
    console.log("Removing product from all wishlists:", productId);
  }

  await Wishlist.updateMany(
    {},
    { $pull: { items: productId } }
  );

  return res.json({ success: true });
});


export {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  checkItemInWishlist,
  removeFromAllWishlist,
};



// -----------------------Checked -------------------------