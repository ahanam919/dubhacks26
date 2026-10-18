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

export async function extractMenu(input: ExtractMenuInput): Promise<ExtractMenuResult> {
  if (!input.text || !input.text.trim()) {
    return { items: [], error: "no text provided" };
  }
  try {
    const out = await generateJson<{
      items: { name: string; description: string | null; price: number | null; size: string | null; category: string | null; confidence: "high" | "medium" | "low" }[];
      milkOptions: string[];
      extras: string[];
      notes: string | null;
    }>({
      model: config.models.fast,
      system,
      prompt: `Shop: ${input.shopName}\n\nMenu text:\n${input.text.slice(0, 30000)}`,
      schema,
    });
    return {
      items: out.items.map((i) => ({
        name: i.name,
        description: i.description ?? undefined,
        priceCents: i.price == null ? null : Math.round(i.price * 100),
        priceSource: i.price == null ? undefined : ("menu_page" as const),
        size: i.size ?? undefined,
        category: i.category ?? undefined,
        confidence: i.confidence,
      })),
      milkOptions: out.milkOptions,
      extras: out.extras,
      notes: out.notes ?? undefined,
    };
  } catch (err) {
    console.error("extractMenu failed:", err);
    return { items: [], error: String(err) };
  }
}