// productModel.js
import mongoose from "mongoose";
const { ObjectId } = mongoose.Schema;

const reviewSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
  },
  { timestamps: true }
);

const productSchema = mongoose.Schema(
  {
    name: { type: String, required: true },

    frontImage: { type: String },
    backImage: { type: String },
    frontDesign: { type: String },
    backDesign: { type: String },
    images: [{ type: String }],
    category: { type: ObjectId, ref: "Category", required: true },
    description: { type: String, required: true },
    reviews: [reviewSchema],
    rating: { type: Number, required: true, default: 0 },
    numReviews: { type: Number, required: true, default: 0 },
    price: { type: Number, required: true, default: 0 },
    countInStock: { type: Number, required: true, default: 1 },
    offers: { type: String, default: "" },
    returnPolicy: { type: String, default: "" },
  },
  { timestamps: true }
);

productSchema.index({ category: 1 });
productSchema.index({ rating: -1 });

const Product = mongoose.model("Product", productSchema);
export default Product;
