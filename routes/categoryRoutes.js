import express from "express";
const router = express.Router();
import {
  createCategory,
  updateCategory,
  removeCategory,
  listCategory,
  readCategory,
} from "../controllers/categoryController.js";

import { authenticate, authorizeAdmin } from "../middlewares/authMiddleware.js";
import checkId from "../middlewares/checkId.js";

router.route("/")
  .get(listCategory)
  .post(authenticate, authorizeAdmin, createCategory);
router
  .route("/:id")
  .get(checkId, readCategory)
  .put(checkId, authenticate, authorizeAdmin, updateCategory)
  .delete(checkId, authenticate, authorizeAdmin, removeCategory);

export default router;
