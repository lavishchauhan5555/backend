import express from "express";
import { verifyRefreshToken } from "../utils/jwt.js";
import Chat from "../Modals/chatHistory.js";
import { fileQueue } from "../queues/file.queue.js";
import Conversation from "../Modals/conversation.js";
import { streamFinalAnswer } from "../services/answer.service.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { extractTextFromFiles } from "../services/file.service.js";


const router = express.Router(); 


const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const CHAT_MODEL = "gemini-3-flash-preview";
//gemini-3-flash-preview


async function geminiAnswer(prompt) {
  const model = ai.getGenerativeModel({ model: CHAT_MODEL });
  const result = await model.generateContent(prompt);
  return result.response.text();
}


/* ================= CREATE NEW CHAT ================= */
router.post("/new-chat", async (req, res) => {
  try {
    const payload = verifyRefreshToken(req.cookies.jid);

    const chat = await Conversation.create({
      userId: payload.userId,
    });

    res.json(chat);
  } catch (err) {
    console.error("NEW CHAT ERROR:", err);
    res.status(500).json({ ok: false });
  }
});

/* ================= GET ALL CHATS ================= */
router.get("/conversations", async (req, res) => {
  try {
    const payload = verifyRefreshToken(req.cookies.jid);

    const chats = await Conversation.find({
      userId: payload.userId,
      isDeleted: false,
    }).sort({ updatedAt: -1 });

    res.json(chats);
  } catch (err) {
    console.error("GET CHATS ERROR:", err);
    res.status(500).json({ ok: false });
  }
});

/* ================= GET CHAT MESSAGES ================= */
router.get("/messages/:conversationId", async (req, res) => {
  try {
    const messages = await Chat.find({
      conversationId: req.params.conversationId,
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    console.error("GET MESSAGES ERROR:", err);
    res.status(500).json({ ok: false });
  }
});


/* ================= SEND MESSAGE ================= */

router.post("/send", async (req, res) => {
  try {
     const payload = verifyRefreshToken(req.cookies.jid);
    const { text, files = [], conversationId } = req.body;
   

    let extractedText = "";

    if (files.length > 0) {
      extractedText = await extractTextFromFiles(files, { allowOCR: true });

      if (!extractedText || extractedText.length < 20) {
        return res.status(400).json({ error: "Unable to read file" });
      }
    }

    await Chat.create({
      userId: payload.userId,
      conversationId,
      role: "user",
      message: text,
      files: files.map(f => ({
        name: f.name,
        type: f.type,
        size: f.size,
      })), // metadata only
      fileText: extractedText, // ✅ STORE TEXT
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("SEND ERROR:", err);
    res.status(500).json({ ok: false });
  }
});

/* ================= STREAM ANSWER ================= */
router.get("/stream", async (req, res) => {
  let keepAlive;

  try {
    const payload = verifyRefreshToken(req.cookies.jid);
    const { conversationId } = req.query;

    if (!conversationId) {
      return res.status(400).json({ error: "conversationId is required" });
    }

    /* ===== SSE HEADERS ===== */
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    keepAlive = setInterval(() => res.write(":\n\n"), 15000);

    const lastUserMessage = await Chat.findOne({
      userId: payload.userId,
      conversationId,
      role: "user",
    }).sort({ createdAt: -1 });

    if (!lastUserMessage) {
      res.write(`event: end\ndata: No message found\n\n`);
      return res.end();
    }

    // ✅ STREAM + CAPTURE ANSWER
    const assistantAnswer = await streamFinalAnswer({
      userId: payload.userId,
      conversationId,
      text: lastUserMessage.message,
      fileText: lastUserMessage.fileText || "",
      res,
    });


    // ✅ SAVE REAL AI RESPONSE
    if (assistantAnswer) {
      await Chat.create({
        userId: payload.userId,
        conversationId,
        role: "assistant",
        message: assistantAnswer,
      });
    }


    // ===== AUTO TITLE (ONLY FIRST MESSAGE) =====
    const conversation = await Conversation.findById(conversationId);

    if (conversation && conversation.title === "New Chat") {
      const titlePrompt = `
    Generate a short 3 to 6 word title for this conversation.
  User message:
  "${lastUserMessage.message}"

   Only return the title.
   `;

      const title = await geminiAnswer(titlePrompt);

      conversation.title = title.replace(/["']/g, "").trim();
      conversation.lastMessage = assistantAnswer;
      await conversation.save();

      res.write(
        `event: conversation_updated\ndata: ${JSON.stringify({
          conversationId: conversation._id,
          title: conversation.title,
          lastMessage: conversation.lastMessage,
        })}\n\n`
      );

    } else if (conversation) {
      conversation.lastMessage = assistantAnswer;
      await conversation.save();

      res.write(
        `event: conversation_updated\ndata: ${JSON.stringify({
          conversationId: conversation._id,
          title: conversation.title,
          lastMessage: conversation.lastMessage,
        })}\n\n`
      );
    }



  } catch (err) {
    console.error("STREAM ERROR:", err);
  } finally {
    if (keepAlive) clearInterval(keepAlive);
  }
});

export default router;
