import { GoogleGenAI } from "@google/genai";
import { config } from "./config";

// Grounded lookup of a menu item's DELIVERY-APP price, for items whose price is null after the normal website read.
// The model proposes an answer using Google Search grounding. Code then checks it and returns null unless every check passes.
// The returned price is the raw delivery-app price. The caller decides how to scale and label it (for example "est.").

export interface FindDeliveryPriceInput { shopName: string; itemName: string; address?: string }
export interface FindDeliveryPriceResult {
  priceCents: number | null;
  sourceUrl: string | null;
  snippet: string | null;
  size?: string;
  error?: string;
}

const ALLOWED_HOST = /(^|\.)(ubereats|doordash|grubhub)\.com$/i;
// Grounded searches have their own, smaller quota. Hard cap per process; override with GROUNDED_MAX_LOOKUPS.
const MAX_LOOKUPS = Number(process.env.GROUNDED_MAX_LOOKUPS ?? 20);
let used = 0;

let _client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!config.apiKey) throw new Error("GEMINI_API_KEY is not set");
  if (!_client) _client = new GoogleGenAI({ apiKey: config.apiKey });
  return _client;
}

const system = `You look up the delivery-app price of ONE menu item at ONE shop, using Google Search.
Rules:
- Use only listings on ubereats.com, doordash.com or grubhub.com for exactly this shop. Ignore blogs, review sites, aggregators, coupon sites and every other source.
- The listing must be for the same shop (same name; same address if one is given), not a similarly named shop.
- Report the price of the exact item asked for. If several sizes or variants are listed, report the smallest or base size and say which size it is.
- Never guess, estimate, convert or average a price. If you cannot find a clear price on one of those three sites, answer NOT_FOUND.
Answer in exactly this format, one field per line, with no other text:
STORE: <store name exactly as shown on the listing>
ITEM: <item name exactly as shown on the listing>
PRICE: <price in dollars as a plain number, for example 5.50>
SIZE: <size text as shown, or NONE>
SNIPPET: <the exact text from the listing that contains the item name and its price>
Or, if there is no clear price, answer only: NOT_FOUND`;

// ---------- pure checking logic (exported so it can be tested without the API) ----------

const words = (s: string) => (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length >= 3);

function hostOf(s: string): string {
  try { return new URL(s).hostname.toLowerCase(); } catch { return s.trim().toLowerCase(); }
}
const isAllowedHost = (h: string) => ALLOWED_HOST.test(h);

export interface ParsedAnswer { store: string; item: string; price: number; size?: string; snippet: string }

export function parseAnswer(text: string): ParsedAnswer | null {
  if (!text || /^\s*NOT_FOUND\b/i.test(text)) return null;
  const get = (k: string) => text.match(new RegExp(`^\\s*${k}\\s*:\\s*(.+?)\\s*$`, "im"))?.[1]?.trim() ?? null;
  const store = get("STORE");
  const item = get("ITEM");
  const priceRaw = get("PRICE");
  const sizeRaw = get("SIZE");
  const snippet = get("SNIPPET");
  if (!store || !item || !priceRaw || !snippet) return null;
  const m = priceRaw.replace(/,/g, "").match(/(\d+(?:\.\d{1,2})?)/);
  if (!m) return null;
  const price = parseFloat(m[1]);
  if (!(price > 0 && price < 100)) return null;
  const size = sizeRaw && !/^none$/i.test(sizeRaw) ? sizeRaw : undefined;
  return { store, item, price, size, snippet };
}

type Chunk = { web?: { uri?: string; title?: string } };
type Support = { segment?: { text?: string }; groundingChunkIndices?: number[] };
export type GroundingMeta = { groundingChunks?: Chunk[]; groundingSupports?: Support[] } | undefined;

// Answer-level checks: the answer must really be about this shop and this item, and the snippet must contain the price.
export function checkAnswer(input: FindDeliveryPriceInput, a: ParsedAnswer): boolean {
  const shopWords = words(input.shopName);
  const itemWords = words(input.itemName);
  if (shopWords.length === 0 || itemWords.length === 0) return false;
  const store = a.store.toLowerCase();
  const item = a.item.toLowerCase();
  if (!shopWords.every((w) => store.includes(w))) return false;
  if (!itemWords.every((w) => item.includes(w))) return false;

  const p2 = a.price.toFixed(2);
  const priceInSnippet =
    a.snippet.includes(p2) ||
    (Number.isInteger(a.price) && new RegExp(`\\$\\s*${a.price}(?![\\d.])`).test(a.snippet));
  if (!priceInSnippet) return false;
  const snip = a.snippet.toLowerCase();
  return words(a.item).some((w) => snip.includes(w));
}

// Source check: at least one grounding source must be an allowed delivery site. If the grounding data ties the part of the
// answer that contains the price to specific sources, one of those must be an allowed site.
export function pickSource(meta: GroundingMeta, price: number): { uri: string } | null {
  const chunks = meta?.groundingChunks ?? [];
  const allowed: number[] = [];
  chunks.forEach((c, i) => {
    const title = hostOf(c.web?.title ?? "");
    const uri = hostOf(c.web?.uri ?? "");
    if (isAllowedHost(title) || isAllowedHost(uri)) allowed.push(i);
  });
  if (allowed.length === 0) return null;

  const p2 = price.toFixed(2);
  const tied = (meta?.groundingSupports ?? []).filter((s) => s.segment?.text?.includes(p2));
  let candidates = allowed;
  if (tied.length > 0) {
    const linked = new Set(tied.flatMap((s) => s.groundingChunkIndices ?? []));
    candidates = allowed.filter((i) => linked.has(i));
    if (candidates.length === 0) return null;
  }
  const uri = chunks[candidates[0]].web?.uri;
  return uri ? { uri } : null;
}

// Grounding links are usually redirect URLs. Try to find the real listing URL; reject if it points somewhere not allowed.
async function resolveSource(uri: string): Promise<{ url: string; ok: boolean }> {
  if (!/vertexaisearch\.cloud\.google\.com$/i.test(hostOf(uri))) return { url: uri, ok: isAllowedHost(hostOf(uri)) };
  try {
    const r = await fetch(uri, { redirect: "manual", signal: AbortSignal.timeout(5000) });
    const loc = r.headers.get("location");
    if (loc) return { url: loc, ok: isAllowedHost(hostOf(loc)) };
  } catch {
    // could not resolve: keep the grounding link, whose source already matched an allowed site
  }
  return { url: uri, ok: true };
}

// ---------- the lookup ----------

export async function findDeliveryPrice(input: FindDeliveryPriceInput): Promise<FindDeliveryPriceResult> {
  const none = { priceCents: null, sourceUrl: null, snippet: null };
  try {
    if (!input?.shopName?.trim() || !input?.itemName?.trim()) {
      return { ...none, error: "shopName and itemName are required" };
    }
    const client = getClient();
    if (used >= MAX_LOOKUPS) {
      return { ...none, error: `grounded lookup budget used up (${MAX_LOOKUPS}); raise GROUNDED_MAX_LOOKUPS if intended` };
    }
    used++;

    const prompt =
      `Shop: ${input.shopName}\nItem: ${input.itemName}\n` +
      (input.address ? `Shop address: ${input.address}\n` : "") +
      `Find the price of this item at this shop on Uber Eats, DoorDash or Grubhub.`;

    let lastErr: unknown;
    for (const model of Array.from(new Set([config.models.strong, config.models.fast]))) {
      const started = Date.now();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const res = await Promise.race([
          client.models.generateContent({
            model,
            contents: prompt,
            config: { systemInstruction: system, tools: [{ googleSearch: {} }], temperature: 0 },
          }),
          new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new Error("Gemini timeout")), 30_000); }),
        ]);
        const answer = parseAnswer(res.text ?? "");
        const meta = res.candidates?.[0]?.groundingMetadata as GroundingMeta;
        console.log(JSON.stringify({ model, ms: Date.now() - started, grounded: true, answered: !!answer }));

        if (!answer || !checkAnswer(input, answer)) return { ...none };
        const src = pickSource(meta, answer.price);
        if (!src) return { ...none };
        const resolved = await resolveSource(src.uri);
        if (!resolved.ok) return { ...none };

        return {
          priceCents: Math.round(answer.price * 100),
          sourceUrl: resolved.url,
          snippet: answer.snippet,
          size: answer.size,
        };
      } catch (err) {
        lastErr = err;
        console.error(`Grounded lookup on ${model} failed:`, String(err).slice(0, 200));
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
    return { ...none, error: String(lastErr).slice(0, 300) };
  } catch (err) {
    return { ...none, error: String(err).slice(0, 300) };
  }
}