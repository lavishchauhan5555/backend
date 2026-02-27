import UserPersonality from "../Modals/UserPersonality.js";
import Chat from "../Modals/chatHistory.js";
import { generatePersonalityInBackground } from "./personalityWorker.js";

export async function checkAndTriggerPersonality(userId) {
    const count = await Chat.countDocuments({
        userId,
        role: "user"
    });

    // Don't even think before 30
    if (count < 30) return;

    const personality = await UserPersonality.findOne({ userId });

    //  Already analyzed → STOP
    if (
        personality &&
        personality.status === "ready" &&
        personality.messageCountAtAnalysis >= 30
    ) {
        return;
    }

    //  Trigger ONLY ONCE
    generatePersonalityInBackground(userId);
}
