//orderRoutes.js

import express from "express";
const router = express.Router();

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
} from "../controllers/orderController.js";

import { authenticate, authorizeAdmin } from "../middlewares/authMiddleware.js";

router
  .route("/")
  .post(authenticate, createOrder)
  .get(authenticate, authorizeAdmin, getAllOrders);

router.route("/mine").get(authenticate, getUserOrders);
router.route("/total-orders").get(authenticate, authorizeAdmin, countTotalOrdersByDate);
router.route("/total-sales").get(authenticate, authorizeAdmin, calculateTotalSales);
router.route("/total-sales-by-date").get(authenticate, authorizeAdmin, calculateTotalSalesByDate);
router.route("/total-products-sold").get(authenticate, authorizeAdmin, calculateTotalProductsSoldByDate);
router.route("/:id").get(authenticate, findOrderById);
router.route("/:id/markOrderAsPaid").put(authenticate, authorizeAdmin, markOrderAsPaid);
router
  .route("/:id/delivered")
  .put(authenticate, authorizeAdmin, markOrderAsDelivered);
router
  .route("/:id/confirm")
  .put(authenticate, authorizeAdmin, markOrderAsConfirmed);
router
  .route("/:id/shipped")
  .put(authenticate, authorizeAdmin, markOrderAsShipped);
router
  .route("/:id/out-for-delivery")
  .put(authenticate, authorizeAdmin, markOrderAsOutForDelivery);

export default router;
