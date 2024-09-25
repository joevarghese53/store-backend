// cProductModel.js
import mongoose from "mongoose";
const { ObjectId } = mongoose.Schema;

const customProductSchema = mongoose.Schema(
    {
        name: { type: String, required: true },
        image: { type: String, required: true },
        category: { type: ObjectId, ref: "Category", required: true }, // Category defined by the user
        description: { type: String, required: true },
        price: { type: Number, required: true, default: 0 },
        countInStock: { type: Number, required: true, default: 0 },
        offers: { type: String, required: true },
        returnpolicy: { type: String, required: true },
    },
    { timestamps: true }
);

const cProductSchema = mongoose.Schema(
    {
        userId: { type: ObjectId, ref: 'User', required: true }, // Reference to the User model
        customProducts: [customProductSchema], // Array of custom products specific to the user
    },
    { timestamps: true }
);

const cProduct = mongoose.model('cProduct', cProductSchema);

export default cProduct;