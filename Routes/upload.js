import express from "express";
import pdfParse from "pdf-parse-new";
import { qdrant } from "../Modals/qdrant.js";
import { verifyRefreshToken } from "../utils/jwt.js";
import { chunkText } from "../utils/chunkText.js";
import User from "../Modals/user.js";
import Chat from "../Modals/chatHistory.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = express.Router();

// ---------------------------
// INIT GEMINI (CORRECT MODELS)
// ---------------------------
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const CHAT_MODEL = "gemini-2.5-flash";   // ✅ valid
const EMBEDDING_MODEL = "models/text-embedding-004"; // ✅ valid

// ---------------------------
// Ensure Qdrant Collection
// ---------------------------
async function ensureCollection(name) {
  try {
    const list = await qdrant.getCollections();
    const exists = list.collections.some((c) => c.name === name);

    if (!exists) {
      await qdrant.createCollection(name, {
        vectors: {
          size: 768,
          distance: "Cosine"
        }
      });

      console.log(`Created Qdrant collection: ${name}`);
    }
  } catch (err) {
    console.error("ensureCollection Error:", err);
  }
}

// ---------------------------
// Base64 → Buffer
// ---------------------------
const base64ToBuffer = (b64) => Buffer.from(b64, "base64");

// ---------------------------
// GEMINI → Embedding (WORKING)
// ---------------------------
async function getEmbedding(text) {
  try {
    const embedModel = ai.getGenerativeModel({ model: EMBEDDING_MODEL });

    const result = await embedModel.embedContent(text);
    const embedding =
      result.embedding?.values ||
      result.data?.[0]?.embedding?.values;

    if (!embedding) throw new Error("No embedding returned");
    return embedding;

  } catch (err) {
    console.error("Embedding Error:", err);
    throw err;
  }
}

// ---------------------------
// GEMINI → Chat (WORKING)
// ---------------------------
async function geminiAnswer(prompt) {
  try {
    const model = ai.getGenerativeModel({ model: CHAT_MODEL });
    const result = await model.generateContent(String(prompt));
    return result.response.text();
  } catch (err) {
    console.error("Gemini Chat Error:", err);
    throw err;
  }
}

// ---------------------------
// FINAL ENDPOINT
// ---------------------------
router.post("/upload", async (req, res) => {
  try {
    // -------------------------
    // AUTH
    // -------------------------
    const token = req.cookies.jid;
    if (!token) return res.status(401).json({ message: "No token" });

    let userId;
    try {
      const payload = verifyRefreshToken(token);
      userId = payload.userId;
    } catch {
      return res.status(401).json({ message: "Invalid token" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // -------------------------
    // INPUTS
    // -------------------------
    const text = (req.body.text || "").trim();
    const files = Array.isArray(req.body.files) ? req.body.files : [];

    const hasText = text.length > 0;
    const hasFile = files.length > 0;

    // -------------------------
    // COLLECTION
    // -------------------------
    const collectionName =
      typeof user.twinCollection === "string"
        ? user.twinCollection
        : `twin_${userId}`;

    await ensureCollection(collectionName);

    if (!user.twinCollection) {
      user.twinCollection = collectionName;
      await user.save();
    }

    let extractedKnowledge = "";

    // -------------------------------------------------------
    // PROCESS FILES
    // -------------------------------------------------------
    if (hasFile) {
      for (const file of files) {
        const buffer = base64ToBuffer(file.data);

        if (file.type === "application/pdf") {
          const parsed = await pdfParse(buffer);
          extractedKnowledge += "\n" + (parsed.text || "");
        } else if (file.type.startsWith("text")) {
          extractedKnowledge += "\n" + buffer.toString("utf8");
        }
      }

      extractedKnowledge = extractedKnowledge.trim();

      if (extractedKnowledge) {
        const chunks = chunkText(extractedKnowledge, 500);
        const points = [];

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i].trim();
          if (!chunk) continue;

          const vector = await getEmbedding(chunk);
          points.push({
            id: Date.now() + i,
            vector,
            payload: { text: chunk },
          });
        }

        if (points.length > 0) {
          await qdrant.upsert(collectionName, { points });
        }
      }
    }

    // Only file / no text
    if (!hasText && hasFile) {
      return res.json({
        reply: "Your file has been processed and added to memory!"
      });
    }

    // -------------------------
    // USER QUESTION
    // -------------------------
    if (hasText) {
      await Chat.create({ userId, role: "user", message: text });

      const qVec = await getEmbedding(text);

      const hits = await qdrant.search(collectionName, {
        vector: qVec,
        limit: 5,
      });

      const memory =
        hits.map((h) => h.payload?.text)
          .filter(Boolean)
          .join("\n\n") || "No memory available.";

      const prompt = `
You are Lavish's AI Twin.

Memory:
${memory}

User said:
${text}

Extracted File:
${extractedKnowledge || "No file uploaded."}

Reply helpfully.
      `;

      const answer = await geminiAnswer(prompt);

      await Chat.create({ userId, role: "assistant", message: answer });

      return res.json({ reply: answer });
    }

    return res.json({ reply: "Nothing received." });

  } catch (err) {
    console.error("FINAL ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
