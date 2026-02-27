// redisClient.js
import Redis from "ioredis";
import dotenv from "dotenv"; 

dotenv.config();

 const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
   enableReadyCheck: false, 
  // Optional: you can enable TLS if your Redis Cloud requires it
  tls: process.env.REDIS_TLS === "true" ? {} : undefined,
});

// Test connection
redis.on("connect", () => {
  console.log("✅ Connected to Redis successfully!");
});

redis.on("error", (err) => {
  console.error("❌ Redis connection error:", err);
});

export default redis;


