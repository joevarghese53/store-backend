//productController.js
import asyncHandler from "../middlewares/asyncHandler.js";
import Product from "../models/productModel.js";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
dotenv.config(); 

// R2 Configuration (same as your upload logic)
const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.CLOUDFLARE_BUCKET_NAME;

const addProduct = asyncHandler(async (req, res) => {
  try {
    const { name, description, price, category, gender, offers, returnpolicy } = req.fields;
    console.log("req fields",req.fields);
    const { images } = req.fields;
    const imagesArray = images ? JSON.parse(images) : [];
    console.log("imagesArray",imagesArray);
    // Validation
    switch (true) {
      case !name:
        return res.json({ error: "Name is required" });
      case !gender:
        return res.json({ error: "Gender is required" });
      case !description:
        return res.json({ error: "Description is required" });
      case !price:
        return res.json({ error: "Price is required" });
      case !category:
        return res.json({ error: "Category is required" });
      case !offers:
        return res.json({ error: "Offers is required" });
      case !returnpolicy:
        return res.json({ error: "Return Policy is required" });
    }

    const product = new Product({ ...req.fields, images : imagesArray });
    await product.save();
    res.json(product);
    console.log(product);
  } catch (error) {
    console.log(error);
    res.status(400).json(error.message);
  }
});

const updateProductDetails = asyncHandler(async (req, res) => {
  try {
    const { name, description, price, category, gender, offers, returnpolicy } = req.fields;
    const { images } = req.fields;
    const imagesArray = images ? JSON.parse(images) : [];
    console.log("imagesArray",imagesArray);

    // Validation
    switch (true) {
      case !name:
        return res.json({ error: "Name is required" });
      case !gender:
        return res.json({ error: "Gender is required" });
      case !description:
        return res.json({ error: "Description is required" });
      case !price:
        return res.json({ error: "Price is required" });
      case !category:
        return res.json({ error: "Category is required" });
      case !offers:
        return res.json({ error: "Offers is required" });
      case !returnpolicy:
        return res.json({ error: "Return Policy is required" });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { ...req.fields, images : imagesArray },
      { new: true }
    );

    await product.save();

    res.json({product, success: true});
  } catch (error) {
    console.error(error);
    res.status(400).json(error.message);
  }
});

const removeProduct = asyncHandler(async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Collect all image URLs to delete
    const imageUrls = [
      product.frontImage,
      product.backImage,
      product.frontDesign,
      product.backDesign,
      ...product.images,
    ].filter(Boolean); 

    const deletePromises = imageUrls.map(async (url) => {
      const fileName = url.split("/").pop(); // Extract file name
      console.log("Deleting file:", fileName);

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

    res.json({ message: "Product and associated images deleted successfully from R2" });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ error: "Server error" });
  }
});


const removeProductImage = asyncHandler(async (req, res) => {
  try {
    const { product_id, image_url } = req.body;

    if (!product_id || !image_url) {
      return res.status(400).json({ message: "Product ID and image URL are required" });
    }

    const product = await Product.findById(product_id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const allImages = [
      product.frontImage,
      product.backImage,
      product.frontDesign,
      product.backDesign,
      ...product.images,
    ];

    if (!allImages.includes(image_url)) {
      return res.status(404).json({ message: "Image URL not associated with the product" });
    }

    // ✅ Extract file name from the URL
    const fileName = image_url.split("/").pop();

    // ✅ Delete from Cloudflare R2
    try {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fileName,
        })
      );
    } catch (err) {
      console.error("Failed to delete from R2:", err.message);
      return res.status(500).json({ message: "Failed to delete image from R2" });
    }

    // ✅ Update product record
    if (product.frontImage === image_url) product.frontImage = null;
    if (product.backImage === image_url) product.backImage = null;
    if (product.frontDesign === image_url) product.frontDesign = null;
    if (product.backDesign === image_url) product.backDesign = null;
    product.images = product.images.filter((url) => url !== image_url);

    await product.save();

    res.json({ message: "Image deleted successfully from Cloudflare R2" });
  } catch (error) {
    console.error("Error deleting product image:", error);
    res.status(500).json({ error: "Server error" });
  }
});



const fetchProducts = asyncHandler(async (req, res) => {
  try {
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
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Error" });
  }
});

const fetchProductById = asyncHandler(async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (product) {
      return res.json(product);
    } else {
      res.status(404).json({ error: "Product not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(404).json({ error: "Product not found" });
  }
});

const fetchAllProducts = asyncHandler(async (req, res) => {
  try {
    const products = await Product.find({})
      .populate("category")
      .sort({ createAt: -1 });

    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Error" });
  }
});

const addProductReview = asyncHandler(async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const product = await Product.findById(req.params.id);

    if (product) {
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
    } else {
      res.status(404);
      throw new Error("Product not found");
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error.message);
  }
});

const fetchTopProducts = asyncHandler(async (req, res) => {
  try {
    const { gender } = req.query;
    let query = {};
    if (gender) {
      query.gender = gender; 
    }
    const products = await Product.find(query).sort({ rating: -1 })
      .populate("category")
      .limit(4);
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(400).json(error.message);
  }
});

const fetchNewProducts = asyncHandler(async (req, res) => {
  try {
    const products = await Product.find().sort({ _id: -1 }).limit(5);
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(400).json(error.message);
  }
});

const filterProducts = asyncHandler(async (req, res) => {
  try {
    const { checked, radio, gender } = req.body; // Accept gender from the request body
    let args = {};

    // Filter by gender
    if (gender) {
      args.gender = gender; // Add gender filter based on request
    }

    // Filter by category
    if (checked.length > 0) {
      args.category = { $in: checked }; // Ensure this handles multiple categories
    }

    // Filter by price range
    if (radio?.length === 2) {
      args.price = { $gte: radio[0], $lte: radio[1] }; // Apply the price range filter
    }

    const products = await Product.find(args).populate("category");
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server Error" });
  }
});



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
  fetchNewProducts,
  filterProducts,
};
