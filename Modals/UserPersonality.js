import mongoose from "mongoose";

const UserPersonalitySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    tone: { type: String, default: "neutral professional" },
    writingStyle: { type: String, default: "clear and concise" },
    emojiUsage: { type: String, default: "none" }, // none | minimal | normal
    politeness: { type: String, default: "medium" }, // low | medium | high
    replyDetail: { type: String, default: "balanced" }, // brief | balanced | detailed
    status: { type: String, default: "ready" },
  },
  { timestamps: true }
);

export default mongoose.model("UserPersonality", UserPersonalitySchema);
