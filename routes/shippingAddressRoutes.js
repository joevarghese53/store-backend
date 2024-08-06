import express from "express";
const router = express.Router();
import {
    createShippingAddress,
    getUserShippingAddresses,
    updateShippingAddress,
    deleteShippingAddress,
  } from '../controllers/shippingAddressController.js';
  import { authenticate } from "../middlewares/authMiddleware.js";

  router.route('/')
  .post(authenticate, createShippingAddress)
  .get(authenticate, getUserShippingAddresses);

router.route('/:id')
  .put(authenticate, updateShippingAddress)
  .delete(authenticate, deleteShippingAddress);

export default router;
