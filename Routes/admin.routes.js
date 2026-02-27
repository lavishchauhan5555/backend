import express from "express";
import redis from "../utils/redis.js";


const router = express.Router();

router.delete("/cache/clear", async (req, res) => {
  try {
    // console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(redis)));

    await redis.flushdb();

    res.json({ message: "Redis cache cleared" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
