import "dotenv/config";

export const config = {
  apiKey: process.env.GEMINI_API_KEY ?? "",
  models: {
  fast: "gemini-3.8-flash",
  strong: "gemini-2.5-pro",
  },  
  timeoutMs: 15000,
};

if (!config.apiKey) throw new Error("GEMINI_API_KEY missing from .env");