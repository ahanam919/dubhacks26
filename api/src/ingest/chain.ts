import { pool } from "../db";
import { CONCEPTS } from "../../../ai/concepts";
import { extractMenu, matchConcepts } from "../../../ai";
import { fetchPage } from "./web";

const CONCEPT_MIN = 0.7;

function must<T extends { error?: string }>(what: string, r: T): T {
  if (r.error) throw new Error(`${what} failed: ${r.error}`);
  return r;
}

// Menu pages print "A1. Classic Milk Tea (L)". Strip the code and size tag so the name matches
// the seeded rows and the job updates them instead of adding duplicates.
const cleanName = (n: string) =>
  n.replace(/^\s*[A-Z]\d+[a-z]?\.?\s+/, "").replace(/\s*\((?:S|M|L|XL|small|medium|large)\)\s*$/i, "").trim();

// Payload: { chain: "Happy Lemon", url: "https://order.online/store/...", defaultSize: "large" }
// defaultSize is used for items whose size the page does not print. It has to be a size the
// comparison code understands (e.g. "16 oz", "grande", "large"), or comparisons come back null.
export async function runIngestChain(payload: Record<string, unknown>): Promise<void> {
  if (process.env.AI_REAL !== "1") throw new Error("AI_REAL=1 is not set; refusing to write stub data");
  const chain = String(payload.chain ?? "").trim();
  const url = String(payload.url ?? "").trim();
  const defaultSize = String(payload.defaultSize ?? "").trim();
  // Optional: multiply every price (e.g. 0.89 to turn delivery prices into rough in-store prices).
  const scale = Number(payload.priceScale ?? 1);
  if (!(scale >= 0.5 && scale <= 1.5)) throw new Error("priceScale must be between 0.5 and 1.5");
  if (!chain || !url) throw new Error("ingest_chain payload needs chain and url");

  const page = await fetchPage(url);
  if (!page || page.text.length < 200) {
    throw new Error(`no readable menu at ${url}. The page may be JavaScript-only; try an ordering page (order.online, Toast, DoorDash).`);
  }

  const menu = must("extractMenu", await extractMenu({ shopName: chain, text: page.text }));
  const priced = menu.items.filter((i) => i.priceCents != null && i.priceCents > 0);
  if (priced.length === 0) throw new Error(`extracted ${menu.items.length} items from ${url}, none with a price`);

  const matched = must(
    "matchConcepts",
    { error: undefined, list: await matchConcepts(priced.map((i) => ({ name: i.name, description: i.description, category: i.category })), CONCEPTS) },
  ).list;
  matched.forEach((m, i) => must(`matchConcepts("${priced[i].name}")`, m));

  // One row per item (not per concept), so "Mango Jasmine Green Tea" and "Passionfruit Green Tea"
  // both survive. Items that match no concept are skipped, since concept_id is required.
  type Row = { itemName: string; conceptId: string; size: string; priceCents: number };
  const rows = new Map<string, Row>();
  let skipped = 0;
  priced.forEach((it, i) => {
    const m = matched[i];
    const itemName = cleanName(it.name);
    const size = it.size ?? defaultSize;
    if (!m.conceptId || m.confidence < CONCEPT_MIN || !size) { skipped++; return; }
    const key = `${itemName.toLowerCase()}|${size.toLowerCase()}`;
    const cur = rows.get(key);
    if (!cur || Math.round(it.priceCents! * scale) < cur.priceCents) {
      rows.set(key, { itemName, conceptId: m.conceptId, size, priceCents: Math.round(it.priceCents! * scale) });
    }
  });
  if (rows.size === 0) throw new Error("no items matched a concept with a usable size; pass defaultSize in the payload");

  for (const r of rows.values()) {
    await pool.query(
      `INSERT INTO chain_reference (chain_name, item_name, concept_id, size, approx_price_cents, as_of_date, source_url, is_featured)
       VALUES ($1,$2,$3,$4,$5,current_date,$6,false)
       ON CONFLICT (chain_name, concept_id, size, (coalesce(item_name, ''))) DO UPDATE SET
         approx_price_cents = EXCLUDED.approx_price_cents, as_of_date = EXCLUDED.as_of_date, source_url = EXCLUDED.source_url`,
      [chain, r.itemName, r.conceptId, r.size, r.priceCents, page.url],
    );
  }
  // A chain needs a fallback row. If it has none, feature the first one. Never changes an existing choice.
  await pool.query(
    `UPDATE chain_reference SET is_featured = true
      WHERE id = (SELECT id FROM chain_reference WHERE chain_name = $1 ORDER BY approx_price_cents LIMIT 1)
        AND NOT EXISTS (SELECT 1 FROM chain_reference WHERE chain_name = $1 AND is_featured)`,
    [chain],
  );
  // A new chain changes which chain is the best fit for some drinks, so queue a classification.
  await pool.query(
    `INSERT INTO job (type, payload) SELECT 'classify_concepts', '{}'::jsonb
      WHERE NOT EXISTS (SELECT 1 FROM job WHERE type = 'classify_concepts' AND status = 'queued')`,
  );
  console.log(`ingest_chain ${chain}: ${priced.length} priced items, ${rows.size} chain_reference rows (${skipped} items skipped: no concept or size)`);
}