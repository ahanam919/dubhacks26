import { GoogleGenAI } from "@google/genai";
import { config } from "./config";

const client = new GoogleGenAI({ apiKey: config.apiKey });

export async function generateJson<T>(opts: {
  model: string;
  system: string;
  prompt: string;
  schema: object;
}): Promise<T> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const started = Date.now();
    try {
      const res = await Promise.race([
        client.models.generateContent({
          model: opts.model,
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
      console.log(JSON.stringify({ model: opts.model, ms: Date.now() - started, prompt: opts.prompt, out }));
      return out as T;
    } catch (err) {
      console.error(`Gemini attempt ${attempt} failed:`, err);
      if (attempt === 2) throw err;
    }
  }
  throw new Error("unreachable");
}