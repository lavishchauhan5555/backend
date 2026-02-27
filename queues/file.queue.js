import { Queue } from "bullmq";
import  redis  from "../utils/redis.js";

export const fileQueue = new Queue("file-processing", {
  connection: redis,
});
