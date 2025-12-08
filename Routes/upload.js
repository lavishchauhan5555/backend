import express from "express";
import pdfParse from "pdf-parse-new";
import { qdrant } from "../Modals/qdrant.js";
import { verifyRefreshToken } from "../utils/jwt.js";
import { chunkText } from "../utils/chunkText.js";
import User from "../Modals/user.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = express.Router();

// ========================================
// INIT GEMINI CLIENT (CORRECT)
// ========================================
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Embedding model
const EMBEDDING_MODEL = "text-embedding-004";

// ========================================
// Ensure Qdrant Collection Exists
// ========================================
async function ensureCollection(name) {
  try {
    const exists = await qdrant.getCollection(name).catch(() => null);

    if (!exists) {
      await qdrant.createCollection(name, {
        vectors: { size: 768, distance: "Cosine" },
      });
      console.log(`Created Qdrant collection: ${name}`);
    } else {
      console.log(`Qdrant collection "${name}" already exists`);
    }
  } catch (err) {
    console.error("Error ensuring Qdrant collection:", err);
    throw err;
  }
}

// ========================================
// Base64 → Buffer
// ========================================
const base64ToBuffer = (b64) => Buffer.from(b64, "base64");

// ========================================
// ⭐ CORRECT GEMINI EMBEDDING FUNCTION
// ========================================
async function getEmbedding(text) {
  try {
    const model = ai.getGenerativeModel({ model: EMBEDDING_MODEL });

    const result = await model.embedContent(text);

    if (!result.embedding || !result.embedding.values) {
      throw new Error("Empty embedding returned from Gemini");
    }

    return result.embedding.values; // Float32 array
  } catch (err) {
    console.error("Gemini Embedding Error:", err);
    throw err;
  }
}

// ========================================
// UPLOAD + PROCESS ROUTE
// ========================================
router.post("/upload", async (req, res) => {
  // Validate token
  const token = req.cookies.jid;
  if (!token) return res.status(401).json({ message: "No token" });

  let userId;
  try {
    const payload = verifyRefreshToken(token);
    userId = payload.userId;
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    let text = req.body.text || "";
    const files = req.body.files || [];

    // ========================================
    // Convert uploaded files → text
    // ========================================
    for (const f of files) {
      const buffer = base64ToBuffer(f.data);

      if (f.type === "application/pdf") {
        const pdfData = await pdfParse(buffer);
        text += "\n" + pdfData.text;
      } else if (f.type.startsWith("text")) {
        text += "\n" + buffer.toString("utf8");
      } else {
        text += `\n[Unsupported File: ${f.name}, type: ${f.type}]`;
      }
    }

    // Split into chunks
    const chunks = chunkText(text, 500);

    // ========================================
    // Create/Find User Qdrant Collection
    // ========================================
    const collection = user.twinCollection || `twin_${userId}`;
    await ensureCollection(collection);

    if (!user.twinCollection) {
      user.twinCollection = collection;
      await user.save();
    }

    // ========================================
    // Generate Embeddings for Each Chunk
    // ========================================
    const points = [];
    for (let i = 0; i < chunks.length; i++) {
      const emb = await getEmbedding(chunks[i]);

      points.push({
        id: Date.now() + i,
        vector: emb,
        payload: { text: chunks[i] },
      });
    }

    // ========================================
    // Store in Qdrant
    // ========================================
    await qdrant.upsert(collection, { points });

    res.json({
      msg: "Uploaded, processed & stored successfully!",
      chunksStored: chunks.length,
    });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
