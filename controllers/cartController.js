// controllers/cartController.js
import Cart from "../models/cartModel.js";
import asyncHandler from "../middlewares/asyncHandler.js";

const getCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ userId: req.user._id }).populate('items.productId');
  if (!cart) {
    return res.status(404).json({ message: 'Cart not found' });
  }
  res.json(cart);
});

const addToCart = asyncHandler(async (req, res) => {
  const { productId, quantity } = req.body;
  console.log(`Adding productId: ${productId}, quantity: ${quantity}`);

  let cart = await Cart.findOne({ userId: req.user._id });

  if (cart) {
    const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
    if (itemIndex > -1) {
      console.log(`Item found in cart, updating quantity from ${cart.items[itemIndex].quantity} to ${cart.items[itemIndex].quantity + quantity}`);
      cart.items[itemIndex].quantity += quantity;
    } else {
      console.log(`Item not found in cart, adding new item with quantity ${quantity}`);
      cart.items.push({ productId, quantity });
    }
  } else {
    console.log(`Cart not found, creating a new cart with item quantity ${quantity}`);
    cart = new Cart({
      userId: req.user._id,
      items: [{ productId, quantity }],
    });
  }

  await cart.save();
  res.status(201).json(cart);
});

const removeFromCart = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const cart = await Cart.findOne({ userId: req.user._id });

  if (cart) {
    cart.items = cart.items.filter(item => item.productId != productId);
    await cart.save();
    res.json(cart);
  } else {
    res.status(404).json({ message: 'Cart not found' });
  }
});

const updateCartItem = asyncHandler(async (req, res) => {
  const { productId, quantity } = req.body;
  const cart = await Cart.findOne({ userId: req.user._id });

  if (cart) {
    const itemIndex = cart.items.findIndex(item => item.productId == productId);
    if (itemIndex > -1) {
      cart.items[itemIndex].quantity = quantity;
      await cart.save();
      res.json(cart);
    } else {
      res.status(404).json({ message: 'Item not found in cart' });
    }
  } else {
    res.status(404).json({ message: 'Cart not found' });
  }
});

export { getCart, addToCart, removeFromCart, updateCartItem };
