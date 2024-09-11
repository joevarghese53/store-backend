// controllers/wishlistController.js
import Wishlist from "../models/wishlistModel.js";
import asyncHandler from "../middlewares/asyncHandler.js";

const getWishlist = asyncHandler(async (req, res) => {
    const wishlist = await Wishlist.findOne({ userId: req.user._id }).populate({
        path: 'items.productId',
        populate: {
            path: 'category', // Populate category field inside productId
            select: 'name'   // Select only the 'name' field from Category
        }
    });

    console.log(wishlist);
    if (!wishlist) {
        return res.status(404).json({ message: 'Wishlist not found' });
    }
    const transformedWishlist = wishlist.toObject();  // Convert Mongoose document to plain JS object
    transformedWishlist.items = transformedWishlist.items.map(item => {
        if (item.productId && item.productId.category) {
            // Replace category object with category name
            item.productId.category = item.productId.category.name;
        }
        return item;
    });

    res.json(transformedWishlist);
});

const addToWishlist = asyncHandler(async (req, res) => {
    const { productId } = req.body;
    if (!productId) {
        return res.status(400).json({ message: 'Product ID is required.' });
    }
    console.log(`Adding productId: ${productId} `);

    let wishlist = await Wishlist.findOne({ userId: req.user._id });

    if (wishlist) {
            const itemExists = wishlist.items.some(item => item.productId.toString() === productId);
            if (itemExists) {
                return res.status(400).json({ message: 'Product is already in the wishlist.' });
            }
            console.log(`Adding item to wishlist: ${productId}`);
            wishlist.items.push({ productId });
            console.log(wishlist);
      
    } else {
        console.log(`Wishlist not found, creating a new wishlist`);
        wishlist = new Wishlist({
            userId: req.user._id,
            items: [{ productId }],
        });
        console.log(wishlist);
    }

    await wishlist.save();
    res.status(201).json(wishlist);
});

const removeFromWishlist = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const wishlist = await Wishlist.findOne({ userId: req.user._id });

    if (wishlist) {
        wishlist.items = wishlist.items.filter(item => item.productId != productId);
        await wishlist.save();
        res.json(wishlist);
    } else {
        res.status(404).json({ message: 'Wishlist not found' });
    }
});

export { getWishlist, addToWishlist, removeFromWishlist };