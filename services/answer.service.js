import redis from "../utils/redis.js";
import { hashText } from "../utils/hash.js";
import { safeStreamAnswerWithCallback } from "./ai.service.js";
import { getMemory, upsertVector } from "./vector.service.js";
import UserPersonality from "../Modals/UserPersonality.js";

/* ===================== HELPERS ===================== */

function isMemoryRelevant(memory, question) {
  if (!memory) return false;

  const qWords = question.toLowerCase().split(/\W+/);
  let matches = 0;

  for (const word of qWords) {
    if (word.length > 3 && memory.toLowerCase().includes(word)) {
      matches++;
    }
  }

  return matches >= 2;
}

function buildPersonalityInstructions(personality) {
  return `
RESPONSE STYLE RULES (STRICT – MUST FOLLOW):

Tone:
- ${personality.tone}

Writing Style:
- ${personality.writingStyle}

Politeness Level:
- ${personality.politeness}

Detail Level:
- ${personality.replyDetail}

Emoji Rules:
${
  personality.emojiUsage === "none"
    ? "- Do NOT use emojis at all"
    : `- Emojis allowed: ${personality.emojiUsage}`
}

Formatting Rules:
${
  personality.replyDetail === "brief"
    ? "- Keep responses short (3–5 lines max)"
    : personality.replyDetail === "detailed"
    ? "- Provide structured, detailed explanations"
    : "- Keep responses balanced and clear"
}

Violation of these rules is NOT allowed.
`;
}

/* ===================== MAIN FUNCTION ===================== */

export async function streamFinalAnswer({
  userId,
  conversationId,
  text,
  fileText = "",
  res,
}) {
  let clientClosed = false;
  let finalAnswer = "";

  res.on("close", () => {
    clientClosed = true;
  });

  try {
    /* ========= CACHE KEY ========= */
    const normalizedText = text.trim().replace(/\s+/g, " ").toLowerCase();
    const cacheKey = `answer:${userId}:${hashText(normalizedText)}`;

    /* ========= REDIS CACHE ========= */
    const cached = await redis.get(cacheKey);
    if (cached) {
      if (!clientClosed) {
        res.write(`data: ${JSON.stringify(cached)}\n\n`);
        res.write(`event: end\ndata: done\n\n`);
        res.end();
      }
      return cached;
    }

    /* ========= VECTOR STORAGE ========= */
    if (fileText && fileText.length > 20) {
      await upsertVector(userId, fileText);
    }

    await upsertVector(userId, text);

    /* ========= MEMORY (SMART GATING) ========= */
    const isSimpleFact =
      text.length < 60 &&
      !/explain|why|how|analyze|compare/i.test(text);

    const memory = isSimpleFact ? "" : await getMemory(userId, text);
    const relevantMemory = isMemoryRelevant(memory, text) ? memory : "";

    /* ========= PERSONALITY ========= */
    const personality =
      (await UserPersonality.findOne({ userId, status: "ready" })) || {
        tone: "neutral professional",
        writingStyle: "clear and concise",
        emojiUsage: "none",
        politeness: "medium",
        replyDetail: "balanced",
      };

    const personalityRules = buildPersonalityInstructions(personality);

    /* ========= PROMPT BUILDING ========= */
    let prompt = `
SYSTEM:
You are a reliable AI assistant.

${personalityRules}

KNOWLEDGE RULES:
- Use DOCUMENT context if available
- Use MEMORY only if relevant
- General knowledge is ALWAYS allowed
- NEVER refuse simple factual questions
- NEVER say "information not found" unless truly impossible
`;

    if (fileText && fileText.length > 20) {
      prompt += `\nDOCUMENT CONTEXT:\n${fileText}\n`;
    }

    if (relevantMemory) {
      prompt += `\nMEMORY CONTEXT:\n${relevantMemory}\n`;
    }

    prompt += `\nQUESTION:\n${text}`;

    // console.log(
    //   "📄 Document context preview:",
    //   fileText ? fileText.slice(0, 500) : "NO DOCUMENT"
    // );

    /* ========= SAFE STREAM ANSWER ========= */
    await safeStreamAnswerWithCallback(prompt, 3, 2000, (chunk) => {
      if (clientClosed) return;
      finalAnswer += chunk;
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    });

    /* ========= CACHE FINAL ANSWER ========= */
    if (finalAnswer.trim()) {
      await redis.setex(cacheKey, 1800, finalAnswer); // 30 min cache
    }

    if (!clientClosed) {
      res.write(`event: end\ndata: done\n\n`);
      res.end();
    }

    return finalAnswer;

  } catch (err) {
    console.error("🔥 STREAM ERROR:", err);

    if (!clientClosed) {
      res.write(`event: error\ndata: error\n\n`);
      res.end();
    }
    return null;
  }
}
