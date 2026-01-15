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
            min: 0,
            default: 5, // Default daily free tries
        },
        purchasedTriesRemaining: {
            type: Number,
            required: true,
            min: 0,
            default: 0, // Purchased tries that don't reset
        },
    },
    { timestamps: true }
);

triesSchema.index({ user: 1 }, { unique: true });

const Tries = mongoose.model("Tries", triesSchema);

export default Tries;

// ------------------------Checked -------------------------