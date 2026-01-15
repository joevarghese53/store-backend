// models/wishlistModel.js
import mongoose from "mongoose";

const wishlistSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true,
        unique: true,
        index: true
    },
    items: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
},
{ timestamps: true }
);

wishlistSchema.index(
  { userId: 1, items: 1 },
  { unique: true }
);

export default mongoose.model("Wishlist", wishlistSchema);

// ----------------Checked------------------