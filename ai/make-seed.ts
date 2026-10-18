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
  // Field names match the chain_reference table. No id: the table's id is a serial.
  const template = [
    {
      chain_name: "Starbucks",
      concept_id: "pumpkin_spice_latte",
      size: "grande 16oz",
      approx_price_cents: 645,      // pre-tax, Starbucks app at U Village
      as_of_date: "2026-10-17",
      is_featured: true,
    },
  ];
  writeFileSync(refPath, JSON.stringify(template, null, 2) + "\n");
  console.log(`${refPath}: template written, prefilled, update price and date if they change`);
}