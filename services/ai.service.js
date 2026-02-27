import { GoogleGenerativeAI } from "@google/generative-ai";

/* ================= CONFIG ================= */
const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();
if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");

const CHAT_MODEL = "gemini-3-flash-preview";
//gemini-2.1-mini
//gemini-3-flash-preview
const EMBED_MODEL = "models/gemini-embedding-001"; // Gemini embedding model

/* ================= GEMINI CLIENT ================= */
const ai = new GoogleGenerativeAI(GEMINI_API_KEY);

/* ================= GEMINI EMBEDDING FUNCTION ================= */
export async function getEmbedding(text) {
  if (!text || typeof text !== "string") throw new Error("Invalid text");

  try {
    const model = ai.getGenerativeModel({ model: EMBED_MODEL });
    const res = await model.embedContent(text); // Gemini embedding API

    if (!res?.embedding?.values) throw new Error("Invalid embedding response");

    return res.embedding.values; // Returns embedding vector
  } catch (err) {
    console.error("Error fetching Gemini embedding:", err);
    throw err;
  }
}

/* ================= GEMINI STREAM CHAT ================= */
export async function streamAnswer(prompt, onChunk) {
  if (!prompt || typeof prompt !== "string") throw new Error("Invalid prompt");

  const model = ai.getGenerativeModel({ model: CHAT_MODEL });

  try {
    const stream = await model.generateContentStream({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    let full = "";

    for await (const chunk of stream.stream) {
      const text = chunk.text();
      if (text) {
        full += text;
        if (onChunk) onChunk(text); // Streaming callback
      }
    }

    return full;
  } catch (err) {
    console.error("Error streaming chat:", err);
    throw err;
  }
}


/* ================= SAFE STREAM WITH RETRIES ================= */
export async function safeStreamAnswerWithCallback(prompt, retries = 3, delay = 2000, onChunk) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const model = ai.getGenerativeModel({ model: CHAT_MODEL });

      const streamPromise = (async () => {
        const stream = await model.generateContentStream({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        });

        let full = "";

        for await (const chunk of stream.stream) {
          const text = chunk.text();
          if (text) {
            full += text;
            if (onChunk) onChunk(text);
          }
        }

        return full;
      })();

      // 20-second timeout
      const fullAnswer = await Promise.race([
        streamPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 20000))
      ]);

      return fullAnswer;

    } catch (err) {
      if ((err.status === 503 || err.message === "Timeout") && attempt < retries - 1) {
        // console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }

  throw new Error("Service unavailable after retries");
}



/* ================= DEBUG FUNCTION ================= */
export function debugGemini() {
 // console.log("CHAT_MODEL:", CHAT_MODEL);
 // console.log("EMBED_MODEL:", EMBED_MODEL);
}
