// models/cartModel.js
import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: "items.productType" },
  productType: { type: String, required: true, enum: ['Product', 'customProduct'] },
  quantity: { type: Number, required: true, default: 1 },
  size: { type: String, required: true },
});


const cartSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [cartItemSchema],
  },
  { timestamps: true }
);

export default mongoose.model("Cart", cartSchema);
