// cProductModel.js
import mongoose from "mongoose";
const { ObjectId } = mongoose.Schema;

const customProductSchema = mongoose.Schema(
    {
        userId: { type: ObjectId, ref: 'User', required: true }, // Reference to the User model
        name: { type: String, required: true },
        frontImage: { type: String },
        backImage: { type: String },
        frontDesign: { type: String },
        backDesign: { type: String },
        frontUpload: { type: String },
        backUpload: { type: String },
        category: { type: ObjectId, ref: "Category", required: true }, // Category defined by the user
        description: { type: String, required: true },
        price: { type: Number, required: true, min: 0 },
        countInStock: { type: Number, required: true, min: 0, default: 0 },
        offers: { type: String, default: "" },
        returnPolicy: { type: String, default: "" },
    },
    { timestamps: true }
);

customProductSchema.index({ userId: 1, createdAt: -1 });

const customProduct = mongoose.model('customProduct', customProductSchema);

export default customProduct;