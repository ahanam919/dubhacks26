import "dotenv/config";

export const config = {
  apiKey: process.env.GEMINI_API_KEY ?? "",
  models: {
    fast: "gemini-3.5-flash-lite",
    strong: "gemini-3.7-flash",
    strongFallbacks: ["gemini-flash-latest"],
    fallbacks: ["gemini-flash-latest", "gemini-3.7-flash"],
    },
  timeoutMs: 30000,
};

if (!config.apiKey) throw new Error("GEMINI_API_KEY missing from .env");