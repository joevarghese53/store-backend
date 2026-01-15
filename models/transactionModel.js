import mongoose from "mongoose";

const transactionSchema = mongoose.Schema(
  {
    merchantOrderId: {
      type: String,
      required: true,
      unique: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    service: {
      type: String,
      enum: ["TRIES_PURCHASE", "PRODUCT_PURCHASE"],
      required: true,
    },

    serviceRef: {
      type: String,
    },

    triesToPurchase: {
      type: Number,
      min: 1,
    },

    amount: {
      type: Number,
      min: 0,
      required: true,
    },

    status: {
      type: String,
      enum: ["INITIATED", "PENDING", "SUCCESS", "FAILED"],
      default: "INITIATED",
      index: true,
    },

    fulfilled: {
      type: Boolean,
      default: false,
    },

    fulfilledAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Optimized for webhook idempotency checks
transactionSchema.index(
  { merchantOrderId: 1, status: 1, fulfilled: 1 }
);

export default mongoose.model("Transaction", transactionSchema);

// ------------------------Checked -------------------------