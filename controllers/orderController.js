// orderController.js
import Order from "../models/orderModel.js";
import Product from "../models/productModel.js";
import cProduct from "../models/cProductModel.js";
import { clearCart } from "./cartController.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import sendEmail from "../utils/sendEmail.js";
import axios from "axios";
import crypto from "crypto";


// ---------- Utility: price calculation ----------
function calcPrices(orderItems) {
  let itemsPriceWithTax = 0;
  let taxPrice = 0;

  orderItems.forEach((item) => {
    // Assuming each item has its own price and GST rate
    const gstRate = item.price > 1000 ? 0.12 : 0.05; // Adjust rates as needed

    // Calculate the price before tax for each item
    const itemPriceBeforeTax = item.price / (1 + gstRate);

    // Calculate the GST for each item
    const itemTaxPrice = item.price - itemPriceBeforeTax;

    // Sum up the total price and tax for all items
    itemsPriceWithTax += item.price * item.qty;
    taxPrice += itemTaxPrice * item.qty;
  });

  // Set shipping price (e.g., free for orders above ₹1000, ₹150 otherwise)
  const shippingPrice = itemsPriceWithTax > 1000 ? 0 : 150;
  console.log('itemsPrice (including tax):', itemsPriceWithTax);
  console.log('shippingPrice:', shippingPrice);

  // Total price includes the price with tax and shipping charges
  const totalPrice = (
    parseFloat(itemsPriceWithTax) +
    parseFloat(shippingPrice)
  ).toFixed(2);

  return {
    itemsPrice: (itemsPriceWithTax - taxPrice).toFixed(2), // Price before tax
    shippingPrice: shippingPrice.toFixed(2), // Shipping charges
    taxPrice: taxPrice.toFixed(2), // Total GST calculated for all items
    totalPrice, // Final price including tax and shipping
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

  const { itemsPrice, taxPrice, shippingPrice, totalPrice } = calcPrices(dbOrderItems);

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


// @desc    Initiate PhonePe payment
// @route   POST /api/payment/initiate-payment
// @access  Private
const initiatePayment = asyncHandler(async (req, res) => {
  const { merchantTransactionId, customerUserId, amount, name } = req.body;

  if (!merchantTransactionId || !customerUserId || !amount || !name) {
    res.status(400);
    throw new Error("merchantTransactionId, customerUserId, amount and name are required");
  }

  const merchantId = process.env.PHONEPE_MERCHANT_ID;
  const redirectUrl = `${process.env.BACKEND_URL}/api/orders/status?id=${merchantTransactionId}`;

  const data = {
    merchantId,
    merchantTransactionId,
    merchantUserId: customerUserId,
    amount,                // expect in paise, eg 10000 = ₹100
    name,
    redirectUrl,
    redirectMode: "POST",
    paymentInstrument: {
      type: "PAY_PAGE",
    },
  };

  const payload = JSON.stringify(data);
  const payloadMain = Buffer.from(payload).toString("base64");
  const stringToSign = payloadMain + "/pg/v1/pay" + process.env.PHONEPE_SALT_KEY;
  const sha256 = crypto.createHash("sha256").update(stringToSign).digest("hex");
  const checksum = `${sha256}###${process.env.PHONEPE_SALT_INDEX}`;

  const url = `${process.env.PHONEPE_API_BASE_URL}/pg/v1/pay`;

  const options = {
    method: "POST",
    url,
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      "X-VERIFY": checksum,
    },
    data: {
      request: payloadMain,
    },
  };

  const response = await axios(options);

  // PhonePe errors will be handled by your global errorHandler if axios throws
  res.status(200).json(response.data);
});


// @desc    PhonePe redirect webhook-style status check
// @route   GET /api/payment/status?id=merchantTransactionId
// @access  Public (called by PhonePe / user redirect)
const checkPaymentStatus = asyncHandler(async (req, res) => {
  const merchantTransactionId = req.query.id;
  const retryCount = parseInt(req.query.retry || "0", 10);
  const merchantId = process.env.PHONEPE_MERCHANT_ID;

  if (!merchantTransactionId) {
    res.status(400);
    throw new Error("Missing merchantTransactionId (id query param)");
  }

  try {
    const stringToSign =
      `/pg/v1/status/${merchantId}/${merchantTransactionId}` +
      process.env.PHONEPE_SALT_KEY;

    const sha256 = crypto.createHash("sha256").update(stringToSign).digest("hex");
    const checksum = `${sha256}###${process.env.PHONEPE_SALT_INDEX}`;

    const url = `${process.env.PHONEPE_API_BASE_URL}/pg/v1/status/${merchantId}/${merchantTransactionId}`;

    const options = {
      method: "GET",
      url,
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        "X-VERIFY": checksum,
        "X-MERCHANT-ID": merchantId,
      },
    };

    const response = await axios.request(options);
    const code = response.data.code;
    const orderId = merchantTransactionId;

    switch (code) {
      case "PAYMENT_SUCCESS": {
        try {
          const paymentData = {
            transaction_id: response.data.data.transactionId,
            order_id: response.data.data.merchantTransactionId,
            status: response.data.code,
            state: response.data.data.state,
            update_time: new Date().toISOString(),
            payment_method: response.data.data.paymentInstrument.type,
            amount_paid: response.data.data.amount / 100,
          };

          await markOrderAsPaid(orderId, paymentData);

          const successUrl = `${process.env.FRONTEND_URL}/PaymentSuccessPage?id=${orderId}`;
          return res.redirect(successUrl);
        } catch (error) {
          console.error("Error updating payment status:", error.message);
          const failUrl = `${process.env.FRONTEND_URL}/PaymentFailedPage?id=${orderId}`;
          return res.redirect(failUrl);
        }
      }

      case "PAYMENT_PENDING":
      case "INTERNAL_SERVER_ERROR": {
        if (retryCount < 3) {
          console.log(`${code} - Retrying (${retryCount + 1}/3)...`);
          const retryUrl = `${req.baseUrl}${req.path}?id=${orderId}&retry=${
            retryCount + 1
          }`;
          return res.redirect(retryUrl);
        } else {
          const timeoutUrl = `${process.env.FRONTEND_URL}/PaymentFailedPage?id=${orderId}&message=Retries%20Exceeded`;
          return res.redirect(timeoutUrl);
        }
      }

      case "BAD_REQUEST":
      case "AUTHORIZATION_FAILED":
      case "PAYMENT_ERROR":
      case "TRANSACTION_NOT_FOUND":
      case "PAYMENT_DECLINED":
      case "TIMED_OUT": {
        const errorMessage = encodeURIComponent(`Error: ${code}`);
        const errorUrl = `${process.env.FRONTEND_URL}/PaymentFailedPage?message=${errorMessage}&id=${orderId}`;
        return res.redirect(errorUrl);
      }

      default: {
        console.warn("Unhandled status code from PhonePe:", code);
        const unhandledUrl = `${process.env.FRONTEND_URL}/PaymentFailedPage?message=Unhandled%20Response&id=${orderId}`;
        return res.redirect(unhandledUrl);
      }
    }
  } catch (error) {
    console.error("Error checking payment status:", error.message);
    const fallbackUrl = `${process.env.FRONTEND_URL}/PaymentFailedPage?id=${req.query.id}`;
    return res.redirect(fallbackUrl);
  }
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
  const emailSent = await sendEmail({
    to: order.user.email,
    name: order.user.username || "User",
    subject: "Order Confirmed",
    html: ` <div style="font-family: Arial, sans-serif; border: 1px solid #ddd; padding: 20px; max-width: 600px; margin: auto;">
            <h2 style="background-color: #2874F0; color: white; padding: 10px; text-align: center;">Flow State</h2>
            <h3>Hi ${order.user.username || "User"},</h3>
            <p>Your order has been successfully placed.</p>
            <p><strong>Order ID:</strong> ${order._id}</p>
            <p>Delivery is handled by a third-party service and delivery time may vary.</p>
            <hr>
            <h4>Order Summary</h4>
            <p><strong>Amount Paid:</strong> ₹${paymentData.amount_paid}</p>
            <p><strong>Payment Method:</strong> ${paymentData.payment_method}</p>
            <p><strong>Delivery Address:</strong><br>
              ${order.shippingAddress.fullName},<br>
              ${order.shippingAddress.addressLine1},<br>
              ${order.shippingAddress.addressLine2},<br>
              ${order.shippingAddress.landmark},<br>
              ${order.shippingAddress.city} - ${order.shippingAddress.postalCode}
            </p>
            <hr>
            <h4>Thank you for shopping with us!</h4>
            <p>We will notify you once your item is shipped.</p>
            <p>Please do not reply to this email.</p>
            <p>
              For queries contact
              <a href="mailto:info@flowstateproject.in">info@flowstateproject.in</a>
            </p>
            <p>Best Regards,<br>Flow State Team</p>
          </div>
        `,
  });

  if (!emailSent) {
    console.error("Failed to send order confirmation email for order:", {
      orderId: order._id,
      userEmail: order.user.email,
    });
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
  const emailSent = await sendEmail({
    to: order.user.email,
    name: order.user.username || "User",
    subject: "Order Out for Delivery",
    html:  `
          <div style="font-family: Arial, sans-serif; border: 1px solid #ddd; padding: 20px; max-width: 600px; margin: auto;">
            <h2 style="background-color: #2874F0; color: white; padding: 10px; text-align: center;">Flow State</h2>
            <h3>Hi ${order.user.username || "User"},</h3>
            <p>Your order is now <strong>out for delivery</strong>.</p>
            <p><strong>Order ID:</strong> ${order._id}</p>
            <p>Please be available at the delivery address to receive your package.</p>
            <hr>
            <p><strong>Delivery Address:</strong><br>
              ${order.shippingAddress.fullName},<br>
              ${order.shippingAddress.addressLine1},<br>
              ${order.shippingAddress.addressLine2},<br>
              ${order.shippingAddress.landmark},<br>
              ${order.shippingAddress.city} - ${order.shippingAddress.postalCode}
            </p>
            <hr>
            <h4>Thank you for shopping with us!</h4>
            <p>Please do not reply to this email.</p>
            <p>
              For any queries contact
              <a href="mailto:info@flowstateproject.in">info@flowstateproject.in</a>
            </p>
            <p>Best Regards,<br>Flow State Team</p>
          </div>
        `,
  });

  if (!emailSent) {
    console.error("Failed to send out-for-delivery email for order:", {
      orderId: order._id,
      userEmail: order.user.email,
    });
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
  initiatePayment,
  checkPaymentStatus,
};
