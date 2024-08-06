import ShippingAddress from "../models/shippingAddressModel.js";
import asyncHandler from "../middlewares/asyncHandler.js";

const createShippingAddress = asyncHandler(async (req, res) => {
    try {
      const { address, city, postalCode, country, phoneno } = req.body;
      const userId = req.user._id;
  
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
  
      const newAddress = new ShippingAddress({
        user: userId,
        address,
        city,
        postalCode,
        country,
        phoneno
      });
  
      const savedAddress = await newAddress.save();
      res.status(201).json(savedAddress);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  });
  
  // Get all shipping addresses for a user
  const getUserShippingAddresses = asyncHandler(async (req, res) => {
    try {
      const userId = req.user._id;
  
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
  
      const addresses = await ShippingAddress.find({ user: userId });
      res.json(addresses);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  });
  
  // Update a shipping address
  const updateShippingAddress = asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      const { address, city, postalCode, country, phoneno } = req.body;
  
      const updatedAddress = await ShippingAddress.findByIdAndUpdate(
        id,
        { address, city, postalCode, country, phoneno },
        { new: true }
      );
  
      if (!updatedAddress) {
        return res.status(404).json({ error: "Address not found" });
      }
  
      res.json(updatedAddress);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  });
  
  // Delete a shipping address
  const deleteShippingAddress = asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
  
      const deletedAddress = await ShippingAddress.findByIdAndDelete(id);
  
      if (!deletedAddress) {
        return res.status(404).json({ error: "Address not found" });
      }
  
      res.json({ message: "Address deleted" });
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: error.message });
    }
  });
  
  export {
    createShippingAddress,
    getUserShippingAddresses,
    updateShippingAddress,
    deleteShippingAddress,
  };