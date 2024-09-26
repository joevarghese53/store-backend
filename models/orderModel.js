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
        image: { type: String, required: true },
        price: { type: Number, required: true },
        product: {
          type: mongoose.Schema.Types.ObjectId, 
          refPath: 'orderItems.productType', // Dynamic reference based on productType
        },
        productType: { type: String, required: true }, // Product type to distinguish between 'Product' and 'CustomProduct'
      },
    ],

    shippingAddress: {
      address: { type: String, required: true },
      city: { type: String, required: true },
      postalCode: { type: String, required: true },
      state: { type: String, required: true },
      country: { type: String, required: true },
      phoneno: { type: Number, required: true },
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

    isPaid: {
      type: Boolean,
      required: true,
      default: false,
    },

    paidAt: {
      type: Date,
    },

    isShipped: {
      type: Boolean,
      required: true,
      default: false,
    },

    shippedAt: {
      type: Date,
    },

    isOutForDelivery: {
      type: Boolean,
      required: true,
      default: false,
    },

    outForDeliveryAt: {
      type: Date,
    },

    isDelivered: {
      type: Boolean,
      required: true,
      default: false,
    },

    deliveredAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

const Order = mongoose.model("Order", orderSchema);
export default Order;
