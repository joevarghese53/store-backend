//orderModel.js
import mongoose from "mongoose";

const orderSchema = mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
    orderItems: [
      {
        name: { type: String, required: true },
        category: { type: String, required: true },
        qty: { type: Number, required: true },
        size: { type: String, required: true },
        price: { type: Number, required: true },
        frontImage: { type: String },
        backImage: { type: String },
        frontDesign: { type: String },
        backDesign: { type: String },
        frontUpload: { type: String },
        backUpload: { type: String },
        product: {
          type: mongoose.Schema.Types.ObjectId,
          refPath: 'orderItems.productType', // Dynamic reference based on productType
          required: true
        },
        productType: {
          type: String,
          required: true,
          enum: ["Product", "CustomProduct"], // or "cProduct" if that's your model name
        },
      },
    ],

    shippingAddress: {
      fullName: { type: String, required: true },
      addressLine1: { type: String, required: true },
      addressLine2: { type: String },
      landmark: { type: String },
      city: { type: String, required: true },
      postalCode: { type: String, required: true },
      state: { type: String, required: true },
      country: { type: String, required: true },
      phoneNumber: { type: String, required: true, match: [/^[6-9][0-9]{9}$/, "Invalid phone number"] },
    },

    paymentResult: {
      transactionId: { type: String },
      state: { type: String },
      paymentMode: { type: String },
      amount: { type: Number },
    },

    itemsPrice: {
      type: Number,
      required: true,
      default: 0.0,
    },

    taxPrice: {
      type: Number,
      required: true,
      default: 0.0,
    },

    shippingPrice: {
      type: Number,
      required: true,
      default: 0.0,
    },

    totalPrice: {
      type: Number,
      required: true,
      default: 0.0,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "paid",
        "confirmed",
        "shipped",
        "outForDelivery",
        "delivered",
      ],
      default: "pending",
    },

    isPaid: {
      type: Boolean,
      required: true,
      default: false,
    },

    isConfirmed: {
      type: Boolean,
      required: true,
      default: false,
    },

    isShipped: {
      type: Boolean,
      required: true,
      default: false,
    },

    isOutForDelivery: {
      type: Boolean,
      required: true,
      default: false,
    },

    isDelivered: {
      type: Boolean,
      required: true,
      default: false,
    },

    paidAt: {
      type: Date,
    },

    confirmedAt: {
      type: Date,
    },

    shippedAt: {
      type: Date,
    },

    outForDeliveryAt: {
      type: Date,
    },

    deliveredAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

const Order = mongoose.model("Order", orderSchema);
export default Order;
