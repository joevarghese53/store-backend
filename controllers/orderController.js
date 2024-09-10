//orderController.js
import Order from "../models/orderModel.js";
import Product from "../models/productModel.js";
import nodemailer from 'nodemailer';

// Utility Function
function calcPrices(orderItems) {
  const itemsPrice = orderItems.reduce(
    (acc, item) => acc + item.price * item.qty,
    0
  );

  const shippingPrice = itemsPrice > 100 ? 0 : 10;
  const taxRate = 0.15;
  const taxPrice = (itemsPrice * taxRate).toFixed(2);

  const totalPrice = (
    itemsPrice +
    shippingPrice +
    parseFloat(taxPrice)
  ).toFixed(2);

  return {
    itemsPrice: itemsPrice.toFixed(2),
    shippingPrice: shippingPrice.toFixed(2),
    taxPrice,
    totalPrice,
  };
}



const createOrder = async (req, res) => {
  try {
    const { orderItems, shippingAddress } = req.body;

    if (orderItems && orderItems.length === 0) {
      res.status(400);
      throw new Error("No order items");
    }

    const itemsFromDB = await Product.find({
      _id: { $in: orderItems.map((x) => x._id) },
    });

    const dbOrderItems = orderItems.map((itemFromClient) => {
      const matchingItemFromDB = itemsFromDB.find(
        (itemFromDB) => itemFromDB._id.toString() === itemFromClient._id
      );

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

    const createdOrder = await order.save();
    res.status(201).json(createdOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find({}).populate("user", "id username");
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getUserOrders = async (req, res) => {
  try {
    // Find orders for the user and populate the product's category name in orderItems
    const orders = await Order.find({ user: req.user._id, isPaid: true })
      .populate({
        path: 'orderItems.product',
        populate: {
          path: 'category',
          select: 'name', // Populate only the name field of the category
        },
        select: 'name category image price', // Include necessary fields in product
      }).sort({ createdAt: -1 });

    // Transform the populated data to match the desired format
    const transformedOrders = orders.map(order => {
      // Transform each order item to replace category ID with category name and simplify product reference
      const transformedItems = order.orderItems.map(item => ({
        ...item.toObject(),
        category: item.product.category.name, // Replace category ID with the name
        product: item.product._id, // Keep only the product ID
      }));

      return {
        ...order.toObject(),
        orderItems: transformedItems,
      };
    });

    res.json(transformedOrders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


const countTotalOrders = async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    res.json({ totalOrders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const calculateTotalSales = async (req, res) => {
  try {
    const orders = await Order.find();
    const totalSales = orders.reduce((sum, order) => sum + order.totalPrice, 0);
    res.json({ totalSales });
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
    ]);

    res.json(salesByDate);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const findOrderById = async (req, res) => {
  try {
    // Find the order by ID and populate the user, and the category name in products
    const order = await Order.findById(req.params.id)
      .populate("user", "username email") // Populating user fields
      .populate({
        path: "orderItems.product",
        populate: {
          path: "category",
          select: "name", // Populate only the name of the category
        },
        select: "name category image price", // Include necessary fields in product
      });

    if (!order) {
      res.status(404);
      throw new Error("Order not found");
    }

    // Transform the order to replace category ID with category name and keep only product ID
    const transformedOrder = {
      ...order.toObject(),
      orderItems: order.orderItems.map(item => ({
        ...item.toObject(),
        category: item.product.category.name, // Replace category ID with the category name
        product: item.product._id, // Keep only the product ID
      })),
    };

    res.json(transformedOrder);
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
      from: `"Dgen Stores" <${process.env.EMAIL_ADDRESS}>`, // sender address
      to: order.user.email, // recipient email from order
      subject: 'Order Confirmed', // Subject line
      html: `
    <div style="font-family: Arial, sans-serif; border: 1px solid #ddd; padding: 20px; max-width: 600px; margin: auto;">
      <h2 style="background-color: #2874F0; color: white; padding: 10px; text-align: center;">Dgen Stores</h2>
      <h3>Hi ${order.user.username},</h3>
      <p>Your order has been successfully placed.</p>
      <p><strong>Order ID:</strong> ${order._id}</p>
      <p>We are committed to serving you with the utmost care. Please note, the delivery date may change based on the government's zonal advisory in your area.</p>
      <hr style="border-top: 1px solid #ddd;">
      <h4>Order Summary</h4>
      <p><strong>Amount Paid:</strong> ₹${paymentData.amount_paid}</p>
      <p><strong>Delivery Address:</strong> ${order.shippingAddress.address}, ${order.shippingAddress.city} - ${order.shippingAddress.postalCode}</p>
      <p><strong>Payment Method:</strong> ${paymentData.payment_method}</p>
      <hr style="border-top: 1px solid #ddd;">
      <h4>Thank you for shopping with us!</h4>
      <p>We will notify you once your item is shipped. Stay tuned for more updates via mail at ${order.user.email}.</p>
      <p>Best Regards,<br>Dgen Team</p>
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
    const order = await Order.findById(req.params.id);

    if (order) {
      order.isOutForDelivery = true;
      order.outForDeliveryAt = Date.now();

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
  countTotalOrders,
  calculateTotalSales,
  calcualteTotalSalesByDate,
  findOrderById,
  markOrderAsPaid,
  markOrderAsShipped,
  markOrderAsOutForDelivery,
  markOrderAsDelivered,
};
