// controllers/cProductController.js
import cProduct from "../models/cProductModel.js";
import Cart from "../models/cartModel.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

// R2 Config
const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.CLOUDFLARE_BUCKET_NAME;

// @desc Add a new custom product for the current user
const addToCProducts = asyncHandler(async (req, res) => {
  if (!req.fields.name) {
    return res.status(400).json({ message: "Name is required" });
  }

  if (!req.fields.category) {
    return res.status(400).json({ message: "Category is required" });
  }

  if (!req.fields.price || isNaN(Number(req.fields.price))) {
    return res.status(400).json({ message: "Valid price is required" });
  }
  const product = await cProduct.create({
    userId: req.user._id,
    name: req.fields.name,
    description: req.fields.description,
    price: Number(req.fields.price),
    category: req.fields.category,
    offers: req.fields.offers,
    returnPolicy: req.fields.returnPolicy,
    frontImage: req.fields.frontImage || "",
    backImage: req.fields.backImage || "",
    frontDesign: req.fields.frontDesign || "",
    backDesign: req.fields.backDesign || "",
    frontUpload: req.fields.frontUpload || "",
    backUpload: req.fields.backUpload || "",
  });

  res.status(201).json(product);
});

// @desc Get all custom products for current user
const getCProducts = asyncHandler(async (req, res) => {
  const products = await cProduct
    .find({ userId: req.user._id })
    .populate("category", "name")
    .sort({ createdAt: -1 });

  res.status(200).json(products);
});

// @desc Delete single custom product for current user
const deleteCProduct = asyncHandler(async (req, res) => {
  const product = await cProduct.findOne({
    _id: req.params.productId,
    userId: req.user._id,
  });

  if (!product) {
    return res.status(404).json({
      message: "Product not found",
    });
  }

  const imageUrls = [
    product.frontImage,
    product.backImage,
    product.frontDesign,
    product.backDesign,
    product.frontUpload,
    product.backUpload,
  ].filter(Boolean);

  const deletePromises = imageUrls.map(async (url) => {
    const fileName = url.split("/").pop();
    try {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fileName,
        })
      );
    } catch (err) {
      console.error(`Failed to delete ${fileName}:`, err.message);
    }
  });

  await Promise.all(deletePromises);

  // Remove product from all carts
  await Cart.updateMany(
    {
      "items.productId": product._id,
      "items.productType": "cProduct",
    },
    {
      $pull: {
        items: {
          productId: product._id,
          productType: "cProduct",
        },
      },
    }
  );

  await product.deleteOne();

  res.status(200).json({ message: "Product deleted successfully" });
});

// @desc Get one custom product by id for current user
const fetchCProductById = asyncHandler(async (req, res) => {
  const product = await cProduct
    .findOne({
      _id: req.params.productId,
      userId: req.user._id,
    })
    .populate("category", "name");

  if (!product) {
    return res.status(404).json({
      message: "Product not found",
    });
  }

  res.status(200).json(product);
});

export { addToCProducts, getCProducts, deleteCProduct, fetchCProductById };