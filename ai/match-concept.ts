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

export async function matchConcepts(
  items: MatchItem[],
  concepts: ConceptDef[]
): Promise<MatchConceptResult[]> {
  const empty = items.map(() => ({ conceptId: null, confidence: 0, attributes: {} }));
  if (items.length === 0) return [];
  const valid = new Set(concepts.map((c) => c.id));
  const system = `You map cafe drink menu items to a fixed list of concepts.
Concepts (id: label, aliases):
${concepts.map((c) => `- ${c.id}: ${c.name}${c.aliases?.length ? " (" + c.aliases.join(", ") + ")" : ""}`).join("\n")}
Rules:
- flavor: only an ingredient or flavor actually named in the item's name or description (e.g. nutella, mango). Never use descriptive phrases like "sweet and creamy", and never infer a flavor that is not printed.
- If the description says the drink is a different kind of drink than the concept, use null or a confidence below 0.6.
- For each item, return the single best concept id from the list, or null if none fits. Never invent an id.
- Use the item's category as context (e.g. an item named "Caramel" under FRAPPES is a frappe).
- A flavored or twisted version of a concept maps to that concept, with the twist in "flavor" (e.g. Nutella Mocha -> mocha, flavor nutella) and confidence 0.6 to 0.8. A direct match is 0.9 or higher.
- If the drink is not clearly one of the concepts (e.g. a Butterfly Latte made from pea flower tea), use null.
- temperature only if the item says it (hot, iced, blended), else null.
- Return one result per item, using the given index.`;
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
      const ok = r.conceptId && valid.has(r.conceptId);
      res[r.index] = {
        conceptId: ok ? r.conceptId : null,
        confidence: ok ? r.confidence : 0,
        attributes: {
          ...(r.flavor ? { flavor: r.flavor } : {}),
          ...(r.temperature ? { temperature: r.temperature } : {}),
        },
      };
    }
    return res;
  } catch (err) {
    console.error("matchConcepts failed:", err);
    return empty;
  }
}

export async function matchConcept(item: MatchItem, concepts: ConceptDef[]) {
  return (await matchConcepts([item], concepts))[0];
}