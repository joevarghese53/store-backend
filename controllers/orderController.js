// orderController.js
import Order from "../models/orderModel.js";
import Product from "../models/productModel.js";
import cProduct from "../models/cProductModel.js";
import nodemailer from "nodemailer";
import { clearCart } from "./cartController.js";
import asyncHandler from "../middlewares/asyncHandler.js";

// ---------- Utility: price calculation ----------

function calcPrices(orderItems) {
  let itemsPriceWithTax = 0;
  let taxPrice = 0;

  orderItems.forEach((item) => {
    const gstRate = item.price > 1000 ? 0.12 : 0.05;

    const itemPriceBeforeTax = item.price / (1 + gstRate);
    const itemTaxPrice = item.price - itemPriceBeforeTax;

    itemsPriceWithTax += item.price * item.qty;
    taxPrice += itemTaxPrice * item.qty;
  });

  const shippingPrice = itemsPriceWithTax > 1000 ? 0 : 150;
  const totalPrice = itemsPriceWithTax + shippingPrice;

  return {
    itemsPrice: itemsPriceWithTax - taxPrice, // number
    shippingPrice,                            // number
    taxPrice,                                 // number
    totalPrice,                               // number
  };
}

// ---------- Controllers ----------

// @desc    Create a new order
// @route   POST /api/orders
// @access  Private
const createOrder = asyncHandler(async (req, res) => {
  const { orderItems, shippingAddress } = req.body;

  if (!orderItems || orderItems.length === 0) {
    return res.status(400).json({ error: "No order items" });
  }

  if (!shippingAddress) {
    return res.status(400).json({ error: "Shipping address is required" });
  }

  // Split items by type
  const productItems = orderItems.filter(
    (item) => item.productType === "Product"
  );
  const customProductItems = orderItems.filter(
    (item) => item.productType === "cProduct"
  );

  // Fetch normal products from DB
  const itemsFromDB = await Product.find({
    _id: { $in: productItems.map((x) => x._id) },
  });

  // Fetch custom products from DB
  const customProductDoc = await cProduct.findOne({ userId: req.user._id });
  const customItemsFromDB = customProductDoc
    ? customProductDoc.customProducts.filter((customProd) =>
        customProductItems.some(
          (item) => customProd._id.toString() === item._id
        )
      )
    : [];

  const dbOrderItems = orderItems.map((itemFromClient) => {
    let matchingItemFromDB;

    if (itemFromClient.productType === "Product") {
      matchingItemFromDB = itemsFromDB.find(
        (itemFromDB) => itemFromDB._id.toString() === itemFromClient._id
      );
    } else if (itemFromClient.productType === "cProduct") {
      matchingItemFromDB = customItemsFromDB.find(
        (itemFromDB) => itemFromDB._id.toString() === itemFromClient._id
      );
    }

    if (!matchingItemFromDB) {
      // This will be caught by asyncHandler → error middleware
      res.status(404);
      throw new Error(`Product not found: ${itemFromClient._id}`);
    }

    return {
      ...itemFromClient,
      product: itemFromClient._id,
      price: matchingItemFromDB.price,
      _id: undefined,
    };
  });

  const { itemsPrice, taxPrice, shippingPrice, totalPrice } =
    calcPrices(dbOrderItems);

  const order = new Order({
    orderItems: dbOrderItems,
    user: req.user._id,
    shippingAddress,
    itemsPrice,
    taxPrice,
    shippingPrice,
    totalPrice,
  });

  const createdOrder = await order.save();
  res.status(201).json(createdOrder);
});

// @desc    Get all orders
// @route   GET /api/orders
// @access  Admin
const getAllOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({}).populate("user", "id username email");
  res.json(orders);
});

// @desc    Get current user's paid orders
// @route   GET /api/orders/mine
// @access  Private
const getUserOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id, isPaid: true }).sort({
    createdAt: -1,
  });
  res.json(orders);
});

// @desc    Count total paid orders grouped by date
// @route   GET /api/orders/total-orders
// @access  Admin
const countTotalOrdersByDate = asyncHandler(async (req, res) => {
  const ordersByDate = await Order.aggregate([
    { $match: { isPaid: true } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$paidAt" } },
        totalOrders: { $sum: 1 },
      },
    },
  ]);

  res.json(ordersByDate);
});

// @desc    Calculate total sales (sum of totalPrice for paid orders)
// @route   GET /api/orders/total-sales
// @access  Admin
const calculateTotalSales = asyncHandler(async (req, res) => {
  const orders = await Order.find({ isPaid: true });

  const totalSales = orders.reduce(
    (sum, order) => sum + Number(order.totalPrice || 0),
    0
  );

  res.json({ totalSales });
});

// @desc    Calculate total products sold by date
// @route   GET /api/orders/total-products-sold
// @access  Admin
const calculateTotalProductsSoldByDate = asyncHandler(async (req, res) => {
  const productsSoldByDate = await Order.aggregate([
    { $match: { isPaid: true } },
    { $unwind: "$orderItems" },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$paidAt" } },
        totalProductsSold: { $sum: "$orderItems.qty" },
      },
    },
  ]);

  res.json(productsSoldByDate);
});

// @desc    Calculate total sales grouped by date
// @route   GET /api/orders/total-sales-by-date
// @access  Admin
const calculateTotalSalesByDate = asyncHandler(async (req, res) => {
  const salesByDate = await Order.aggregate([
    { $match: { isPaid: true } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$paidAt" } },
        totalSales: { $sum: "$totalPrice" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.json(salesByDate);
});

// @desc    Get order by ID (user can see own, admin can see all)
// @route   GET /api/orders/:id
// @access  Private
const findOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate(
    "user",
    "username email"
  );

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  // Check if the logged-in user is the owner OR an admin
  if (!req.user.isAdmin && order.user._id.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("Not authorized to view this order");
  }

  res.json(order);
});

// ---------- Payment + Emails ----------

const sendOrderConfirmationEmail = async (order, paymentData) => {
  try {
    console.log("Sending order confirmation email...", order);

    const transporter = nodemailer.createTransport({
      host: "smtp.zeptomail.in",
      port: 587,
      secure: false,
      auth: {
        user: "emailapikey",
        pass: process.env.ZEPTO_API_KEY,
      },
    });

    const mailOptions = {
      from: `"Flow State" <noreply@flowstateproject.in>`,
      to: order.user.email,
      subject: "Order Confirmed",
      html: `
        <div style="font-family: Arial, sans-serif; border: 1px solid #ddd; padding: 20px; max-width: 600px; margin: auto;">
          <h2 style="background-color: #2874F0; color: white; padding: 10px; text-align: center;">Flow State</h2>
          <h3>Hi ${order.user.username},</h3>
          <p>Your order has been successfully placed.</p>
          <p><strong>Order ID:</strong> ${order._id}</p>
          <p>We are committed to serving you with the utmost care. Delivery is done by a third-party service and the delivery time may vary.</p>
          <hr style="border-top: 1px solid #ddd;">
          <h4>Order Summary</h4>
          <p><strong>Amount Paid:</strong> ₹${paymentData.amount_paid}</p>
          <p><strong>Delivery Address:</strong> ${order.shippingAddress.address}, ${order.shippingAddress.city} - ${order.shippingAddress.postalCode}</p>
          <p><strong>Payment Method:</strong> ${paymentData.payment_method}</p>
          <hr style="border-top: 1px solid #ddd;">
          <h4>Thank you for shopping with us!</h4>
          <p>We will notify you once your item is shipped.</p>
          <p>Please do not reply to this email as it is sent from an unmonitored address.</p>
          <p>For any queries, please contact us at <a href="mailto:info@flowstateproject.in">info@flowstateproject.in</a></p>
          <p>Best Regards,<br>Flow State Team</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Order confirmation email sent: %s", info.messageId);
  } catch (error) {
    console.error("Error sending order confirmation email:", error.message);
  }
};

// This is NOT an Express handler, it's a service called from proxyController
const markOrderAsPaid = async (orderId, paymentData) => {
  try {
    const order = await Order.findById(orderId).populate(
      "user",
      "username email"
    );

    if (!order) {
      throw new Error("Order not found");
    }

    order.isPaid = true;
    order.paidAt = Date.now();
    order.paymentResult = {
      transaction_id: paymentData.transaction_id,
      order_id: paymentData.order_id,
      status: paymentData.status,
      state: paymentData.state,
      update_time: paymentData.update_time,
      payment_method: paymentData.payment_method,
      amount_paid: paymentData.amount_paid,
    };

    await order.save();
    await sendOrderConfirmationEmail(order, paymentData);
    await clearCart(order.user._id);

    return order;
  } catch (error) {
    throw new Error(error.message);
  }
};

const sendOrderOutForDeliveryEmail = async (order) => {
  try {
    console.log("Sending order out-for-delivery email...", order);

    const transporter = nodemailer.createTransport({
      host: "smtp.zeptomail.in",
      port: 587,
      secure: false,
      auth: {
        user: "emailapikey",
        pass: process.env.ZEPTO_API_KEY,
      },
    });

    const mailOptions = {
      from: `"Flow State" <noreply@flowstateproject.in>`,
      to: order.user.email,
      subject: "Order Out for Delivery",
      html: `
        <div style="font-family: Arial, sans-serif; border: 1px solid #ddd; padding: 20px; max-width: 600px; margin: auto;">
          <h2 style="background-color: #2874F0; color: white; padding: 10px; text-align: center;">Flow State</h2>
          <h3>Hi ${order.user.username},</h3>
          <p>Your order is now out for delivery.</p>
          <p><strong>Order ID:</strong> ${order._id}</p>
          <p>Please be available at the delivery address to receive your package.</p>
          <hr style="border-top: 1px solid #ddd;">
          <h4>Delivery Address</h4>
          <p>${order.shippingAddress.address}, ${order.shippingAddress.city} - ${order.shippingAddress.postalCode}</p>
          <hr style="border-top: 1px solid #ddd;">
          <h4>Thank you for shopping with us!</h4>
          <p>Please do not reply to this email as it is sent from an unmonitored address.</p>
          <p>For any queries, please contact us at <a href="mailto:info@flowstateproject.in">info@flowstateproject.in</a></p>
          <p>Best Regards,<br>Flow State Team</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Out-for-delivery email sent: %s", info.messageId);
  } catch (error) {
    console.error(
      "Error sending order out-for-delivery email:",
      error.message
    );
  }
};

// ---------- Status Update Routes (Express handlers) ----------

// @desc    Mark order as confirmed
// @route   PUT /api/orders/:id/confirm
// @access  Admin
const markOrderAsConfirmed = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  order.isConfirmed = true;
  order.confirmedAt = Date.now();

  const updatedOrder = await order.save();
  res.json(updatedOrder);
});

// @desc    Mark order as shipped
// @route   PUT /api/orders/:id/shipped
// @access  Admin
const markOrderAsShipped = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  order.isShipped = true;
  order.shippedAt = Date.now();

  const updatedOrder = await order.save();
  res.json(updatedOrder);
});

// @desc    Mark order as out for delivery
// @route   PUT /api/orders/:id/out-for-delivery
// @access  Admin
const markOrderAsOutForDelivery = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate(
    "user",
    "username email"
  );

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  order.isOutForDelivery = true;
  order.outForDeliveryAt = Date.now();

  const updatedOrder = await order.save();

  await sendOrderOutForDeliveryEmail(updatedOrder);

  res.json(updatedOrder);
});

// @desc    Mark order as delivered
// @route   PUT /api/orders/:id/delivered
// @access  Admin
const markOrderAsDelivered = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  order.isDelivered = true;
  order.deliveredAt = Date.now();

  const updatedOrder = await order.save();
  res.json(updatedOrder);
});

export {
  createOrder,
  getAllOrders,
  getUserOrders,
  countTotalOrdersByDate,
  calculateTotalSales,
  calculateTotalProductsSoldByDate,
  calculateTotalSalesByDate,
  findOrderById,
  markOrderAsPaid,           // service (used from payment controller)
  markOrderAsConfirmed,
  markOrderAsShipped,
  markOrderAsOutForDelivery,
  markOrderAsDelivered,
};
