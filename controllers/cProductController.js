// controllers/cProductController.js
import cProduct from "../models/cProductModel.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
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

const addToCProducts = asyncHandler(async (req, res) => {

  try {
    const { name, description, price, category, offers, returnpolicy } = req.fields;
    console.log(req.fields);
    // Validation
    switch (true) {
      case !name:
        return res.status(400).json({ error: "Name is required" });
      case !description:
        return res.status(400).json({ error: "Description is required" });
      case !price:
        return res.status(400).json({ error: "Price is required" });
      case !category:
        return res.status(400).json({ error: "Category is required" });
      case !offers:
        return res.status(400).json({ error: "Offers are required" });
      case !returnpolicy:
        return res.status(400).json({ error: "Return Policy is required" });
    }

    const customProduct = { ...req.fields };

    let cProductContainer = await cProduct.findOne({ userId: req.user._id });

    if (cProductContainer) {

      console.log(`Custom Product Container found, adding new custom product`);
      cProductContainer.customProducts.push(customProduct);

    } else {

      console.log(`Custom Product Container not found, creating a new container with custom product`);
      cProductContainer = new cProduct({
        userId: req.user._id,
        customProducts: [customProduct],
      });
    }


    await cProductContainer.save();
    res.status(201).json(cProductContainer);
    console.log(cProductContainer);

  } catch (error) {
    console.log(error);
    res.status(400).json({ error: error.message });
  }

});

const getCProducts = asyncHandler(async (req, res) => {
  try {
    const cProductContainer = await cProduct.findOne({ userId: req.user._id }).populate("customProducts.category")
    .sort({ createAt: -1 });

    if (!cProductContainer) {
      return res.status(404).json({ message: "No custom products found for this user" });
    }

    res.status(200).json(cProductContainer);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Server error while fetching products" });
  }
});

const deleteCProduct = asyncHandler(async (req, res) => {
  try {
    const { productId } = req.params;

    let cProductContainer = await cProduct.findOne({ userId: req.user._id });

    if (!cProductContainer) {
      return res.status(404).json({ message: "Custom product container not found for this user" });
    }

    const productIndex = cProductContainer.customProducts.findIndex(
      (product) => product._id.toString() === productId
    );

    if (productIndex === -1) {
      return res.status(404).json({ message: "Product not found" });
    }

        // Extract image URLs from the product to delete
    const productToDelete = cProductContainer.customProducts[productIndex];

    const imageUrls = [
      productToDelete.frontImage,
      productToDelete.backImage,
      productToDelete.frontDesign,
      productToDelete.backDesign,
      ...(productToDelete.images || []),
    ].filter(Boolean); // remove null/undefined

    // Delete images from Cloudflare R2
    const deletePromises = imageUrls.map(async (url) => {
      const fileName = url.split("/").pop();
      console.log("Deleting file from R2:", fileName);

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
    
    cProductContainer.customProducts.splice(productIndex, 1); // Remove product from the array

    await cProductContainer.save();

    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Server error while deleting the product" });
  }
});

const fetchCProductById = asyncHandler(async (req, res) => {
  try {
    const { productId } = req.params;
    console.log("This is the prod id",productId);

    let cProductContainer = await cProduct.findOne({ userId: req.user._id }).populate("customProducts.category", "name");

    console.log(cProductContainer);

    if (!cProductContainer) {
      return res.status(404).json({ message: "Custom product container not found for this user" });
    }

    const product = cProductContainer.customProducts.find(
      (product) => product._id.toString() === productId
    );

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const modifiedProduct = {
      ...product.toObject(), // Convert Mongoose document to plain JS object
      category: product.category.name // Replace category with just its name
    };

    res.status(200).json(modifiedProduct);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Server error while fetching the product" });
  }
}
);

export { addToCProducts, getCProducts, deleteCProduct, fetchCProductById };