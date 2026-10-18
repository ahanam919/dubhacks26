import { Type } from "@google/genai";
import { config } from "./config";
import { generateJson } from "./gemini";
import type { ExtractMenuInput, ExtractMenuResult } from "./types";

const schema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING, nullable: true },
          price: { type: Type.NUMBER, nullable: true },
          size: { type: Type.STRING, nullable: true },
          category: { type: Type.STRING, nullable: true },
          confidence: { type: Type.STRING, enum: ["high", "medium", "low"] },
        },
        required: ["name", "description", "price", "size", "category", "confidence"],
      },
    },
    milkOptions: { type: Type.ARRAY, items: { type: Type.STRING } },
    extras: { type: Type.ARRAY, items: { type: Type.STRING } },
    notes: { type: Type.STRING, nullable: true },
  },
  required: ["items", "milkOptions", "extras", "notes"],
};

const system = `You extract DRINK menu items from a cafe's menu text.
- Include only drinks (espresso drinks, coffee, tea, matcha, chai, hot chocolate, frappes, smoothies, sodas, juice, affogato-style drinks). Skip all food: sandwiches, toast, pastries, snacks, and ice cream served on its own.
- One entry per item. If an item lists several sizes with different prices, make one entry per size and put the size in "size".
- name: exactly as printed, including misspellings. description: only if the menu gives one, else null. Never write one.
- A short line right after an item name that describes it is that item's description, not a new item. Names are usually title case.
- price: a number in dollars (4.5 for "$4.50"). If there is no price or it is unclear, use null. Never guess a price.
- size: as printed (e.g. "12 oz", "small"), else null.
- category: the section heading the item sits under (e.g. SPECIALTIES, TRADITIONAL), else null. A heading inside another section (e.g. FRAPPES) is the category for the items below it.
- confidence: how sure you are that the name and description were read correctly ("high" for clearly printed items). Do not lower it just because a price is missing.
- Lines like "Milk: OAT, SOY, ALMOND" or "Add Shot" are add-ons, not items. Put milk choices in milkOptions and other add-ons in extras.
- Skip store hours, addresses and marketing text. If a line looks cut off, keep it as printed and say so in notes.`;

// Extra rules only when photos are attached.
const photoRules = `
The input includes photos of a printed menu, menu board or chalkboard. Extra rules for photos:
- Read only what is legible. Never infer text or prices that are blurred, covered by glare, cropped or hidden.
- A price you cannot read with confidence is null, even if you can guess it from nearby items.
- Use confidence "low" when the item name itself is hard to read, and "medium" when part of it is unclear.
- If the same item appears in more than one photo, list it once.
- If a photo is not a menu (a storefront, a drink, a person), ignore it and say so in notes. If no photo shows a menu, return no items.`;

const MAX_IMAGES = 6;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB each; the worker should downscale bigger photos
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

type PreparedImage = { mimeType: string; data: string };

// Accepts raw bytes (Buffer or Uint8Array) or a base64 string. Image contents are never logged.
function prepareImages(
  images: ExtractMenuInput["images"],
): { images: PreparedImage[]; error?: string } {
  if (!images || images.length === 0) return { images: [] };
  if (images.length > MAX_IMAGES) {
    return { images: [], error: `too many images (max ${MAX_IMAGES}, got ${images.length})` };
  }
  const out: PreparedImage[] = [];
  for (const [i, img] of images.entries()) {
    const mimeType = String(img?.mimeType ?? "").toLowerCase();
    if (!ALLOWED_MIME.has(mimeType)) {
      return { images: [], error: `image ${i + 1} has unsupported mimeType "${mimeType}" (use image/jpeg, image/png or image/webp)` };
    }
    let data: string;
    let bytes: number;
    if (typeof img.data === "string") {
      data = img.data.replace(/^data:[^;]+;base64,/, "").replace(/\s+/g, "");
      bytes = Math.floor((data.length * 3) / 4);
    } else if (img.data && typeof img.data.byteLength === "number") {
      bytes = img.data.byteLength;
      data = Buffer.from(img.data).toString("base64");
    } else {
      return { images: [], error: `image ${i + 1} has no data` };
    }
    if (bytes === 0) return { images: [], error: `image ${i + 1} is empty` };
    if (bytes > MAX_IMAGE_BYTES) {
      return { images: [], error: `image ${i + 1} is too large (${Math.round(bytes / 1024)} KB, max ${MAX_IMAGE_BYTES / 1024} KB); downscale it first` };
    }
    out.push({ mimeType, data });
  }
  return { images: out };
}

export async function extractMenu(input: ExtractMenuInput): Promise<ExtractMenuResult> {
  const hasText = !!input.text && input.text.trim().length > 0;
  const prepared = prepareImages(input.images);
  if (prepared.error) return { items: [], error: prepared.error };
  const hasImages = prepared.images.length > 0;
  if (!hasText && !hasImages) {
    return { items: [], error: "no text or images provided" };
  }

  const parts = [`Shop: ${input.shopName}`];
  if (hasText) parts.push(`Menu text:\n${input.text!.slice(0, 30000)}`);
  if (hasImages) {
    parts.push(`Attached: ${prepared.images.length} photo(s) of the menu. Read every legible drink and price.`);
  }

  try {
    const out = await generateJson<{
      items: { name: string; description: string | null; price: number | null; size: string | null; category: string | null; confidence: "high" | "medium" | "low" }[];
      milkOptions: string[];
      extras: string[];
      notes: string | null;
    }>({
      // Photos are harder to read than text, so they use the stronger model. Text stays on the fast one.
      model: hasImages ? config.models.strong : config.models.fast,
      system: hasImages ? system + photoRules : system,
      prompt: parts.join("\n\n"),
      schema,
      images: hasImages ? prepared.images : undefined,
      timeoutMs: hasImages ? 60_000 : undefined,
    });
    return {
      items: out.items.map((i) => ({
        name: i.name,
        description: i.description ?? undefined,
        priceCents: i.price == null ? null : Math.round(i.price * 100),
        // A photo is not a menu page, so no priceSource is claimed. The caller sets it (for example team_entered).
        priceSource: i.price == null || hasImages ? undefined : ("menu_page" as const),
        size: i.size ?? undefined,
        category: i.category ?? undefined,
        confidence: i.confidence,
      })),
      milkOptions: out.milkOptions,
      extras: out.extras,
      notes: out.notes ?? undefined,
    };
  } catch (err) {
    console.error("extractMenu failed:", String(err).slice(0, 300));
    return { items: [], error: String(err).slice(0, 300) };
  }
}