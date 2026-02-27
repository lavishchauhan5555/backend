import crypto from "crypto";

export const hashText = (text = "") =>
  crypto.createHash("sha256").update(String(text)).digest("hex");

