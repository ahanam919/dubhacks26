import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { pool } from "../db";
import { comparePrice, writeGeofenceMessage } from "../../../ai";
import { closest } from "./similar";

// Loads hand-entered menus from seed/manual_menus.json. No Gemini and no network: it only needs the database.
//
// The file is { "<shop name>": { "items": [...], "milkOptions": [...], "replace": false } }.
//   The key is matched against the START of the shop's name, so "Leon Coffee House" finds "Leon Coffee House - U District".
//   item: { name, size (or null), price (dollars, or null), concept (an id from concept.json, or null), category, description }
//   replace: true marks the shop's other (scraped) items stale. Default false leaves them alone.
// Shops with an empty "items" list are skipped.
//
// Run all shops:  INSERT INTO job (type, payload) VALUES ('load_manual', '{}');
// Run one shop:   INSERT INTO job (type, payload) VALUES ('load_manual', '{"shop":"Leon Coffee House"}');

type ManualItem = {
  name: string; size?: string | null; price?: number | null;
  concept?: string | null; category?: string | null; description?: string | null;
};
type ManualShop = { items: ManualItem[]; milkOptions?: string[]; replace?: boolean };

const FILE = fileURLToPath(new URL("../../../seed/manual_menus.json", import.meta.url));

export async function runManual(payload: Record<string, unknown>): Promise<void> {
  const all: Record<string, ManualShop> = JSON.parse(readFileSync(FILE, "utf8"));
  const only = payload.shop ? String(payload.shop).toLowerCase() : null;
  const entries = Object.entries(all).filter(([k, v]) => v.items?.length && (!only || k.toLowerCase() === only));
  if (entries.length === 0) { console.log("manual: nothing to load (no shop with items" + (only ? ` named ${only}` : "") + ")"); return; }

  // Check everything first, so a typo in the file fails before anything is written.
  const { rows: cRows } = await pool.query(`SELECT id FROM concept`);
  const concepts = new Set<string>(cRows.map((r) => r.id));
  for (const [key, shop] of entries) {
    for (const it of shop.items) {
      if (!it.name) throw new Error(`${key}: an item has no name`);
      if (it.concept && !concepts.has(it.concept)) throw new Error(`${key} / ${it.name}: unknown concept "${it.concept}"`);
      if (it.price != null && !(it.price > 0)) throw new Error(`${key} / ${it.name}: price must be above 0 (or null)`);
    }
  }

  const { rows: refs } = await pool.query(
    `SELECT id, chain_name, item_name, concept_id, size, approx_price_cents, as_of_date, is_featured FROM chain_reference`,
  );

  for (const [key, shop] of entries) {
    const { rows: found } = await pool.query(`SELECT id, name FROM shop WHERE name ILIKE $1 || '%'`, [key]);
    if (found.length !== 1) {
      console.log(`manual: "${key}" matched ${found.length} shops, skipped (${found.map((f) => f.name).join("; ") || "none"})`);
      continue;
    }
    const shopId: string = found[0].id;
    const shopName: string = found[0].name;
    const startedAt = new Date();

    const rows: { id: string; conceptId: string | null; priceCents: number | null; size?: string; name: string }[] = [];
    for (const it of shop.items) {
      const priceCents = it.price == null ? null : Math.round(it.price * 100);
      const { rows: r } = await pool.query(
        `INSERT INTO menu_item (shop_id, name, description, price_cents, price_source, size, concept_id,
                                concept_confidence, attributes, status, source_url, last_checked_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'verified','team_entered:manual_menus.json', now())
         ON CONFLICT (shop_id, name, coalesce(size, '')) DO UPDATE SET
           description = EXCLUDED.description, price_cents = EXCLUDED.price_cents,
           price_source = EXCLUDED.price_source, concept_id = EXCLUDED.concept_id,
           concept_confidence = EXCLUDED.concept_confidence, attributes = EXCLUDED.attributes,
           status = 'verified', source_url = EXCLUDED.source_url, last_checked_at = now()
         RETURNING id`,
        [shopId, it.name, it.description ?? null, priceCents, priceCents == null ? null : "team_entered",
         it.size ?? null, it.concept ?? null, it.concept ? 1 : null,
         JSON.stringify(it.category ? { category: it.category } : {})],
      );
      rows.push({ id: r[0].id, conceptId: it.concept ?? null, priceCents, size: it.size ?? undefined, name: it.name });
    }
    if (shop.replace) {
      await pool.query(
        `UPDATE menu_item SET status = 'stale'
          WHERE shop_id = $1 AND last_checked_at < $2 AND price_source IS DISTINCT FROM 'team_entered'`,
        [shopId, startedAt],
      );
    }
    if (shop.milkOptions?.length) await pool.query(`UPDATE shop SET milk_options = $2 WHERE id = $1`, [shopId, shop.milkOptions]);

    // Price comparison against each chain, same rules as the pipeline (plain code, no Gemini).
    type Best = { itemId: string; itemName: string; priceCents: number; diff: number };
    const best = new Map<string, Best>();
    for (const row of rows) {
      if (!row.conceptId || row.priceCents == null) continue;
      const sameConcept = refs.filter((r) => r.concept_id === row.conceptId);
      const chosen = [...new Set(sameConcept.map((r) => r.chain_name as string))]
        .map((c) => closest(row.name, sameConcept.filter((r) => r.chain_name === c)))
        .filter((r): r is NonNullable<typeof r> => r !== null);
      await pool.query(
        `DELETE FROM price_comparison WHERE menu_item_id = $1 AND chain_reference_id <> ALL($2::int[])`,
        [row.id, chosen.map((r) => r.id)],
      );
      for (const ref of chosen) {
        const res = await comparePrice({
          chain: ref.chain_name,
          local: { name: row.name, priceCents: row.priceCents, size: row.size },
          chainRef: {
            id: String(ref.id), priceCents: ref.approx_price_cents, size: ref.size, approximate: true,
            asOf: new Date(ref.as_of_date).toISOString().slice(0, 10),
          },
        });
        if (!res) {
          await pool.query(`DELETE FROM price_comparison WHERE menu_item_id = $1 AND chain_reference_id = $2`, [row.id, ref.id]);
          continue;
        }
        await pool.query(
          `INSERT INTO price_comparison (menu_item_id, chain_reference_id, local_price_cents, chain_price_cents, size_match, verdict, sentence)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (menu_item_id, chain_reference_id) DO UPDATE SET
             local_price_cents = EXCLUDED.local_price_cents, chain_price_cents = EXCLUDED.chain_price_cents,
             size_match = EXCLUDED.size_match, verdict = EXCLUDED.verdict, sentence = EXCLUDED.sentence, computed_at = now()`,
          [row.id, Number(res.chainReferenceId), row.priceCents, ref.approx_price_cents, res.sizeMatch, res.verdict, res.sentence],
        );
        const cur = best.get(ref.chain_name);
        if (!cur || res.priceDiffCents < cur.diff) {
          best.set(ref.chain_name, { itemId: row.id, itemName: row.name, priceCents: row.priceCents, diff: res.priceDiffCents });
        }
      }
    }

    // Geofence message per chain. The existing hook (if any) is reused.
    const { rows: hookRows } = await pool.query(`SELECT hook FROM shop WHERE id = $1`, [shopId]);
    const hook: string | null = hookRows[0]?.hook ?? null;
    for (const chain of new Set(refs.map((r) => r.chain_name as string))) {
      const b = best.get(chain);
      const { message } = await writeGeofenceMessage({ chain, shopName, itemName: b?.itemName ?? "", priceCents: b?.priceCents ?? null, hook });
      await pool.query(
        `INSERT INTO geofence_message (shop_id, chain_name, menu_item_id, message) VALUES ($1,$2,$3,$4)
         ON CONFLICT (shop_id, chain_name) DO UPDATE SET
           menu_item_id = EXCLUDED.menu_item_id, message = EXCLUDED.message, generated_at = now()`,
        [shopId, chain, b?.itemId ?? null, message],
      );
    }

    await pool.query(`UPDATE shop SET last_ingested_at = now() WHERE id = $1`, [shopId]);
    console.log(`manual: loaded ${shopName}: ${rows.length} items, ${rows.filter((r) => r.conceptId).length} with a concept`);
  }
}