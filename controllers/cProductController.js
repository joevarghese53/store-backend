// controllers/cProductController.js
import cProduct from "../models/cProductModel.js";
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
  const { name, description, price, category, offers, returnPolicy } = req.fields;

  switch (true) {
    case !name:
      return res.status(400).json({ error: "Name is required" });
    case !description:
      return res.status(400).json({ error: "Description is required" });
    case !price:
      return res.status(400).json({ error: "Price is required" });
    case isNaN(Number(price)) || Number(price) <= 0:
      return res.status(400).json({ error: "Price must be a positive number" });
    case !category:
      return res.status(400).json({ error: "Category is required" });
    case !offers:
      return res.status(400).json({ error: "Offers are required" });
    case !returnPolicy:
      return res.status(400).json({ error: "Return Policy is required" });
  }

  const customProduct = {
    name,
    description,
    price: Number(price),
    category,
    offers,
    returnPolicy,
    frontImage: req.fields.frontImage,
    backImage: req.fields.backImage,
    frontDesign: req.fields.frontDesign,
    backDesign: req.fields.backDesign,
    frontUpload: req.fields.frontUpload,
    backUpload: req.fields.backUpload,
  };

  let cProductContainer = await cProduct.findOne({ userId: req.user._id });

  if (cProductContainer) {
    cProductContainer.customProducts.push(customProduct);
  } else {
    cProductContainer = new cProduct({
      userId: req.user._id,
      customProducts: [customProduct],
    });
  }

  await cProductContainer.save();
  res.status(201).json(cProductContainer);
});

// @desc Get all custom products for current user
const getCProducts = asyncHandler(async (req, res) => {
  const cProductContainer = await cProduct
    .findOne({ userId: req.user._id })
    .populate("customProducts.category", "name");

  if (!cProductContainer) {
    return res.status(200).json({
      userId: req.user._id,
      customProducts: [],
    });
  }

  res.status(200).json(cProductContainer);
});

// @desc Delete single custom product for current user
const deleteCProduct = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  let cProductContainer = await cProduct.findOne({ userId: req.user._id });

  if (!cProductContainer) {
    return res
      .status(404)
      .json({ message: "Custom product container not found for this user" });
  }

  const productIndex = cProductContainer.customProducts.findIndex(
    (product) => product._id.toString() === productId
  );

  if (productIndex === -1) {
    return res.status(404).json({ message: "Product not found" });
  }

  const productToDelete = cProductContainer.customProducts[productIndex];

  const imageUrls = [
    productToDelete.frontImage,
    productToDelete.backImage,
    productToDelete.frontDesign,
    productToDelete.backDesign,
    ...(productToDelete.images || []),
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

  cProductContainer.customProducts.splice(productIndex, 1);
  await cProductContainer.save();

  res.status(200).json({ message: "Product deleted successfully" });
});

// @desc Get one custom product by id for current user
const fetchCProductById = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const cProductContainer = await cProduct
    .findOne({ userId: req.user._id })
    .populate("customProducts.category", "name");

  if (!cProductContainer) {
    return res
      .status(404)
      .json({ message: "Custom product container not found for this user" });
  }

  const product = cProductContainer.customProducts.find(
    (product) => product._id.toString() === productId
  );

  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  const modifiedProduct = {
    ...product.toObject(),
    category: product.category?.name || null,
  };

  res.status(200).json(modifiedProduct);
});

export { addToCProducts, getCProducts, deleteCProduct, fetchCProductById };