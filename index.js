// index.js
import path from "path";
import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";

// // Utiles
import connectDB from "./config/db.js";
// import { APP_BUILD_MANIFEST } from "next/dist/shared/lib/constants.js";
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


dotenv.config();
const port = process.env.PORT || 5000;

connectDB();
const app = express();
const allowedOrigins = [
    'http://localhost:3000',
    'https://store-frontend-41hipis43-joevarghese53s-projects.vercel.app', 
    'https://store-frontend-git-main-joevarghese53s-projects.vercel.app',
    'https://store-frontend-joevarghese53s-projects.vercel.app',
    'https://store-frontend-taupe.vercel.app'
  ];

app.use(cors({ origin: allowedOrigins, credentials: true }));
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
app.use("/api/health", (req, res) => {
  res.send("Server is running");
});



// app.get("/api/config/paypal", (req, res) => {
//   res.send({ clientId: process.env.PAYPAL_CLIENT_ID });
// });


const __dirname = path.resolve();
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.listen(port, () => console.log(`Server running on port: ${port}`));

