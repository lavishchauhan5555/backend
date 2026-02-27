import Chat from "../Modals/chatHistory.js";
import UserPersonality from "../Modals/UserPersonality.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function generatePersonalityInBackground(userId) {



    // ================================
    // Gemini Setup
    // ================================
    const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const CHAT_MODEL = "gemini-2.5-flash";


    // ================================
    // Helper: Gemini Call
    // ================================
    async function geminiAnswer(prompt) {
        const model = ai.getGenerativeModel({ model: CHAT_MODEL });
        const result = await model.generateContent(prompt);
        return result.response.text();
    }

   
    function safeJSONParse(text) {
  const cleaned = text
    .replace(/```json/i, "")
    .replace(/```/g, "")
    .trim();

  return JSON.parse(cleaned);
}



    try {
        const messages = await Chat.find({
            userId,
            role: "user"
        })
            .sort({ createdAt: -1 })
            .limit(40);

        if (messages.length < 30) return;

        const content = messages.map(m => m.message).join("\n");

        const prompt = `
You are a JSON API.

Rules:
- Output ONLY raw JSON
- Do NOT use markdown
- Do NOT use backticks
- Do NOT explain anything

Return this exact JSON shape:
{
  "tone": "",
  "writingStyle": "",
  "emojiUsage": "",
  "politeness": "",
  "replyDetail": ""
}

Messages:
${content}
`;


        const raw = await geminiAnswer(prompt);
        const personality = safeJSONParse(raw);

        await UserPersonality.findOneAndUpdate(
            { userId },
            {
                ...personality,
                status: "ready",
                messageCountAtAnalysis: messages.length,
                updatedAt: new Date()
            },
            { upsert: true }
        );

    } catch (err) {
        console.log("Personality generation failed:", err.message);
    }
}
