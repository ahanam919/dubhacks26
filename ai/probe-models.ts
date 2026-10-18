import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const candidates = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.1-pro-preview",
  "gemini-2.5-pro",
  "gemini-pro-latest",
  "gemini-flash-latest",
];

(async () => {
  for (const model of candidates) {
    const t = Date.now();
    try {
      const r = await Promise.race([
        ai.models.generateContent({ model, contents: "Reply with the word OK" }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout 20s")), 20000)),
      ]);
      console.log("OK  ", model, Date.now() - t, "ms", JSON.stringify(r.text?.slice(0, 20)));
    } catch (e) {
      console.log("FAIL", model, String(e).slice(0, 110));
    }
  }
})();