// models/transactionModel.js
import mongoose from "mongoose";

const transactionSchema = mongoose.Schema(
  {
    merchantOrderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
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
    },

    amount: {
      type: Number, // in paise
      required: true,
    },

    status: {
      type: String,
      enum: ["INITIATED", "PENDING", "COMPLETED", "FAILED"],
      default: "INITIATED",
      index: true,
    },

    fulfilled: {
      type: Boolean,
      default: false,
    },

  },
  { timestamps: true }
);

const Transaction = mongoose.model("Transaction", transactionSchema);

export default Transaction;
