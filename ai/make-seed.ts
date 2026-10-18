// Usage: npx tsx ai/make-seed.ts
// Writes seed/concept.json (always regenerated from ai/concepts.ts, so ids cannot drift)
// and seed/chain_reference.json (only if missing, so teammates' prices are never overwritten).
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { CONCEPTS } from "./concepts";

mkdirSync("seed", { recursive: true });

const concepts = CONCEPTS.map((c) => ({ id: c.id, name: c.name, aliases: c.aliases ?? [] }));
writeFileSync("seed/concept.json", JSON.stringify(concepts, null, 2) + "\n");
console.log(`seed/concept.json: ${concepts.length} concepts`);

const refPath = "seed/chain_reference.json";
if (existsSync(refPath)) {
  console.log(`${refPath} exists, left untouched`);
} else {
  const template = [
    {
      id: "sbux-psl",
      chain: "Starbucks",
      item_name: "Pumpkin Spice Latte",
      concept_id: "pumpkin_spice_latte",
      size: "grande 16oz",
      price_cents: null,            // FILL IN from the Starbucks app (U Village)
      as_of: null,                  // FILL IN, YYYY-MM-DD
      source: "Starbucks app, U Village",
      is_featured: true,
    },
  ];
  writeFileSync(refPath, JSON.stringify(template, null, 2) + "\n");
  console.log(`${refPath}: template written, price_cents and as_of are blank`);
}