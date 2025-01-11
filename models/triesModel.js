import mongoose from "mongoose";

const triesSchema = mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User", // Reference to the User model
            required: true,
        },
        freeTriesRemaining: {
            type: Number,
            required: true,
            default: 5, // Default daily free tries
        },
        purchasedTriesRemaining: {
            type: Number,
            required: true,
            default: 0, // Purchased tries that don't reset
        },
        lastUpdated: {
            type: Date,
            required: true,
            default: Date.now, // Track when tries were last reset/updated
        },
    },
    { timestamps: true }
);

const Tries = mongoose.model("Tries", triesSchema);

export default Tries;
