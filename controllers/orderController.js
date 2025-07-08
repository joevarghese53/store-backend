//orderController.js
import Order from "../models/orderModel.js";
import Product from "../models/productModel.js";
import cProduct from "../models/cProductModel.js";
import nodemailer from 'nodemailer';
import { clearCart } from "./cartController.js";

// Utility Function
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


const createOrder = async (req, res) => {
  try {
    const { orderItems, shippingAddress } = req.body;

    if (orderItems && orderItems.length === 0) {
      res.status(400);
      throw new Error("No order items");
    }

    const productItems = orderItems.filter(item => item.productType === 'Product');
    const customProductItems = orderItems.filter(item => item.productType === 'cProduct');

    const itemsFromDB = await Product.find({
      _id: { $in: productItems.map((x) => x._id) },
    });

    const customProductDoc = await cProduct.findOne({ userId: req.user._id });
    const customItemsFromDB = customProductDoc
      ? customProductDoc.customProducts.filter((customProd) =>
        customProductItems.some((item) => customProd._id.toString() === item._id)
      )
      : [];

    const dbOrderItems = orderItems.map((itemFromClient) => {
      let matchingItemFromDB;

      if (itemFromClient.productType === 'Product') {
        matchingItemFromDB = itemsFromDB.find(
          (itemFromDB) => itemFromDB._id.toString() === itemFromClient._id
        );
      } else if (itemFromClient.productType === 'cProduct') {
        matchingItemFromDB = customItemsFromDB.find(
          (itemFromDB) => itemFromDB._id.toString() === itemFromClient._id
        );
      }

      if (!matchingItemFromDB) {
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

    console.log("created order : ", order);

    const createdOrder = await order.save();
    res.status(201).json(createdOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find({}).populate("user", "id username email");
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getUserOrders = async (req, res) => {
  try {
    // Find orders for the user and populate the product's category name in orderItems
    const orders = await Order.find({ user: req.user._id, isPaid: true }).sort({ createdAt: -1 });
    console.log('orders fetched from db:', orders);

    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


const countTotalOrdersByDate = async (req, res) => {
  try {
    const ordersByDate = await Order.aggregate([
      {
        $match: {
          isPaid: true,
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$paidAt" },
          },
          totalOrders: { $sum: 1 },
        },
      },
    ]);

    res.json(ordersByDate);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


const calculateTotalSales = async (req, res) => {
  try {
    const orders = await Order.find({ isPaid: true });
    const totalSales = orders.reduce((sum, order) => sum + order.totalPrice, 0);
    res.json({ totalSales });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
const calculateTotalProductsSoldByDate = async (req, res) => {
  try {
    const productsSoldByDate = await Order.aggregate([
      {
        $match: {
          isPaid: true,
        },
      },
      {
        $unwind: "$orderItems",
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$paidAt" },
          },
          totalProductsSold: { $sum: "$orderItems.qty" },
        },
      },
    ]);

    res.json(productsSoldByDate);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


const calcualteTotalSalesByDate = async (req, res) => {
  try {
    const salesByDate = await Order.aggregate([
      {
        $match: {
          isPaid: true,
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$paidAt" },
          },
          totalSales: { $sum: "$totalPrice" },
        },
      },
      {
        $sort: { _id: 1 }, // Sort by _id (date) in ascending order
      },
    ]);

    res.json(salesByDate);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


const findOrderById = async (req, res) => {
  try {
    // Find the order by ID and populate the user, and the category name in products
    const order = await Order.findById(req.params.id).populate("user", "username email");
      
    console.log('order fetched from db:', order);

    if (!order) {
      res.status(404);
      throw new Error("Order not found");
    }

    // Transform the order to replace category ID with category name and keep only product ID
   

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


const markOrderAsPaid = async (orderId, paymentData) => {
  try {
    const order = await Order.findById(orderId).populate("user", "username email");

    if (order) {
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

      await order.save(); // Return the updated order

      await sendOrderConfirmationEmail(order, paymentData);

      // Clear the user's cart after successful payment
      await clearCart(order.user._id);

      return order;
    } else {
      throw new Error("Order not found");
    }
  } catch (error) {
    throw new Error(error.message); // Propagate the error
  }
};

const sendOrderConfirmationEmail = async (order, paymentData) => {
  try {
    // Create a transporter
    console.log('Sending order confirmation email...', order);
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_ADDRESS, // Your Gmail email
        pass: process.env.EMAIL_PASSWORD, // Your Gmail app password
      },
    });


    // Email content
    const mailOptions = {
      from: `"Flow State" <${process.env.EMAIL_ADDRESS}>`, // sender address
      to: order.user.email, // recipient email from order
      subject: 'Order Confirmed', // Subject line
      html: `
    <div style="font-family: Arial, sans-serif; border: 1px solid #ddd; padding: 20px; max-width: 600px; margin: auto;">
      <h2 style="background-color: #2874F0; color: white; padding: 10px; text-align: center;">Flow State</h2>
      <h3>Hi ${order.user.username},</h3>
      <p>Your order has been successfully placed.</p>
      <p><strong>Order ID:</strong> ${order._id}</p>
      <p>We are committed to serving you with the utmost care. Please note, the delivery is done by a third-party service and the delivery time may vary. We will keep you updated on the status of your order. Please keep an eye on the expected delivery date on the website.</p>
      <hr style="border-top: 1px solid #ddd;">
      <h4>Order Summary</h4>
      <p><strong>Amount Paid:</strong> ₹${paymentData.amount_paid}</p>
      <p><strong>Delivery Address:</strong> ${order.shippingAddress.address}, ${order.shippingAddress.city} - ${order.shippingAddress.postalCode}</p>
      <p><strong>Payment Method:</strong> ${paymentData.payment_method}</p>
      <hr style="border-top: 1px solid #ddd;">
      <h4>Thank you for shopping with us!</h4>
      <p>We will notify you once your item is shipped. Stay tuned for more updates via mail at ${order.user.email}.</p>
      <p>Best Regards,<br>Flow State Team</p>
    </div>
  `,
    };


    // Send the email
    let info = await transporter.sendMail(mailOptions);
    console.log('Message sent: %s', info.messageId);
  } catch (error) {
    console.error('Error sending order confirmation email:', error.message);
  }
};

const markOrderAsConfirmed = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (order) {
      order.isConfirmed = true;
      order.confirmedAt = Date.now();

      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } else {
      res.status(404);
      throw new Error("Order not found");
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const markOrderAsShipped = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (order) {
      order.isShipped = true;
      order.shippedAt = Date.now();

      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } else {
      res.status(404);
      throw new Error("Order not found");
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const markOrderAsOutForDelivery = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate("user", "username email");

    if (order) {
      order.isOutForDelivery = true;
      order.outForDeliveryAt = Date.now();

      const updatedOrder = await order.save();

      await sendOrderOutForDeliveryEmail(updatedOrder);

      res.json(updatedOrder);
    } else {
      res.status(404);
      throw new Error("Order not found");
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const sendOrderOutForDeliveryEmail = async (order) => {
  try {
    // Create a transporter
    const customercaremail = process.env.CUSTOMER_CARE_EMAIL;
    console.log('Sending order out for delivery email...', order);
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_ADDRESS, // Your Gmail email
        pass: process.env.EMAIL_PASSWORD, // Your Gmail app password
      },
    });

    // Email content
    const mailOptions = {
      from: `"Flow State" <${process.env.EMAIL_ADDRESS}>`, // sender address
      to: order.user.email, // recipient email from order
      subject: 'Order Out for Delivery', // Subject line
      html: `
    <div style="font-family: Arial, sans-serif; border: 1px solid #ddd; padding: 20px; max-width: 600px; margin: auto;">
      <h2 style="background-color: #2874F0; color: white; padding: 10px; text-align: center;">Flow State</h2>
      <h3>Hi ${order.user.username},</h3>
      <p>Your order is now out for delivery.</p>
      <p><strong>Order ID:</strong> ${order._id}</p>
      <p>Please be available at the delivery address to receive your package. Our delivery partner will reach out to you for confirmation.</p> 
      <hr style="border-top: 1px solid #ddd;">
      <h4>Order Details</h4>
      <p><strong>Delivery Address:</strong> ${order.shippingAddress.address}, ${order.shippingAddress.city} - ${order.shippingAddress.postalCode}</p>
      <hr style="border-top: 1px solid #ddd;">
      <h4>Thank you for shopping with us!</h4>
      <p>We hope you enjoy your purchase! Feel free to reach out at ${customercaremail} if you have any questions. Stay updated through email at ${order.user.email}.</p>
      <p>Best Regards,<br>Flow State Team</p>
    </div>
  `,
    };

    // Send the email
    let info = await transporter.sendMail(mailOptions);
    console.log('Message sent: %s', info.messageId);
  } catch (error) {
    console.error('Error sending order out for delivery email:', error.message);
  }
};


const markOrderAsDelivered = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (order) {
      order.isDelivered = true;
      order.deliveredAt = Date.now();

      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } else {
      res.status(404);
      throw new Error("Order not found");
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



export {
  createOrder,
  getAllOrders,
  getUserOrders,
  countTotalOrdersByDate,
  calculateTotalSales,
  calculateTotalProductsSoldByDate,
  calcualteTotalSalesByDate,
  findOrderById,
  markOrderAsPaid,
  markOrderAsConfirmed,
  markOrderAsShipped,
  markOrderAsOutForDelivery,
  markOrderAsDelivered,
};
