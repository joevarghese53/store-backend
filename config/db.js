// config/db.js
import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 10,       // good default
      serverSelectionTimeoutMS: 10000, // fail fast if Mongo is unreachable
    });

    console.log(`📦 MongoDB Connected: ${conn.connection.host}`);

    // Connection events (runtime monitoring)
    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️ MongoDB disconnected!");
    });

    mongoose.connection.on("reconnected", () => {
      console.log("🔁 MongoDB reconnected!");
    });

    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB error:", err);
    });

  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    throw error; // Let caller handle it
  }
};

export default connectDB;
