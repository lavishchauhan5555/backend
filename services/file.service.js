import pdfParse from "pdf-parse-new";
import Tesseract from "tesseract.js";

const MIN_TEXT_LENGTH = 50; // minimum text length before forcing OCR

export async function extractTextFromFiles(files = [], options = { allowOCR: false }) {
  let combined = "";

  for (const file of files) {
    if (!file?.data) continue;
    const buffer = Buffer.from(file.data, "base64");

    let parsedText = "";

    if (file.type === "application/pdf") {
      try {
        const parsed = await pdfParse(buffer);
        parsedText = parsed.text?.trim() || "";
      } catch (err) {
        console.warn("PDF parse failed:", err.message);
      }

      // Always OCR if text too short or allowOCR=true
      if (parsedText.length < MIN_TEXT_LENGTH && options.allowOCR) {
        const { data } = await Tesseract.recognize(buffer, "eng", { 
          logger: m => console.log("OCR:", m.status, m.progress)
        });
        parsedText = data.text?.trim() || "";
      }
    }

    if (file.type.startsWith("text/")) {
      parsedText = buffer.toString("utf-8");
    }

    combined += "\n" + parsedText;
  }

  return combined.trim();
}
