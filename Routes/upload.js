import express from "express";
import pdfParse from "pdf-parse-new";
import { qdrant } from "../Modals/qdrant.js";
import { verifyRefreshToken } from "../utils/jwt.js";
import { chunkText } from "../utils/chunkText.js";
import User from "../Modals/user.js";
import Chat from "../Modals/chatHistory.js";
import Conversation from "../Modals/conversation.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { checkAndTriggerPersonality } from "../services/personalityTrigger.js";
import UserPersonality from "../Modals/UserPersonality.js";


const router = express.Router();

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const CHAT_MODEL = "gemini-2.5-flash";
const EMBEDDING_MODEL = "models/text-embedding-004";

// ---------------- HELPERS ----------------



// // fire & forget
//  const payload = verifyRefreshToken(req.cookies.jid);
//   const userId = payload.userId;
// checkAndTriggerPersonality(userId);






async function ensureCollection(name) {
  const list = await qdrant.getCollections();
  const exists = list.collections.some((c) => c.name === name);

  if (!exists) {
    await qdrant.createCollection(name, {
      vectors: { size: 768, distance: "Cosine" },
    });
  }
}

const base64ToBuffer = (b64) => Buffer.from(b64, "base64");

async function getEmbedding(text) {
  const model = ai.getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

async function geminiAnswer(prompt) {
  const model = ai.getGenerativeModel({ model: CHAT_MODEL });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

// ---------------- CREATE NEW CHAT ----------------

router.post("/new-chat", async (req, res) => {
  const payload = verifyRefreshToken(req.cookies.jid);

  const chat = await Conversation.create({
    userId: payload.userId,
  });

  res.json(chat);
});

// ---------------- GET ALL CHATS ----------------

router.get("/conversations", async (req, res) => {
  const payload = verifyRefreshToken(req.cookies.jid);

  const chats = await Conversation.find({ userId: payload.userId, isDeleted: false })
    .sort({ updatedAt: -1 });

  res.json(chats);
});

// ---------------- GET CHAT MESSAGES ----------------

router.get("/messages/:conversationId", async (req, res) => {
  const messages = await Chat.find({
    conversationId: req.params.conversationId,
  }).sort({ createdAt: 1 });

  res.json(messages);
});

// ---------------- MAIN CHAT ----------------

router.post("/upload", async (req, res) => {
  try {
    const payload = verifyRefreshToken(req.cookies.jid);
    const userId = payload.userId;

    const { text = "", files = [], conversationId } = req.body;
    if (!conversationId) {
      return res.status(400).json({ message: "conversationId required" });
    }

    const user = await User.findById(userId);

    const collectionName =
      user.twinCollection || `twin_${userId.toString()}`;

    await ensureCollection(collectionName);

    if (!user.twinCollection) {
      user.twinCollection = collectionName;
      await user.save();
    }

    let extractedKnowledge = "";

    // -------- FILE PROCESS --------
    for (const file of files) {
      const buffer = base64ToBuffer(file.data);

      if (file.type === "application/pdf") {
        const parsed = await pdfParse(buffer);
        extractedKnowledge += parsed.text;
      } else if (file.type.startsWith("text")) {
        extractedKnowledge += buffer.toString("utf8");
      }
    }

    if (extractedKnowledge) {
      const chunks = chunkText(extractedKnowledge, 500);
      const points = [];

      for (let i = 0; i < chunks.length; i++) {
        const vector = await getEmbedding(chunks[i]);
        points.push({
          id: Date.now() + i,
          vector,
          payload: { text: chunks[i] },
        });
      }

      await qdrant.upsert(collectionName, { points });
    }

    if (!text.trim()) {
      return res.json({ reply: "Files added to memory." });
    }

    // -------- SAVE USER MESSAGE --------
    await Chat.create({
      userId,
      conversationId,
      role: "user",
      message: text,
    });

    // fire and forget
    checkAndTriggerPersonality(userId);

    const qVec = await getEmbedding(text);
    const hits = await qdrant.search(collectionName, {
      vector: qVec,
      limit: 5,
    });

    const memory = hits.map((h) => h.payload.text).join("\n");

    // -------- FETCH USER PERSONALITY --------
    const personality =
      (await UserPersonality.findOne({
        userId,
        status: "ready",
      })) || {
        tone: "neutral professional",
        writingStyle: "medium",
        emojiUsage: "none",
        politeness: "medium",
        replyDetail: "balanced",
      };


    const prompt = `
SYSTEM:
You are an AI Twin replying in the user's writing style.

User writing style:
- Tone: ${personality.tone}
- Writing style: ${personality.writingStyle}
- Emoji usage: ${personality.emojiUsage}
- Politeness: ${personality.politeness}
- Reply detail: ${personality.replyDetail}

INSTRUCTIONS:
- Follow the user's writing style strictly
- Use emojis only if emoji usage allows
- Be concise if reply detail is brief
- Use memory only if relevant
- Do NOT mention personality, analysis, or memory

MEMORY:
${memory}

USER MESSAGE:
${text}
`;


    const answer = await geminiAnswer(prompt);

    // -------- SAVE AI MESSAGE --------
    await Chat.create({
      userId,
      conversationId,
      role: "assistant",
      message: answer,
    });

    // -------- AUTO TITLE (ONLY ON FIRST MESSAGE) --------
    const conversation = await Conversation.findById(conversationId);

    if (conversation.title === "New Chat") {
      const titlePrompt = `
Generate a short 3 to 6 word title for this conversation.
User message:
"${text}"

Only return the title.
`;
      const title = await geminiAnswer(titlePrompt);
      conversation.title = title.replace(/["']/g, "").trim();
    }

    conversation.lastMessage = answer;
    await conversation.save();

    res.json({ reply: answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
