// redisClient.js
import { createClient } from 'redis';
import dotenv from "dotenv";
dotenv.config()

const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  console.warn("⚠️  REDIS_URL is not set. Redis will be disabled.");
}

const redisClient = createClient({
  url: REDIS_URL,
  socket: {
    keepAlive: 30000,            // Prevent idle disconnects (NAT/LB timeouts)
    reconnectStrategy: (retries) => {
      // Stop after too many retries
      if (retries > 10) {
        console.error("❌ Redis: Max reconnection attempts reached");
        return new Error("Redis reconnection failed");
      }ß
      // Exponential backoff
      const delay = Math.min(1000 * 2 ** retries, 30000);
      console.log(`🔄 Redis reconnecting in ${delay}ms...`);
      return delay;
    },
    timeout: 10000,              // Connect timeout 10s
  },
  maxRetriesPerRequest: 3,       // Fail fast instead of queueing forever
  pingInterval: 30000            // Periodic ping to keep connection alive
});

// --- Event Logging ---
redisClient.on("connect", () => console.log("🔌 Redis: Connecting..."));
redisClient.on("ready", () => console.log("✅ Redis: Connected & Ready"));
redisClient.on("reconnecting", () => console.log("🔄 Redis: Attempting reconnect..."));
redisClient.on("end", () => console.log("🛑 Redis: Connection closed"));
redisClient.on("error", (err) => console.error("❌ Redis Error:", err));

const connectRedis = async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
      console.log("✅ Redis connected successfully");
    }
  } catch (err) {
    console.error("Redis connection failed:", err);
  }
};



export {redisClient, connectRedis}
