// controllers/cartController.js
import Cart from "../models/cartModel.js";
import Product from "../models/productModel.js";
import cProduct from "../models/cProductModel.js";
import asyncHandler from "../middlewares/asyncHandler.js";

// const getCart = asyncHandler(async (req, res) => {

//   const cart = await Cart.findOne({ userId: req.user._id });
//   console.log('Cart:', cart);
//   if (!cart) {
//     return res.status(404).json({ message: 'Cart not found' });
//   }
  
//   const transformedWishlist = cart.toObject();  // Convert Mongoose document to plain JS object
//     transformedWishlist.items = transformedWishlist.items.map(item => {
//         if (item.productId && item.productId.category) {
//             // Replace category object with category name
//             item.productId.category = item.productId.category.name;
//         }
//         return item;
//     });

//     res.json(transformedWishlist);
// });


const getCart = asyncHandler(async (req, res) => {
  // Find the cart for the user
  const cart = await Cart.findOne({ userId: req.user._id });

  if (!cart) {
    return res.status(404).json({ message: 'Cart not found' });
  }

  // Populate product data based on productType
  const populatedItems = await Promise.all(cart.items.map(async item => {
    if (item.productType === 'Product') {
      // Populate Product details
      const product = await Product.findById(item.productId).populate({
        path: 'category',
        select: 'name'
      });
      return {
        ...item.toObject(),
        productId: {
          ...product.toObject(),
          category: product.category.name // Replace category object with name
        },
      };
    } else if (item.productType === 'CustomProduct') {
      // Populate CustomProduct details
      const cProductDoc = await cProduct.findOne({ userId: req.user._id }).populate({
        path: 'customProducts.category',
        select: 'name'
      });
      const customProduct = cProductDoc.customProducts.id(item.productId);
      return {
        ...item.toObject(),
        productId: {
          ...customProduct.toObject(),
          category: customProduct.category.name // Replace category object with name
        },
      };
    }
  }));

  // Return the transformed cart with populated items
  res.json({
    ...cart.toObject(),
    items: populatedItems,
  });
});


// const addToCart = asyncHandler(async (req, res) => {
//   const { productId, quantity } = req.body;
//   if (!productId || !quantity) {
//     return res.status(400).json({ message: 'Product ID and quantity are required.' });
//   }
//   console.log(`Adding productId: ${productId}, quantity: ${quantity}`);

//   let cart = await Cart.findOne({ userId: req.user._id });

//   if (cart) {
//     const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
//     if (itemIndex > -1) {
//       console.log(`Item found in cart, updating quantity from ${cart.items[itemIndex].quantity} to ${cart.items[itemIndex].quantity + quantity}`);
//       cart.items[itemIndex].quantity += quantity;
//     } else {
//       console.log(`Item not found in cart, adding new item with quantity ${quantity}`);
//       cart.items.push({ productId, quantity });
//     }
//   } else {
//     console.log(`Cart not found, creating a new cart with item quantity ${quantity}`);
//     cart = new Cart({
//       userId: req.user._id,
//       items: [{ productId, quantity }],
//     });
//   }

//   await cart.save();
//   res.status(201).json(cart);
// });

const addToCart = asyncHandler(async (req, res) => {
  const { productId, productType, quantity  } = req.body;

  console.log(req.body);

  // Check if required fields are provided
  if (!productId || !quantity || !productType) {
    return res.status(400).json({ message: 'Product ID, quantity, and product type are required.' });
  }

  // Determine which model to check based on productType
  let product;
  if (productType === 'Product') {
    product = await Product.findById(productId);
  }else if (productType === 'CustomProduct') {
    // Find the cProduct document that contains the customProduct
    const cProductDoc = await cProduct.findOne({ userId: req.user._id });

    if (cProductDoc) {
      // Search for the customProduct in the customProducts array by its _id
      product = cProductDoc.customProducts.id(productId);
    }
  }
  console.log("Product:", product);

  // Check if product exists
  if (!product) {
    return res.status(404).json({ message: 'Product not found.' });
  }

  // Find or create the cart
  let cart = await Cart.findOne({ userId: req.user._id });

  if (cart) {
    // Check if the product is already in the cart
    console.log('Cart found:', cart);
    const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId && item.productType === productType);

    if (itemIndex > -1) {
      // If the product is in the cart, update the quantity
      cart.items[itemIndex].quantity += quantity;
    } else {
      // If the product is not in the cart, add it
      cart.items.push({ productId, productType, quantity  });
    }
  } else {
    // If no cart exists, create one with the new item
    cart = new Cart({
      userId: req.user._id,
      items: [{ productId, productType, quantity }],
    });
  }
  console.log('Saving cart:', cart);
  // Save the cart
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

const clearCart = async (user_Id) => {
  try {
    const cart = await Cart.findOne({ userId: user_Id });

    if (cart) {
      console.log('Cart before clearing:', cart); // Log cart before clearing
      cart.items = [];  // Clear all items from the cart
      await cart.save();
      console.log('Cart after clearing:', cart); // Log cart after clearing
    } else {
      throw new Error("Cart not found");
    }
  } catch (error) {
    console.error('Error clearing cart:', error); // Log any errors
    return { success: false, message: error.message };
  }
};

export { getCart, addToCart, removeFromCart, updateCartItem, clearCart };
