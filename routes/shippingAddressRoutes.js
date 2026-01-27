import express from "express";
const router = express.Router();
import {
  createShippingAddress,
  getUserShippingAddresses,
  updateShippingAddress,
  deleteShippingAddress,
  setDefaultShippingAddress
} from '../controllers/shippingAddressController.js';
import { authenticate } from "../middlewares/authMiddleware.js";
import checkId from "../middlewares/checkId.js";

router.route('/')
  .post(authenticate, createShippingAddress)
  .get(authenticate, getUserShippingAddresses);

router.route('/:id')
  .put(authenticate, checkId, updateShippingAddress)
  .delete(authenticate, checkId, deleteShippingAddress);

router
  .route("/:id/default")
  .patch(authenticate, checkId, setDefaultShippingAddress);

export default router;

// --------------------- Checked --------------------