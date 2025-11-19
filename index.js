// index.js
import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";

import connectDB from "./config/db.js";
import {connectRedis} from "./config/redisClient.js"

import userRoutes from "./routes/userRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import shippingAddressRoutes from "./routes/shippingAddressRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import proxyRoutes from "./routes/proxyRoutes.js";
import wishlistRoutes from "./routes/wishlistRoutes.js";
import cProductRoutes from "./routes/cProductRoutes.js";
import resetFreeTries from "./controllers/resetTriesCron.js";
import triesRoutes from "./routes/triesRoutes.js";
import generateImageRoutes from "./routes/generateImageRoutes.js";
import emailOtpRoutes from "./routes/emailOtpRoutes.js";

import {errorHandler, notFound } from './middlewares/errorHandler.js';
import corsOptions from "./config/corsOptions.js";
import helmet from "helmet";

dotenv.config();
const port = process.env.PORT || 5000;

const app = express();
resetFreeTries();

app.set("trust proxy", 1); // for express rate limit trusting proxy headers (Render and vercel)
app.use(helmet())
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api/users", userRoutes);
app.use("/api/category", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/shipping", shippingAddressRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payment", proxyRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/cproducts", cProductRoutes);
app.use("/api/tries", triesRoutes);
app.use("/api/generate-image", generateImageRoutes);
app.use("/api/email-otp", emailOtpRoutes);
app.use("/api/health", (req, res) => {
  res.send("Server is running");
});

app.use(notFound)
app.use(errorHandler);

const startServer = async () => {
  try {
    await connectDB();
    await connectRedis();

    app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
    });
  } catch (err) {
    console.error("❌ Server failed to start due to DB/Redis issue.");
    process.exit(1);
  }
};

startServer();

