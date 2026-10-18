import { pool } from "../db";
import { CONCEPTS } from "../../../ai/concepts";
import {
  extractMenu, matchConcepts, makeHook, comparePrice, writeGeofenceMessage,
  type MenuItemDraft,
} from "../../../ai";
import { getDetails, priceLevelToInt, type PlaceDetails } from "./places";
import { fetchPage, findMenuLinks, isOrderingHost } from "./web";
import { closest } from "./similar";

const CONCEPT_MIN = 0.6; // below this a match is treated as "no concept"
const MIN_ITEMS = 5;     // stop fetching more pages once we have this many items

type SourcedItem = MenuItemDraft & { sourceUrl: string };

function must<T extends { error?: string }>(what: string, r: T): T {
  // ai/ never throws. It sets .error when Gemini failed, which means "retry", not "no result".
  if (r.error) throw new Error(`${what} failed: ${r.error}`);
  return r;
}

export async function runIngest(payload: Record<string, unknown>): Promise<void> {
  if (process.env.AI_REAL !== "1") {
    throw new Error("AI_REAL=1 is not set, so ai/ would return stub data. Refusing to write it to the database.");
  }
  const startedAt = new Date();
  const placeId = payload.placeId ? String(payload.placeId) : null;
  if (!placeId) throw new Error("ingest_shop payload needs placeId (use discover_area, or /ingest with placeId)");

  // 1. Places: the facts.
  const d = await getDetails(placeId);
  const name = d.displayName?.text ?? String(payload.shopName ?? "");
  if (!name || !d.location) throw new Error(`Places returned no name or location for ${placeId}`);
  const shopId = await upsertShop(d, name);

  // 2. Menu. Tier 1: the shop's own website and its menu/ordering pages.
  const { items, milkOptions, homeText, homeUrl } = await menuFromWebsite(name, d.websiteUri);
  // Tier 2 (menu photos) needs ai/extractMenu to accept images. It does not yet, so it is skipped.
  // Tier 3: Places has no structured menu items, and we do not invent any.
  if (items.length === 0) console.log(`no menu found for ${name}; stored the shop without items`);

  // 3. Match items to concepts.
  const matched = items.length
    ? await matchConcepts(items.map((i) => ({ name: i.name, description: i.description, category: i.category })), CONCEPTS)
    : [];
  matched.forEach((m, i) => must(`matchConcepts("${items[i].name}")`, m));

  // 4. Write items (idempotent upserts), then mark old ones stale.
  const rows: { id: string; conceptId: string | null; priceCents: number | null; size?: string; name: string }[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const m = matched[i];
    const conceptId = m.conceptId && m.confidence >= CONCEPT_MIN ? m.conceptId : null;
    const price = it.priceCents != null && it.priceCents > 0 ? it.priceCents : null; // null = "Price not listed"
    const priceSource = price == null ? null : isOrderingHost(it.sourceUrl) ? "ordering_page" : "menu_page";
    const { rows: r } = await pool.query(
      `INSERT INTO menu_item (shop_id, name, description, price_cents, price_source, size, concept_id,
                              concept_confidence, attributes, status, source_url, last_checked_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
       ON CONFLICT (shop_id, name, coalesce(size, '')) DO UPDATE SET
         description = EXCLUDED.description, price_cents = EXCLUDED.price_cents,
         price_source = EXCLUDED.price_source, concept_id = EXCLUDED.concept_id,
         concept_confidence = EXCLUDED.concept_confidence, attributes = EXCLUDED.attributes,
         status = EXCLUDED.status, source_url = EXCLUDED.source_url, last_checked_at = now()
       RETURNING id`,
      [shopId, it.name, it.description ?? null, price, priceSource, it.size ?? null, conceptId,
       m.confidence, JSON.stringify(m.attributes ?? {}), it.confidence === "high" && conceptId ? "verified" : "pending", it.sourceUrl],
    );
    rows.push({ id: r[0].id, conceptId, priceCents: price, size: it.size, name: it.name });
  }
  if (items.length) {
    // Only when we actually read a menu this run, so a failed fetch never wipes good data.
    await pool.query(
      `UPDATE menu_item SET status = 'stale'
        WHERE shop_id = $1 AND last_checked_at < $2 AND price_source IS DISTINCT FROM 'team_entered'`,
      [shopId, startedAt],
    );
  }
  if (milkOptions.length) await pool.query(`UPDATE shop SET milk_options = $2 WHERE id = $1`, [shopId, milkOptions]);

  // 5. Price comparison against every chain reference we have.
  const { rows: refs } = await pool.query(
    `SELECT id, chain_name, item_name, concept_id, size, approx_price_cents, as_of_date, is_featured FROM chain_reference`,
  );
  type Best = { chain: string; itemId: string; itemName: string; priceCents: number; diff: number };
  const best = new Map<string, Best>(); // per chain: the most favorable comparison
  for (const row of rows) {
    if (!row.conceptId) continue;
    // Per chain, compare against the chain item whose NAME is closest, among rows for this concept.
    const sameConcept = refs.filter((r) => r.concept_id === row.conceptId);
    const chosen = [...new Set(sameConcept.map((r) => r.chain_name as string))]
      .map((c) => closest(row.name, sameConcept.filter((r) => r.chain_name === c)))
      .filter((r): r is NonNullable<typeof r> => r !== null);
    // Rows for this item that point at a chain item no longer chosen are stale.
    await pool.query(
      `DELETE FROM price_comparison WHERE menu_item_id = $1 AND chain_reference_id <> ALL($2::int[])`,
      [row.id, chosen.map((r) => r.id)],
    );
    for (const ref of chosen) {
      const res = await comparePrice({
        chain: ref.chain_name,
        local: { name: row.name, priceCents: row.priceCents, size: row.size },
        chainRef: {
          id: String(ref.id), // ai/ wants a string id
          priceCents: ref.approx_price_cents,
          size: ref.size,
          approximate: true,
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
        best.set(ref.chain_name, { chain: ref.chain_name, itemId: row.id, itemName: row.name, priceCents: row.priceCents!, diff: res.priceDiffCents });
      }
    }
  }

  // 6. Hook: only stored when the verifier approves it against the page text.
  let hook: string | null = null;
  if (homeText.length >= 300 && homeUrl) {
    const h = must("makeHook", await makeHook({ shopName: name, sourceText: homeText, sourceUrl: homeUrl }));
    if (h.verified && h.hook) hook = h.hook;
    await pool.query(
      `UPDATE shop SET hook = $2, hook_source_url = $3, hook_source_text = $4,
                       hook_verified_at = CASE WHEN $2::text IS NULL THEN NULL ELSE now() END WHERE id = $1`,
      [shopId, hook, hook ? h.sourceUrl : null, hook ? homeText.slice(0, 8000) : null],
    );
  }

  // 7. Geofence message per chain (the text keeps a literal {minutes}).
  for (const chain of new Set(refs.map((r) => r.chain_name as string))) {
    const b = best.get(chain);
    const { message } = await writeGeofenceMessage({
      chain, shopName: name, itemName: b?.itemName ?? "", priceCents: b?.priceCents ?? null, hook,
    });
    await pool.query(
      `INSERT INTO geofence_message (shop_id, chain_name, menu_item_id, message) VALUES ($1,$2,$3,$4)
       ON CONFLICT (shop_id, chain_name) DO UPDATE SET
         menu_item_id = EXCLUDED.menu_item_id, message = EXCLUDED.message, generated_at = now()`,
      [shopId, chain, b?.itemId ?? null, message],
    );
  }

  await pool.query(`UPDATE shop SET last_ingested_at = now() WHERE id = $1`, [shopId]);
  console.log(`ingested ${name}: ${rows.length} items, ${rows.filter((r) => r.conceptId).length} matched, hook=${hook ? "yes" : "no"}`);
}

async function upsertShop(d: PlaceDetails, name: string): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO shop (place_id, name, address, lat, lng, hours, website_url, rating, price_level, source_urls)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (place_id) DO UPDATE SET
       name = EXCLUDED.name, address = EXCLUDED.address, lat = EXCLUDED.lat, lng = EXCLUDED.lng,
       hours = EXCLUDED.hours, website_url = EXCLUDED.website_url, rating = EXCLUDED.rating,
       price_level = EXCLUDED.price_level, source_urls = EXCLUDED.source_urls
     RETURNING id`,
    [d.id, name, d.formattedAddress ?? null, d.location!.latitude, d.location!.longitude,
     d.regularOpeningHours ? JSON.stringify(d.regularOpeningHours) : null, d.websiteUri ?? null,
     d.rating ?? null, priceLevelToInt(d.priceLevel), d.websiteUri ? [d.websiteUri] : []],
  );
  const shopId: string = rows[0].id;

  // Up to 5 photo REFERENCES (never image bytes or key-bearing URLs).
  for (const [i, p] of (d.photos ?? []).slice(0, 5).entries()) {
    await pool.query(
      `INSERT INTO shop_photo (shop_id, photo_name, width_px, height_px, attributions, position)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (shop_id, position) DO UPDATE SET
         photo_name = EXCLUDED.photo_name, width_px = EXCLUDED.width_px, height_px = EXCLUDED.height_px,
         attributions = EXCLUDED.attributions, fetched_at = now()`,
      [shopId, p.name, p.widthPx ?? null, p.heightPx ?? null, JSON.stringify(p.authorAttributions ?? []), i + 1],
    );
  }
  return shopId;
}

async function menuFromWebsite(shopName: string, website?: string) {
  const items: SourcedItem[] = [];
  const milk = new Set<string>();
  const seen = new Set<string>();
  let homeText = "";
  let homeUrl = "";
  if (!website) return { items, milkOptions: [] as string[], homeText, homeUrl };

  const home = await fetchPage(website);
  if (!home) return { items, milkOptions: [] as string[], homeText, homeUrl };
  homeText = home.text;
  homeUrl = home.url;

  // Menu-looking pages first, then the homepage itself.
  const pages = [...findMenuLinks(home.html, home.url), home.url];
  for (const url of pages) {
    if (items.length >= MIN_ITEMS) break;
    const page = url === home.url ? home : await fetchPage(url);
    if (!page || page.text.length < 80) continue;
    const r = must(`extractMenu(${page.url})`, await extractMenu({ shopName, text: page.text }));
    for (const it of r.items) {
      const k = `${it.name.toLowerCase()}|${(it.size ?? "").toLowerCase()}`;
      if (seen.has(k)) continue;
      seen.add(k);
      items.push({ ...it, sourceUrl: page.url });
    }
    r.milkOptions?.forEach((m) => milk.add(m));
  }
  return { items, milkOptions: [...milk], homeText, homeUrl };
}