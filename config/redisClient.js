// config/redisClient.js
import { createClient } from "redis";
import dotenv from "dotenv";
dotenv.config();

const REDIS_URL = process.env.REDIS_URL;

let redisClient = null;

if (!REDIS_URL) {
  console.warn("⚠️ REDIS_URL not set. Redis disabled.");
} else {
  redisClient = createClient({
    url: REDIS_URL,
    socket: {
      keepAlive: 30000,
      timeout: 10000,
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          return new Error("Redis reconnection failed");
        }
        return Math.min(1000 * 2 ** retries, 30000);
      },
    },
    maxRetriesPerRequest: 3,
    pingInterval: 30000,
  });

  redisClient.on("ready", () => console.log("✅ Redis ready"));
  redisClient.on("error", (err) => console.error("❌ Redis error:", err));
}

const connectRedis = async () => {
  if (!redisClient) return;

  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  } catch (err) {
    console.error("❌ Redis connection failed:", err.message);
    if (process.env.NODE_ENV === "production") {
      throw err;
    }
  }
};

export { redisClient, connectRedis };


// ----------------checked----------------