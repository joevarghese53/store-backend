// productController.js
import asyncHandler from "../middlewares/asyncHandler.js";
import Product from "../models/productModel.js";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

// R2 Configuration
const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.CLOUDFLARE_BUCKET_NAME;

// Helpers
const parseImagesField = (images) => {
  if (!images) return [];
  if (Array.isArray(images)) return images;
  try {
    return JSON.parse(images);
  } catch {
    throw new Error("Invalid images format");
  }
};

// @desc    Create product
// @route   POST /api/products
// @access  Admin
const addProduct = asyncHandler(async (req, res) => {
  const { name, description, price, category, countInStock, offers, returnPolicy } =
    req.fields;

  const imagesArray = parseImagesField(req.fields.images);

  switch (true) {
    case !name:
      res.status(400);
      throw new Error("Name is required");
    case !description:
      res.status(400);
      throw new Error("Description is required");
    case !price:
      res.status(400);
      throw new Error("Price is required");
    case !category:
      res.status(400);
      throw new Error("Category is required");
    case !countInStock:
      res.status(400);
      throw new Error("Count in stock is required");
    case !offers:
      res.status(400);
      throw new Error("Offers is required");
    case !returnPolicy:
      res.status(400);
      throw new Error("Return policy is required");
  }

  const product = new Product({
    name,
    description,
    price,
    category,
    countInStock,
    offers,
    returnPolicy,
    frontImage: req.fields.frontImage,
    backImage: req.fields.backImage,
    frontDesign: req.fields.frontDesign,
    backDesign: req.fields.backDesign,
    frontUpload: req.fields.frontUpload,
    backUpload: req.fields.backUpload,
    images: imagesArray,
  });

  const createdProduct = await product.save();
  res.status(201).json(createdProduct);
});

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Admin
const updateProductDetails = asyncHandler(async (req, res) => {
  const { name, description, price, category, countInStock, offers, returnPolicy, frontImage, backImage, frontDesign, backDesign, frontUpload, backUpload } =
    req.fields;

  const imagesArray = parseImagesField(req.fields.images);

  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  if(name){
    product.name = name
  }
  if(description){
    product.description = description
  }
  if(price){
    product.price = price
  }
  if(category){
    product.category = category
  }
  if(countInStock){
    product.countInStock = countInStock
  }
  if(offers){
    product.offers = offers
  }
  if(returnPolicy){
    product.returnPolicy = returnPolicy
  }
  if(frontImage){
    product.frontImage = frontImage
  }
  if(backImage){
    product.backImage = backImage
  }
  if(frontDesign){
    product.frontDesign = frontDesign
  }
  if(backDesign){
    product.backDesign = backDesign
  }
  if(frontUpload){
    product.frontUpload = frontUpload
  }
  if(backUpload){
    product.backUpload = backUpload
  }
  if(imagesArray.length > 0){
    product.images = imagesArray
  }

  const updatedProduct = await product.save();
  res.json(updatedProduct);
});

// @desc    Delete product + all images from R2
// @route   DELETE /api/products/:id
// @access  Admin
const removeProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  const imageUrls = [
    product.frontImage,
    product.backImage,
    product.frontDesign,
    product.backDesign,
    ...(product.images || []),
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
      // we don't throw here; product is already deleted in DB
    }
  });

  await Promise.all(deletePromises);

  res.json({ message: "Product and associated images deleted successfully" });
});

// @desc    Delete a single image from product + R2
// @route   DELETE /api/products/delete-image
// @access  Admin
const removeProductImage = asyncHandler(async (req, res) => {
  const { product_id, image_url } = req.body;

  if (!product_id || !image_url) {
    res.status(400);
    throw new Error("Product ID and image URL are required");
  }

  const product = await Product.findById(product_id);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  const allImages = [
    product.frontImage,
    product.backImage,
    product.frontDesign,
    product.backDesign,
    ...(product.images || []),
  ].filter(Boolean);

  if (!allImages.includes(image_url)) {
    res.status(404);
    throw new Error("Image URL not associated with this product");
  }

  const fileName = image_url.split("/").pop();

  try {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
      })
    );
  } catch (err) {
    console.error("Failed to delete from R2:", err.message);
    res.status(500);
    throw new Error("Failed to delete image from storage");
  }

  if (product.frontImage === image_url) product.frontImage = null;
  if (product.backImage === image_url) product.backImage = null;
  if (product.frontDesign === image_url) product.frontDesign = null;
  if (product.backDesign === image_url) product.backDesign = null;
  product.images = (product.images || []).filter((url) => url !== image_url);

  await product.save();

  res.json({ message: "Image deleted successfully" });
});

// @desc    Get products (basic search + pageSize=6)
// @route   GET /api/products
// @access  Public
const fetchProducts = asyncHandler(async (req, res) => {
  const pageSize = 6;

  const keyword = req.query.keyword
    ? {
      name: {
        $regex: req.query.keyword,
        $options: "i",
      },
    }
    : {};

  const count = await Product.countDocuments({ ...keyword });
  const products = await Product.find({ ...keyword }).limit(pageSize);

  res.json({
    products,
    page: 1,
    pages: Math.ceil(count / pageSize),
    hasMore: false,
  });
});

// @desc    Get single product by ID
// @route   GET /api/products/:id
// @access  Public
const fetchProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate("category");

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  res.json(product);
});

// @desc    Get all products (admin listing)
// @route   GET /api/products/allproducts
// @access  Admin / Public (depending on your route protection)
//
const fetchAllProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({})
    .populate("category")
    .sort({ createdAt: -1 });

  res.json(products);
});

// @desc    Add review to product
// @route   POST /api/products/:id/reviews
// @access  Private
const addProductReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;
  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  const alreadyReviewed = product.reviews.find(
    (r) => r.user.toString() === req.user._id.toString()
  );

  if (alreadyReviewed) {
    res.status(400);
    throw new Error("Product already reviewed");
  }

  const review = {
    name: req.user.username,
    rating: Number(rating),
    comment,
    user: req.user._id,
  };

  product.reviews.push(review);
  product.numReviews = product.reviews.length;
  product.rating =
    product.reviews.reduce((acc, item) => item.rating + acc, 0) /
    product.reviews.length;

  await product.save();
  res.status(201).json({ message: "Review added" });
});

// @desc    Get top rated products, optional filter
// @route   GET /api/products/top
// @access  Public
const fetchTopProducts = asyncHandler(async (req, res) => {
  const products = await Product.find()
    .sort({ rating: -1 })
    .populate("category")
    .limit(4);

  res.json(products);
});

// @desc    Get latest products
// @route   GET /api/products/new
// @access  Public
const fetchLatestProducts = asyncHandler(async (req, res) => {
  const products = await Product.find().sort({ createdAt: -1 }).limit(5);
  res.json(products);
});

// @desc    Filter products by category, price range
// @route   POST /api/products/filtered-products
// @access  Public
const filterProducts = asyncHandler(async (req, res) => {
  const { checked = [], radio } = req.body;
  const args = {};

  if (Array.isArray(checked) && checked.length > 0) {
    args.category = { $in: checked };
  }

  if (radio?.length === 2) {
    args.price = { $gte: radio[0], $lte: radio[1] };
  }

  const products = await Product.find(args).populate("category");
  res.json(products);
});

const uploadImages = async (req, res) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).json({ message: "No image files provided" });
  }

  const allowedFields = [
    "frontImage",
    "backImage",
    "frontDesign",
    "backDesign",
    "frontUpload",
    "backUpload",
    "images",
  ];

  try {
    const uploadedImages = {};

    for (const [field, files] of Object.entries(req.files)) {
      if (!allowedFields.includes(field)) {
        return res.status(400).json({ message: `Invalid field: ${field}` });
      }

      uploadedImages[field] = [];

      for (const file of files) {
        const { uploadToR2 } = await import("../services/r2Service.js");
        const url = await uploadToR2(file);
        uploadedImages[field].push(url);
      }
    }

    return res.status(200).json({
      message: "Images uploaded successfully",
      imageUrls: uploadedImages,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({
      message: "Image upload failed",
      error: error.message,
    });
  }
};


export {
  addProduct,
  updateProductDetails,
  removeProduct,
  removeProductImage,
  fetchProducts,
  fetchProductById,
  fetchAllProducts,
  addProductReview,
  fetchTopProducts,
  fetchLatestProducts,
  filterProducts,
  uploadImages
};
