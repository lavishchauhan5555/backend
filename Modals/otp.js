import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true },
  otp: { type: String, required: true },
  expiresAt: { type: Date, required: true }
});

// TTL INDEX → Automatically delete after expiry
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Otp", otpSchema);
