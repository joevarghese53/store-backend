// controllers/cartController.js
import Cart from "../models/cartModel.js";
import Product from "../models/productModel.js";
import cProduct from "../models/cProductModel.js";
import asyncHandler from "../middlewares/asyncHandler.js";

const getCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ userId: req.user._id });

  if (!cart) {
    return res.json({ userId: req.user._id, items: [] });
  }

  const cProductDoc = await cProduct
    .findOne({ userId: req.user._id })
    .populate("customProducts.category", "name");

  const populatedItems = await Promise.all(
    cart.items.map(async (item) => {
      if (item.productType === "Product") {
        const product = await Product.findById(item.productId).populate(
          "category",
          "name"
        );

        if (!product) {
          return {
            ...item.toObject(),
            productId: null,
          };
        }

        return {
          ...item.toObject(),
          productId: {
            ...product.toObject(),
            category: product.category?.name || null,
          },
        };
      }

      if (item.productType === "cProduct" && cProductDoc) {
        const customProduct = cProductDoc.customProducts.id(item.productId);

        if (!customProduct) {
          return {
            ...item.toObject(),
            productId: null,
          };
        }

        return {
          ...item.toObject(),
          productId: {
            ...customProduct.toObject(),
            category: customProduct.category?.name || null,
          },
        };
      }

      return {
        ...item.toObject(),
        productId: null,
      };
    })
  );

  res.json({
    ...cart.toObject(),
    items: populatedItems,
  });
});

const addToCart = asyncHandler(async (req, res) => {
  const { productId, productType, quantity, size } = req.body;

  if (!productId || !productType || !size) {
    return res
      .status(400)
      .json({ message: "Product ID, product type and size are required." });
  }

  const qty = Number(quantity);

  if (!qty || qty <= 0) {
    return res
      .status(400)
      .json({ message: "Quantity must be a positive number." });
  }

  if (!["Product", "cProduct"].includes(productType)) {
    return res.status(400).json({ message: "Invalid product type." });
  }

  let product;

  if (productType === "Product") {
    product = await Product.findById(productId);
  } else if (productType === "cProduct") {
    const cProductDoc = await cProduct.findOne({ userId: req.user._id });

    if (cProductDoc) {
      product = cProductDoc.customProducts.id(productId);
    }
  }

  if (!product) {
    return res.status(404).json({ message: "Product not found." });
  }

  let cart = await Cart.findOne({ userId: req.user._id });

  if (cart) {
    const itemIndex = cart.items.findIndex(
      (item) =>
        item.productId.toString() === productId &&
        item.productType === productType &&
        item.size === size
    );

    if (itemIndex > -1) {
      // Update quantity for same product+size
      cart.items[itemIndex].quantity += qty;
    } else {
      cart.items.push({ productId, productType, quantity: qty, size });
    }
  } else {
    cart = new Cart({
      userId: req.user._id,
      items: [{ productId, productType, quantity: qty, size }],
    });
  }

  await cart.save();
  res.status(201).json(cart);
});

const removeFromCart = asyncHandler(async (req, res) => {
  const { id: productId } = req.params;   
  const { size } = req.body;              

  if (!productId || !size) {
    return res.status(400).json({ message: "Product ID and size are required" });
  }

  const cart = await Cart.findOne({ userId: req.user._id });

  if (!cart) {
    return res.status(404).json({ message: "Cart not found" });
  }

  const initialLength = cart.items.length;

  cart.items = cart.items.filter(
    (item) =>
      item.productId.toString() !== productId || item.size !== size
  );

  if (cart.items.length === initialLength) {
    return res.status(404).json({ message: "Item not found in cart" });
  }

  await cart.save();
  res.json(cart);
});

const updateCartItem = asyncHandler(async (req, res) => {
  const { productId, quantity, size } = req.body;

  if (!productId || !size) {
    return res
      .status(400)
      .json({ message: "Product ID and size are required" });
  }

  const qty = Number(quantity);

  if (!qty || qty <= 0) {
    return res
      .status(400)
      .json({ message: "Quantity must be a positive number" });
  }

  const cart = await Cart.findOne({ userId: req.user._id });

  if (!cart) {
    return res.status(404).json({ message: "Cart not found" });
  }

  const itemIndex = cart.items.findIndex(
    (item) =>
      item.productId.toString() === productId && item.size === size
  );

  if (itemIndex === -1) {
    return res.status(404).json({ message: "Item not found in cart" });
  }

  cart.items[itemIndex].quantity = qty;
  await cart.save();

  res.json(cart);
});

const clearCart = async (userId) => {
  try {
    const result = await Cart.updateOne(
      { userId },
      { $set: { items: [] } }
    );

    return { success: true };
  } catch (error) {
    console.error("Error clearing cart:", error.message);
    return { success: false, message: error.message };
  }
};

const removeAllOfProductFromCart = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  if (!productId) {
    return res.status(400).json({ message: "Product ID is required" });
  }

  const cart = await Cart.findOne({ userId: req.user._id });

  if (!cart) {
    return res.json({ success: true });
  }

  const initialLength = cart.items.length;

  cart.items = cart.items.filter(
    (item) => item.productId.toString() !== productId.toString()
  );

  if (cart.items.length === initialLength) {
    // Product not present in cart, still ok
    return res.json({ success: true, message: "Product not found in cart" });
  }

  await cart.save();

  res.json({ success: true });
});

const removeAllOfProductFromAllOfCart = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  if (!productId) {
    return res.status(400).json({ message: "Product ID is required" });
  }

  try {
    await Cart.updateMany(
      { "items.productId": productId },
      { $pull: { items: { productId } } }
    );

    // Even if no carts had that product, it's still a success
    res.json({ success: true });
  } catch (error) {
    console.error("Error removing product from all carts:", error);
    res
      .status(500)
      .json({ message: "Error removing product from all carts" });
  }
});

export { getCart, addToCart, removeFromCart, updateCartItem, clearCart, removeAllOfProductFromCart, removeAllOfProductFromAllOfCart };
