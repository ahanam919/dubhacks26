import { GoogleGenAI } from "@google/genai";
import { config } from "./config";

const client = new GoogleGenAI({ apiKey: config.apiKey });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function generateJson<T>(opts: {
  model: string;
  system: string;
  prompt: string;
  schema: object;
}): Promise<T> {
  const models = Array.from(new Set([opts.model, ...config.models.fallbacks]));
  let lastErr: unknown;
  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const started = Date.now();
      try {
        const res = await Promise.race([
          client.models.generateContent({
            model,
            contents: opts.prompt,
            config: {
              systemInstruction: opts.system,
              responseMimeType: "application/json",
              responseSchema: opts.schema,
            },
          }),
          new Promise<never>((_, rej) =>
            setTimeout(() => rej(new Error("Gemini timeout")), config.timeoutMs)
          ),
        ]);
        const out = JSON.parse(res.text ?? "");
        console.log(JSON.stringify({ model, ms: Date.now() - started, ok: true }));
        return out as T;
      } catch (err) {
        lastErr = err;
        console.error(`Gemini ${model} attempt ${attempt} failed:`, String(err).slice(0, 200));
        await sleep(1000 * attempt);
      }
    }
  }
  throw lastErr;
}