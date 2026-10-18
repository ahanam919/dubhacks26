import { GoogleGenAI } from "@google/genai";
import { config } from "./config";

// Created lazily so importing this module never crashes when the key is missing
// (the API/worker can still load with stubs).
let _client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!config.apiKey) throw new Error("GEMINI_API_KEY is not set");
  if (!_client) _client = new GoogleGenAI({ apiKey: config.apiKey });
  return _client;
}

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
  /**
   * Fast path for search-time calls: one model, one attempt, short timeout,
   * and fail immediately if that model is cooling down. Callers fall back
   * to aliases or cache on error.
   */
  fast?: boolean;
  timeoutMs?: number;
  attempts?: number;
  /** Explicit model list (in order) instead of model + config fallbacks. Used by the verifier. */
  models?: string[];
}): Promise<T> {
  const attempts = opts.attempts ?? (opts.fast ? 1 : 2);
  const timeoutMs = opts.timeoutMs ?? (opts.fast ? 5000 : config.timeoutMs);
  const client = getClient(); // throws right away if no key, no pointless retries

  let models: string[];
  if (opts.fast) {
    if ((cooldown.get(opts.model) ?? 0) > Date.now()) {
      throw new Error(`Gemini ${opts.model} is cooling down`);
    }
    models = [opts.model];
  } else {
    const all = Array.from(new Set(opts.models ?? [opts.model, ...config.models.fallbacks]));
    const now = Date.now();
    const active = all.filter((m) => (cooldown.get(m) ?? 0) <= now);
    // If every model is cooling down, try them all rather than failing outright.
    models = active.length > 0 ? active : all;
  }

  let lastErr: unknown;
  for (const model of models) {
    for (let attempt = 1; attempt <= attempts; attempt++) {
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
            timer = setTimeout(() => rej(new Error("Gemini timeout")), timeoutMs);
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
        // Overloaded or timed out on the last attempt: skip it for a while.
        if (isUnavailable(err) && attempt === attempts) {
          cooldown.set(model, Date.now() + COOLDOWN_MS);
        }
        if (attempt < attempts) await sleep(1000 * attempt);
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
  }
  throw lastErr;
}