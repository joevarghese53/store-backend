// index.js
import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import { initRateLimiters } from "./utils/rateLimiters.js";

import connectDB from "./config/db.js";
import { connectRedis, redisClient } from "./config/redisClient.js"
import mongoose from "mongoose";
import userRoutes from "./routes/userRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import shippingAddressRoutes from "./routes/shippingAddressRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import wishlistRoutes from "./routes/wishlistRoutes.js";
import cProductRoutes from "./routes/cProductRoutes.js";
import triesRoutes from "./routes/triesRoutes.js";
import generateImageRoutes from "./routes/generateImageRoutes.js";
import emailOtpRoutes from "./routes/emailOtpRoutes.js";
import phonepeWebhookRoutes from "./routes/phonepeWebhookRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";

import { errorHandler, notFound } from './middlewares/errorHandler.js';
import corsOptions from "./config/corsOptions.js";
import helmet from "helmet";
import dns from "node:dns/promises";


dotenv.config();
const port = process.env.PORT || 5000;

const app = express();

dns.setServers(["1.1.1.1"])
app.set("trust proxy", 1); // for express rate limit trusting proxy headers (Render and vercel)
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors(corsOptions));
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());

app.use("/api/users", userRoutes);
app.use("/api/category", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/shipping", shippingAddressRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/cproducts", cProductRoutes);
app.use("/api/tries", triesRoutes);
app.use("/api/generate-image", generateImageRoutes);
app.use("/api/email-otp", emailOtpRoutes);
app.use("/api/phonepe-webhook", phonepeWebhookRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/health", (req, res) => {
  res.send("Server is running");
});

app.get("/", (req, res) => {
  res.redirect("/api/health");
});

app.use(notFound)
app.use(errorHandler);

const startServer = async () => {
  try {
    await connectDB();
    await connectRedis();
    initRateLimiters(); // Initialize rate limiters after Redis connection

    app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
    });
  } catch (err) {
    console.error("❌ Server failed to start due to DB/Redis issue.");
    process.exit(1);
  }
};

startServer();

let shuttingDown = false;

const shutdown = async () => {

  if (shuttingDown) return;
  shuttingDown = true;

  if (process.env.NODE_ENV !== "production") {
    console.log("🛑 Shutting down server...");
  }

  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close(false);
    }
    if (redisClient?.isOpen) {
      await redisClient.quit();
    }
  } catch (err) {
    console.error("Shutdown error:", err.message);
  } finally {
    process.exit(0);
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);




// ----------------checked----------------