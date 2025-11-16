// controllers/shippingAddressController.js
import ShippingAddress from "../models/shippingAddressModel.js";
import asyncHandler from "../middlewares/asyncHandler.js";

// @desc    Create new shipping address
// @route   POST /api/shipping
// @access  Private
const createShippingAddress = asyncHandler(async (req, res) => {
  const { address, city, postalCode, state, country, phoneno, fullName, label } = req.body;
  const userId = req.user?._id;

  if (!userId) {
    res.status(401);
    throw new Error("User not authenticated");
  }

  // Basic validation – you can expand this if you want stricter checks
  if (!fullName || !address || !city || !postalCode || !state || !country || !phoneno) {
    res.status(400);
    throw new Error("All required address fields must be provided");
  }

  // Count how many addresses the user already has
  const existingCount = await ShippingAddress.countDocuments({ user: userId });

  const newAddress = new ShippingAddress({
    user: userId,
    fullName,
    address,
    city,
    postalCode,
    state,
    country,
    phoneno,
    label: label || "Home",
    isDefault: existingCount === 0, // first address becomes default
  });

  const savedAddress = await newAddress.save();
  res.status(201).json(savedAddress);
});

// @desc    Get all shipping addresses for current user
// @route   GET /api/shipping
// @access  Private
const getUserShippingAddresses = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    res.status(401);
    throw new Error("User not authenticated");
  }

  const addresses = await ShippingAddress.find({ user: userId }).sort({
    isDefault: -1, // default address first
    createdAt: -1,
  });

  res.json(addresses);
});

// @desc    Update a shipping address (only own)
// @route   PUT /api/shipping/:id
// @access  Private
const updateShippingAddress = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { fullName, address, city, postalCode, state, country, phoneno, label } = req.body;

  const updatedAddress = await ShippingAddress.findOneAndUpdate(
    { _id: id, user: req.user._id }, // ensure address belongs to current user
    { fullName, address, city, postalCode, state, country, phoneno, label },
    { new: true, runValidators: true }
  );

  if (!updatedAddress) {
    res.status(404);
    throw new Error("Address not found");
  }

  res.json(updatedAddress);
});

// @desc    Delete a shipping address (only own)
// @route   DELETE /api/shipping/:id
// @access  Private
const deleteShippingAddress = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const deletedAddress = await ShippingAddress.findOneAndDelete({
    _id: id,
    user: req.user._id,
  });

  if (!deletedAddress) {
    res.status(404);
    throw new Error("Address not found");
  }

  // If they deleted the default address, optionally you might want to promote another one to default.
  // You can add that logic here later if you want.

  res.json({ message: "Address deleted" });
});

// @desc    Set a default shipping address
// @route   PATCH /api/shipping/:id/default
// @access  Private
const setDefaultShippingAddress = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const address = await ShippingAddress.findOne({ _id: id, user: userId });

  if (!address) {
    res.status(404);
    throw new Error("Address not found");
  }

  // Unset any other default addresses of this user
  await ShippingAddress.updateMany(
    { user: userId, _id: { $ne: id }, isDefault: true },
    { $set: { isDefault: false } }
  );

  // Set this one as default if not already
  if (!address.isDefault) {
    address.isDefault = true;
    await address.save();
  }

  res.json(address);
});

export {
  createShippingAddress,
  getUserShippingAddresses,
  updateShippingAddress,
  deleteShippingAddress,
  setDefaultShippingAddress,
};
