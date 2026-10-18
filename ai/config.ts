import "dotenv/config";

export const config = {
  apiKey: process.env.GEMINI_API_KEY ?? "",
  models: {
    fast: "gemini-3.6-flash",
    strong: "gemini-3.5-flash",      // verifier: a different model from the writer
    fallbacks: ["gemini-3.5-flash", "gemini-3.5-flash-lite"],
  },
  timeoutMs: 30000,
};

if (!config.apiKey) throw new Error("GEMINI_API_KEY missing from .env");