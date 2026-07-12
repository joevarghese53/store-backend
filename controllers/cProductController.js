// controllers/cProductController.js
import cProduct from "../models/cProductModel.js";
import Cart from "../models/cartModel.js";
import Category from "../models/categoryModel.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { uploadToR2 } from "../services/r2Service.js";
import { C_PRODUCT_CONFIG } from "../config/cProductConfig.js";
import { categoryMap } from "../config/categoryMap.js";
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

export const calculateProductPrice = (
  category,
  hasFrontDesign,
  hasBackDesign
) => {
  const config = C_PRODUCT_CONFIG[category];

  if (!config) {
    throw new Error("Invalid category");
  }

  let price = config.basePrice;

  if (hasFrontDesign) {
    price += config.designPrice;
  }

  if (hasBackDesign) {
    price += config.designPrice;
  }

  return price;
};

// @desc Add a new custom product for the current user
const addToCProducts = asyncHandler(async (req, res) => {
  const {
    prompt,
    category,
  } = req.body;

  // Upload Images
  if (!req.files?.frontImage && !req.files?.backImage) {
    return res.status(400).json({
      message: "At least one design is required.",
    });
  }
  const [
    frontImage,
    backImage,
    frontDesign,
    backDesign,
  ] = await Promise.all([
    req.files?.frontImage?.[0]
      ? uploadToR2(req.files.frontImage[0])
      : Promise.resolve(null),

    req.files?.backImage?.[0]
      ? uploadToR2(req.files.backImage[0])
      : Promise.resolve(null),

    req.files?.frontDesign?.[0]
      ? uploadToR2(req.files.frontDesign[0])
      : Promise.resolve(null),

    req.files?.backDesign?.[0]
      ? uploadToR2(req.files.backDesign[0])
      : Promise.resolve(null),
  ]);

  // Calculate Price and find category ID
  const config = C_PRODUCT_CONFIG[category];
  const hasFrontDesign = !!frontDesign;
  const hasBackDesign = !!backDesign;
  const price = calculateProductPrice(
    category,
    hasFrontDesign,
    hasBackDesign
  );
  const categoryDoc = await Category.findOne({ slug: category });
  if (!categoryDoc) {
    console.error("Category not found:", categoryMap[category]);
    return res.status(400).json({
      message: "Invalid category",
    });
  }

  const product = await cProduct.create({
    userId: req.user._id,
    name: "FlowState Customs" + prompt.slice(0, 10) + "...",
    description: config.description,
    price: Number(price),
    category: categoryDoc._id,
    offers: config.offers,
    returnPolicy: config.returnPolicy,
    frontImage,
    backImage,
    frontDesign,
    backDesign,
  });

  console.log("New custom product created:", product);
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