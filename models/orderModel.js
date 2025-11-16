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
      address: { type: String, required: true },
      city: { type: String, required: true },
      postalCode: { type: String, required: true },
      state: { type: String, required: true },
      country: { type: String, required: true },
      phoneno: { type: String, required: true, match: [/^[6-9][0-9]{9}$/, "Invalid phone number"] },
    },

    paymentResult: {
      transaction_id: { type: String },
      order_id: { type: String },
      status: { type: String },
      state: { type: String },
      update_time: { type: String },
      payment_method: { type: String },
      amount_paid: { type: Number },
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
        "cancelled",
        "refunded",
      ],
      default: "pending",
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
