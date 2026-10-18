import "./env";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { pool } from "./db";

const seedDir = fileURLToPath(new URL("../../seed/", import.meta.url));
const load = (f: string) => JSON.parse(readFileSync(seedDir + f, "utf8"));

type Concept = { id: string; name: string; aliases?: string[] };
type ChainRef = {
  chain_name: string; concept_id: string; size: string;
  approx_price_cents: number; as_of_date: string;
  source_url?: string | null; is_featured?: boolean;
};

async function main() {
  const concepts: Concept[] = load("concept.json");
  const refs: ChainRef[] = load("chain_reference.json");

  const ids = new Set(concepts.map((c) => c.id));
  for (const r of refs) {
    if (!Number.isInteger(r.approx_price_cents) || r.approx_price_cents <= 0)
      throw new Error(`chain_reference ${r.concept_id}: price missing or invalid`);
    if (!r.as_of_date) throw new Error(`chain_reference ${r.concept_id}: as_of_date missing`);
    if (!ids.has(r.concept_id))
      throw new Error(`chain_reference points at unknown concept ${r.concept_id}`);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const c of concepts) {
      await client.query(
        `INSERT INTO concept (id, name, aliases) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, aliases = EXCLUDED.aliases`,
        [c.id, c.name, c.aliases ?? []]
      );
    }
    for (const r of refs) {
      await client.query(
        `INSERT INTO chain_reference
           (chain_name, concept_id, size, approx_price_cents, as_of_date, source_url, is_featured)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (chain_name, concept_id, size) DO UPDATE SET
           approx_price_cents = EXCLUDED.approx_price_cents,
           as_of_date = EXCLUDED.as_of_date,
           source_url = EXCLUDED.source_url,
           is_featured = EXCLUDED.is_featured`,
        [r.chain_name, r.concept_id, r.size, r.approx_price_cents, r.as_of_date,
         r.source_url ?? null, r.is_featured ?? false]
      );
    }
    await client.query("COMMIT");
    console.log(`loaded ${concepts.length} concepts, ${refs.length} chain_reference rows`);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });