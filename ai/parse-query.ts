import { Type } from "@google/genai";
import { config } from "./config";
import { generateJson } from "./gemini";

export interface ParsedQuery {
  item_concept: string | null;
  chain_anchor: string | null;
  dietary: string[];
  size: "small" | "medium" | "large" | null;
  needs_clarification: boolean;
  clarifying_question: string | null;
}

const schema = {
  type: Type.OBJECT,
  properties: {
    item_concept: { type: Type.STRING, nullable: true },
    chain_anchor: { type: Type.STRING, nullable: true },
    dietary: { type: Type.ARRAY, items: { type: Type.STRING } },
    size: { type: Type.STRING, nullable: true, enum: ["small", "medium", "large"] },
    needs_clarification: { type: Type.BOOLEAN },
    clarifying_question: { type: Type.STRING, nullable: true },
  },
  required: ["item_concept", "chain_anchor", "dietary", "size", "needs_clarification", "clarifying_question"],
};

const system = `You parse cafe and bakery cravings into structured fields.
- item_concept: a snake_case canonical item (e.g. pumpkin_spice_latte, chai_latte, cold_brew). Expand abbreviations like PSL. Null if no item is named.
- chain_anchor: the chain brand if the user names or clearly implies one (e.g. PSL implies Starbucks), else null.
- dietary: values like dairy_free, vegan, nut_free. Only if stated.
- size: only if stated, else null.
- If the craving is too vague to search (e.g. "something sweet"), set needs_clarification true and write one short question.
Never invent details the user did not say.`;

export function parseQuery(query: string) {
  return generateJson<ParsedQuery>({
    model: config.models.fast,
    system,
    prompt: query,
    schema,
  });
}