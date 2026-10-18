import { Type } from "@google/genai";
import { config } from "./config";
import { generateJson } from "./gemini";
import type { ConceptDef, MatchConceptResult, MatchItem } from "./types";

const schema = {
  type: Type.OBJECT,
  properties: {
    results: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          index: { type: Type.INTEGER },
          conceptId: { type: Type.STRING, nullable: true },
          confidence: { type: Type.NUMBER },
          flavor: { type: Type.STRING, nullable: true },
          temperature: { type: Type.STRING, nullable: true, enum: ["hot", "iced", "blended"] },
        },
        required: ["index", "conceptId", "confidence", "flavor", "temperature"],
      },
    },
  },
  required: ["results"],
};

const RULES = `Rules for choosing a concept:
- Return the single best concept id from the list, or null if none fits. Never invent an id.
- Use the item's category as context (an item named "Caramel" under FRAPPES is a frappe).
- A flavored or twisted version of a concept maps to that concept, with the twist in "flavor" (Nutella Mocha is mocha with flavor nutella).
- If the item is clearly a different kind of drink than any concept (for example a Butterfly Latte made from pea flower tea, or a Turmeric Latte), return null. This rule wins over the others, even when the name contains a concept word like "latte".
- If the name contains a concept word but the description describes a different kind of drink (a mix inspired by a dessert, a tea, a spice or herbal drink), return null. Velvet Latte, a "mix inspired by red velvet cake", is null.
- Do not force a match. When unsure, use null.

Rules for confidence:
- 0.9 to 1.0: the name is the concept (Latte, Cappuccino, Hot Tea).
- 0.8 to 0.85: a flavored or twisted version where the concept is in the name or description (Nutella Mocha, Mango Latte, Mocha Diablo), or an item whose category is the concept (a flavor-only name under FRAPPES).
- 0.6 to 0.75: a loose or partial fit.
- Lower the confidence if the description contradicts the concept.
- If the description itself says what kind of drink it is (for example "sweet and creamy latte"), treat that as a direct match: 0.85 to 0.9.

Rules for attributes:
- flavor: only an ingredient or flavor actually printed in the item's name or description (nutella, mango, mint). Never a descriptive phrase like "sweet and creamy". Never infer a flavor that is not printed.
- temperature: only a serving temperature (hot, iced, blended) that is printed, or clearly implied by the item name or category (Hot Chocolate is hot, FRAPPES are blended). Words like "hot & spicy" describe heat, not serving temperature, so do not set it from them.
- Otherwise leave attributes null.

Return one result per item, using the given index.`;

export async function matchConcepts(
  items: MatchItem[],
  concepts: ConceptDef[]
): Promise<MatchConceptResult[]> {
  const empty = items.map(() => ({ conceptId: null, confidence: 0, attributes: {} }));
  if (items.length === 0) return [];
  const valid = new Set(concepts.map((c) => c.id));
  const system = `You map cafe drink menu items to a fixed list of concepts.
Concepts (id: name, aliases):
${concepts.map((c) => `- ${c.id}: ${c.name}${c.aliases?.length ? " (" + c.aliases.join(", ") + ")" : ""}`).join("\n")}

${RULES}`;
  const prompt = items
    .map((it, i) => `${i}. ${it.name} | category: ${it.category ?? "none"} | ${it.description ?? "no description"}`)
    .join("\n");
  try {
    const out = await generateJson<{
      results: { index: number; conceptId: string | null; confidence: number; flavor: string | null; temperature: string | null }[];
    }>({ model: config.models.fast, system, prompt, schema });
    const res = [...empty] as MatchConceptResult[];
    for (const r of out.results) {
      if (r.index < 0 || r.index >= items.length) continue;
      const it = items[r.index];
      const text = `${it.name} ${it.description ?? ""}`.toLowerCase();
      let conceptId = r.conceptId && valid.has(r.conceptId) ? r.conceptId : null;
      let confidence = conceptId ? Math.max(0, Math.min(1, r.confidence)) : 0;
      // category is strong evidence: anything listed under FRAPPES is a frappe
      if (/frappe/i.test(it.category ?? "") && valid.has("frappe") && conceptId !== "frappe") {
        conceptId = "frappe";
        confidence = 0.8;
      }
      // flavor must literally appear in the item's name or description
      const flavor = r.flavor && text.includes(r.flavor.toLowerCase()) ? r.flavor : null;
      // temperature must be printed (name, description, category) or implied by the concept.
      // "hot & spicy" is heat, not a serving temperature, so it is removed first.
      const tempText = `${text} ${(it.category ?? "").toLowerCase()} ${(conceptId ?? "").replace(/_/g, " ")}`
        .replace(/hot\s*(&|and)\s*spicy/g, "");
      const tempWords: Record<string, RegExp> = {
        hot: /\bhot\b/,
        iced: /\b(iced|cold)\b/,
        blended: /\b(blended|frappe)/,
      };
      const temperature = r.temperature && tempWords[r.temperature]?.test(tempText) ? r.temperature : null;
      res[r.index] = {
        conceptId,
        confidence,
        attributes: {
          ...(flavor ? { flavor } : {}),
          ...(temperature ? { temperature } : {}),
        },
      };
    }
    return res;
  } catch (err) {
    console.error("matchConcepts failed:", err);
    // Surface the failure so the worker can retry the job instead of saving
    // the whole menu as "no match".
    const error = String(err).slice(0, 200);
    return items.map(() => ({ conceptId: null, confidence: 0, attributes: {}, error }));
  }
}

export async function matchConcept(item: MatchItem, concepts: ConceptDef[]) {
  return (await matchConcepts([item], concepts))[0];
}