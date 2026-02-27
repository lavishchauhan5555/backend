import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant"],
    },
    message: String,
    files: Array,        // metadata only
  fileText: String,    // ✅ extracted text
  },
  { timestamps: true }
);

export default mongoose.model("Chat", chatSchema);
