import mongoose from "mongoose";

const shippingAddressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
  city: {
    type: String,
    required: true,
  },
  postalCode: {
    type: String,
    required: true,
  },
  country: {
    type: String,
    required: true,
  },
  phoneno: {
    type: Number,
    required: true,
  },
}, { timestamps: true });

export default mongoose.model("ShippingAddress", shippingAddressSchema);
