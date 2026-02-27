import { Worker } from "bullmq";
import { fileQueue } from "./file.queue.js";
import { extractTextFromFiles } from "../services/file.service.js";
import { upsertVector } from "../services/vector.service.js";

const worker = new Worker(
  "file-processing",
  async (job) => {
    const { userId, files, text, allowOCR = false } = job.data;

    let fileText = text || "";
    if (files?.length) {
      fileText = await extractTextFromFiles(files, { allowOCR });
    }

    if (fileText.trim()) {
      await upsertVector(userId, fileText);
    }

    return { ok: true };
  },
  {
    connection: fileQueue.opts.connection,
    concurrency: 2,
    lockDuration: 5 * 60 * 1000,
  }
);

worker.on("completed", (job) => console.log(`✅ File processed: ${job.id}`));
worker.on("failed", (job, err) => console.error(`❌ File processing failed: ${job.id}`, err));

export default worker;
