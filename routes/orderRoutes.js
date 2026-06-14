//orderRoutes.js
import express from "express";
import {
  createOrder,
  getAllOrders,
  getUserOrders,
  countTotalOrdersByDate,
  calculateTotalSales,
  calculateTotalProductsSoldByDate,
  calculateTotalSalesByDate,
  findOrderById,
  markOrderAsPaid,
  markOrderAsConfirmed,
  markOrderAsDelivered,
  markOrderAsShipped,
  markOrderAsOutForDelivery,
  initiatePayment,
} from "../controllers/orderController.js";
import { authenticate, authorizeAdmin } from "../middlewares/authMiddleware.js";
import { rateLimiters } from "../utils/rateLimiters.js";

const router = express.Router();

router.route("/").post(authenticate, createOrder)
router.route("/initiate-payment").post(authenticate, rateLimiters.paymentLimiter, initiatePayment);
router.route("/mine").get(authenticate, getUserOrders);
router.route("/:id").get(authenticate, findOrderById);
router.route("/:id/confirm").put(authenticate, authorizeAdmin, markOrderAsConfirmed);
router.route("/:id/shipped").put(authenticate, authorizeAdmin, markOrderAsShipped);
router.route("/:id/out-for-delivery").put(authenticate, authorizeAdmin, markOrderAsOutForDelivery);
router.route("/:id/delivered").put(authenticate, authorizeAdmin, markOrderAsDelivered);

// Admin route to get all orders
router.route("/admin/all").get(authenticate, authorizeAdmin, getAllOrders);
router.route("/admin/total-orders").get(authenticate, authorizeAdmin, countTotalOrdersByDate);
router.route("/admin/total-sales").get(authenticate, authorizeAdmin, calculateTotalSales);
router.route("/admin/total-sales-by-date").get(authenticate, authorizeAdmin, calculateTotalSalesByDate);
router.route("/admin/total-products-sold").get(authenticate, authorizeAdmin, calculateTotalProductsSoldByDate);

export default router;
