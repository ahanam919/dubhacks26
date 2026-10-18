import { GoogleGenAI } from "@google/genai";
import { config } from "./config";

const client = new GoogleGenAI({ apiKey: config.apiKey });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// model -> timestamp (ms) until which we skip it
const cooldown = new Map<string, number>();
const COOLDOWN_MS = 60_000;

function isQuota(err: unknown) {
  const s = String(err);
  return s.includes('"code":429') || s.includes("RESOURCE_EXHAUSTED");
}

function isUnavailable(err: unknown) {
  const s = String(err);
  return s.includes('"code":503') || s.includes("UNAVAILABLE") || s.includes("Gemini timeout");
}

export async function generateJson<T>(opts: {
  model: string;
  system: string;
  prompt: string;
  schema: object;
}): Promise<T> {
  const all = Array.from(new Set([opts.model, ...config.models.fallbacks]));
  const now = Date.now();
  const active = all.filter((m) => (cooldown.get(m) ?? 0) <= now);
  // If every model is cooling down, try them all rather than failing outright.
  const models = active.length > 0 ? active : all;

  let lastErr: unknown;
  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const started = Date.now();
      let timer: ReturnType<typeof setTimeout> | undefined;
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
          new Promise<never>((_, rej) => {
            timer = setTimeout(() => rej(new Error("Gemini timeout")), config.timeoutMs);
          }),
        ]);
        const out = JSON.parse(res.text ?? "");
        console.log(JSON.stringify({ model, ms: Date.now() - started, ok: true }));
        return out as T;
      } catch (err) {
        lastErr = err;
        console.error(`Gemini ${model} attempt ${attempt} failed:`, String(err).slice(0, 200));

        // Quota: retrying the same model won't help. Skip it for a while and move on.
        if (isQuota(err)) {
          cooldown.set(model, Date.now() + COOLDOWN_MS);
          break;
        }
        // Overloaded or timed out twice: skip it for a while.
        if (isUnavailable(err) && attempt === 2) {
          cooldown.set(model, Date.now() + COOLDOWN_MS);
        }
        if (attempt < 2) await sleep(1000 * attempt);
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
  }
  throw lastErr;
}