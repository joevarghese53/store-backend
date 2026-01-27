// orderController.js
import Order from "../models/orderModel.js";
import Product from "../models/productModel.js";
import cProduct from "../models/cProductModel.js";
import { clearCart } from "./cartController.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import sendEmail from "../utils/sendEmail.js";
import { initiatePhonePePayment } from "../utils/phonpeHelper.js";
import Transaction from "../models/transactionModel.js";


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

const initiatePayment = asyncHandler(async (req, res) => {
  // Validate request body
  const { merchantOrderId } = req.body;
  const userId = req.user._id;
  if (!merchantOrderId) {
    res.status(400);
    throw new Error("Order ID is required");
  }
  if (!userId) {
    res.status(400);
    throw new Error("User not authenticated");
  }
  const amount = Order.findById(merchantOrderId).then(order => {
    if (!order) {
      res.status(404);
      throw new Error("Order not found");
    }
    return order.totalPrice * 100; // in paise
  });

  // Add Txn to DB
  await Transaction.create({
    merchantOrderId,
    userId,
    service: "PRODUCT_PURCHASE",
    amount,
    status: "INITIATED",
    fulfilled: false,
  });

  // Initiate Payment
  const response = await initiatePhonePePayment(merchantOrderId, amount);

  res.json({
    success: true,
    redirectUrl: response.redirectUrl,
    merchantOrderId
  });
});

const getUserOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id, isPaid: true }).sort({
    createdAt: -1,
  });
  res.json(orders);
});

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

//----------- Admin Routes -----------

const getAllOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({}).populate("user", "id username email");
  res.json(orders);
});

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

const calculateTotalSales = asyncHandler(async (req, res) => {
  const orders = await Order.find({ isPaid: true });

  const totalSales = orders.reduce(
    (sum, order) => sum + Number(order.totalPrice || 0),
    0
  );

  res.json({ totalSales });
});

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

// ---------- Status Update Routes (Express handlers) ----------

const markOrderAsPaid = async (orderId, paymentData) => {
  try {
    const order = await Order.findById(orderId).populate(
      "user",
      "username email"
    );

    if (!order) {
      throw new Error("Order not found");
    }

    order.status = "paid";
    order.isPaid = true;
    order.paidAt = Date.now();
    order.paymentResult = {
      transactionId: paymentData.transactionId,
      state: paymentData.state,
      paymentMode: paymentData.paymentMode,
      amount: paymentData.amount,
    };

    await order.save();
    await sendOrderConfirmationEmail(order, paymentData);
    await clearCart(order.user._id);

    return order;
  } catch (error) {
    throw new Error(error.message);
  }
};

const markOrderAsConfirmed = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  order.status = "confirmed"
  order.isConfirmed = true;
  order.confirmedAt = Date.now();

  const updatedOrder = await order.save();
  res.json(updatedOrder);
});

const markOrderAsShipped = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  order.status = "shipped"
  order.isShipped = true;
  order.shippedAt = Date.now();

  const updatedOrder = await order.save();
  res.json(updatedOrder);
});

const markOrderAsOutForDelivery = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate(
    "user",
    "username email"
  );

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  order.status = "outForDelivery"
  order.isOutForDelivery = true;
  order.outForDeliveryAt = Date.now();

  const updatedOrder = await order.save();

  await sendOrderOutForDeliveryEmail(updatedOrder);

  res.json(updatedOrder);
});

const markOrderAsDelivered = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  order.status = "delivered"
  order.isDelivered = true;
  order.deliveredAt = Date.now();

  const updatedOrder = await order.save();
  res.json(updatedOrder);
});

// ---------- Emails ----------

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
            <p><strong>Amount Paid:</strong> ₹${paymentData.amount}</p>
            <p><strong>Payment Method:</strong> ${paymentData.paymentMode}</p>
            <p><strong>Delivery Address:</strong><br>
              ${order.shippingAddress.addressLine1},<br>
              ${order.shippingAddress.addressLine2},<br>
              ${order.shippingAddress.Landmark},<br>
              ${order.shippingAddress.city} - ${order.shippingAddress.postalCode}, ${order.shippingAddress.state}, ${order.shippingAddress.country}<br>
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

const sendOrderOutForDeliveryEmail = async (order) => {
  const emailSent = await sendEmail({
    to: order.user.email,
    name: order.user.username || "User",
    subject: "Order Out for Delivery",
    html: `
          <div style="font-family: Arial, sans-serif; border: 1px solid #ddd; padding: 20px; max-width: 600px; margin: auto;">
            <h2 style="background-color: #2874F0; color: white; padding: 10px; text-align: center;">Flow State</h2>
            <h3>Hi ${order.user.username || "User"},</h3>
            <p>Your order is now <strong>out for delivery</strong>.</p>
            <p><strong>Order ID:</strong> ${order._id}</p>
            <p>Please be available at the delivery address to receive your package.</p>
            <hr>
            <p><strong>Delivery Address:</strong><br>
              ${order.shippingAddress.addressLine1},<br>
              ${order.shippingAddress.addressLine2},<br>
              ${order.shippingAddress.Landmark},<br>
              ${order.shippingAddress.city} - ${order.shippingAddress.postalCode}, ${order.shippingAddress.state}, ${order.shippingAddress.country}<br>
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
};
