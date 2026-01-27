import ShippingAddress from "../models/shippingAddressModel.js";
import asyncHandler from "../middlewares/asyncHandler.js";

const createShippingAddress = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    res.status(401);
    throw new Error("User not authenticated");
  }

  const {
    fullName,
    addressLine1,
    addressLine2,
    landmark,
    city,
    state,
    postalCode,
    phoneNumber,
    label,
  } = req.body;

  console.log(req.body);
  if (!fullName || !addressLine1 || !city || !state || !postalCode || !phoneNumber) {
    res.status(400);
    throw new Error("All required address fields must be provided");
  }

  const existingCount = await ShippingAddress.countDocuments({ user: userId });

  const address = await ShippingAddress.create({
    user: userId,
    fullName,
    addressLine1,
    addressLine2,
    landmark,
    city,
    state,
    postalCode,
    phoneNumber,
    label: label || "Home",
    isDefault: existingCount === 0,
  });

  res.status(201).json(address);
});

const getUserShippingAddresses = asyncHandler(async (req, res) => {
  const addresses = await ShippingAddress.find({ user: req.user._id }).sort({
    isDefault: -1,
    createdAt: -1,
  });

  res.json(addresses);
});

const updateShippingAddress = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const updateData = {
    fullName: req.body.fullName,
    addressLine1: req.body.addressLine1,
    addressLine2: req.body.addressLine2,
    landmark: req.body.landmark,
    city: req.body.city,
    state: req.body.state,
    postalCode: req.body.postalCode,
    phoneNumber: req.body.phoneNumber,
    label: req.body.label,
  };

  // Remove undefined fields
  Object.keys(updateData).forEach(
    (key) => updateData[key] === undefined && delete updateData[key]
  );

  const updatedAddress = await ShippingAddress.findOneAndUpdate(
    { _id: id, user: req.user._id },
    { $set: updateData },
    { new: true, runValidators: true }
  );

  if (!updatedAddress) {
    res.status(404);
    throw new Error("Address not found");
  }

  res.json(updatedAddress);
});

const deleteShippingAddress = asyncHandler(async (req, res) => {
  const address = await ShippingAddress.findOne({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!address) {
    res.status(404);
    throw new Error("Address not found");
  }

  if (address.isDefault) {
    res.status(400);
    throw new Error("Cannot delete default address");
  }

  await address.deleteOne();

  res.json({ message: "Address deleted" });
});

const setDefaultShippingAddress = asyncHandler(async (req, res) => {
  const address = await ShippingAddress.findOne({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!address) {
    res.status(404);
    throw new Error("Address not found");
  }

  address.isDefault = true;
  await address.save(); // schema + index handle the rest

  res.json(address);
});

export {
  createShippingAddress,
  getUserShippingAddresses,
  updateShippingAddress,
  deleteShippingAddress,
  setDefaultShippingAddress,
};


// -------------------- Checked --------------------