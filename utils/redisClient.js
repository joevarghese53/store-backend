// redisClient.js
import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL,
  token: process.env.REDIS_TOKEN,
});

redisClient.on('error', (err) => console.error('Redis error:', err));

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

connectRedis(); // call it on import

export default redisClient;
