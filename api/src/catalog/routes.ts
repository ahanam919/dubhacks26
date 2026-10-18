// Read-only routes for the app's search and browse screens (search results, shop
// page, compare). They return JSON in the exact shapes of mobile/src/types, which
// mirror the database columns, so the app needs no translation.
//
//   GET /app/shops                 every shop (for the browse map)
//   GET /app/search?q=latte        SearchResponse: concept, chain reference, local results
//   GET /app/shops/:id?q=latte     one SearchResult (404 if the shop has no menu items yet)
//   GET /app/featured-chain        the featured chain reference
//
// Optional &lat=..&lng=.. on search and shop: walking minutes are measured from
// there instead of the demo starting point.

import type { FastifyPluginAsync } from "fastify";
import { pool } from "../db";
import { distanceMeters, isValidPoint, walkMinutes, type Point } from "../geofence/distance";
import { isOpenNow } from "./openNow";
import { type ConceptRow, matchConcept, pickItem } from "./pick";

// Same spot as the app's starting pin (mobile/src/lib/geofenceApi.ts DEMO_CENTER).
const DEFAULT_FROM: Point = { lat: 47.6595, lng: -122.3045 };
const MIN_CONCEPT_CONFIDENCE = 0.75; // same cutoff as scripts/build-fallback.ts
const MAX_RESULTS = 30;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Columns cast where Postgres would otherwise send strings (numeric, bigint) or
// full timestamps for date-only fields.
const SHOP_COLS = `id, place_id, name, address, lat, lng, hours, website_url,
  rating::float8 AS rating, price_level, badges, aspects, aspects_count,
  to_char(aspects_as_of, 'YYYY-MM-DD') AS aspects_as_of, hook, hook_source_url,
  hook_source_text, hook_verified_at, source_urls, last_ingested_at, created_at,
  is_demo, order_tier, square_location_id, prep_minutes`;
const ITEM_COLS = `id, shop_id, name, description, price_cents, price_source, size,
  concept_id, concept_confidence, attributes, status, source_url, last_checked_at, created_at`;
const CHAIN_COLS = `id, chain_name, item_name, concept_id, size, approx_price_cents,
  to_char(as_of_date, 'YYYY-MM-DD') AS as_of_date, source_url, is_featured`;
const PHOTO_COLS = `id::int AS id, shop_id, photo_name, width_px, height_px, attributions, position, fetched_at`;
const COMPARISON_COLS = `id::int AS id, menu_item_id, chain_reference_id, local_price_cents,
  chain_price_cents, delta_cents, size_match, verdict, sentence, computed_at`;

// Database rows are passed through to the app as-is (their shapes are in mobile/src/types).
type Row = any;

class NotFound extends Error {}

function fromPoint(q: { lat?: string; lng?: string }): Point {
  const p = { lat: Number(q.lat), lng: Number(q.lng) };
  return q.lat != null && q.lng != null && isValidPoint(p) ? p : DEFAULT_FROM;
}

async function loadConcepts(): Promise<ConceptRow[]> {
  const { rows } = await pool.query("SELECT id, name, aliases FROM concept");
  return rows as ConceptRow[];
}

/**
 * The chain item to compare against: the first of these concepts that has a
 * chain price, else the featured one.
 */
async function chainFor(...conceptIds: (string | null | undefined)[]): Promise<Row> {
  for (const conceptId of conceptIds) {
    if (!conceptId) continue;
    const { rows } = await pool.query(
      `SELECT ${CHAIN_COLS} FROM chain_reference r
        WHERE concept_id = $1
        ORDER BY is_featured DESC,
                 (chain_name = (SELECT default_chain FROM concept WHERE id = $1)) DESC NULLS LAST,
                 id
        LIMIT 1`,
      [conceptId],
    );
    if (rows[0]) return rows[0];
  }
  const { rows } = await pool.query(
    `SELECT ${CHAIN_COLS} FROM chain_reference ORDER BY is_featured DESC, id LIMIT 1`,
  );
  if (!rows[0]) throw new Error("No chain reference prices in the database yet");
  return rows[0];
}

/** Builds SearchResult objects for (shop, item) pairs, with photos and comparisons. */
async function buildResults(pairs: { shop: Row; item: Row }[], chainId: number, from: Point) {
  if (pairs.length === 0) return [];
  const shopIds = pairs.map((p) => p.shop.id);
  const itemIds = pairs.map((p) => p.item.id);
  const [photos, comparisons] = await Promise.all([
    pool.query(`SELECT ${PHOTO_COLS} FROM shop_photo WHERE shop_id = ANY($1) ORDER BY position`, [shopIds]),
    pool.query(
      `SELECT ${COMPARISON_COLS} FROM price_comparison
        WHERE menu_item_id = ANY($1) AND chain_reference_id = $2
        ORDER BY computed_at DESC`,
      [itemIds, chainId],
    ),
  ]);
  const now = new Date();
  return pairs.map(({ shop, item }) => ({
    shop,
    photos: photos.rows.filter((ph) => ph.shop_id === shop.id),
    item,
    // Only a comparison against the chain item shown on screen, so the numbers match.
    comparison: comparisons.rows.find((c) => c.menu_item_id === item.id) ?? null,
    distance_min: walkMinutes(distanceMeters(from, shop)),
    open_now: isOpenNow(shop.hours, now),
  }));
}

async function loadShopsById(ids: string[]): Promise<Map<string, Row>> {
  if (ids.length === 0) return new Map();
  const { rows } = await pool.query(`SELECT ${SHOP_COLS} FROM shop WHERE id = ANY($1)`, [ids]);
  return new Map(rows.map((r) => [r.id, r]));
}

export async function searchCatalog(query: string, from: Point) {
  const q = query.trim();
  const concepts = await loadConcepts();
  const concept = matchConcept(q, concepts);

  let items: Row[] = [];
  if (concept) {
    ({ rows: items } = await pool.query(
      `SELECT ${ITEM_COLS} FROM menu_item
        WHERE concept_id = $1 AND status <> 'stale'
          AND coalesce(concept_confidence, 1) >= $2`,
      [concept.id, MIN_CONCEPT_CONFIDENCE],
    ));
  }
  // No concept, or nothing filed under it: fall back to matching item names.
  if (items.length === 0 && q.length >= 2) {
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    ({ rows: items } = await pool.query(
      `SELECT ${ITEM_COLS} FROM menu_item
        WHERE status <> 'stale' AND (name ILIKE $1 OR description ILIKE $1)`,
      [like],
    ));
  }

  // One item per shop: the cheapest match.
  const byShop = new Map<string, Row[]>();
  for (const it of items) byShop.set(it.shop_id, [...(byShop.get(it.shop_id) ?? []), it]);
  const shops = await loadShopsById([...byShop.keys()]);
  const pairs = [...byShop.entries()]
    .map(([shopId, list]) => ({ shop: shops.get(shopId), item: pickItem(list, concept?.id ?? null) }))
    .filter((p): p is { shop: Row; item: Row } => !!p.shop && !!p.item)
    .sort((a, b) => distanceMeters(from, a.shop) - distanceMeters(from, b.shop))
    .slice(0, MAX_RESULTS);

  // Compare against the searched drink if a chain sells it, else the drink the
  // results are filed under (e.g. "horchata" results are lattes), else the featured item.
  const chain = await chainFor(concept?.id, ...pairs.map((p) => p.item.concept_id));
  // The app labels the chain price with this concept's name, so it must describe
  // the chain item actually shown.
  const shown = concepts.find((c) => c.id === chain.concept_id) ?? null;
  return {
    query: q,
    concept: shown ? { id: shown.id, name: shown.name, aliases: shown.aliases } : null,
    chain,
    results: await buildResults(pairs, chain.id, from),
  };
}

export async function shopResult(id: string, query: string | undefined, from: Point) {
  if (!UUID_RE.test(id)) throw new NotFound("Shop not found");
  const shops = await loadShopsById([id]);
  const shop = shops.get(id);
  if (!shop) throw new NotFound("Shop not found");

  const { rows: items } = await pool.query(
    `SELECT ${ITEM_COLS} FROM menu_item WHERE shop_id = $1 AND status <> 'stale'`,
    [id],
  );
  // Prefer the item for what was searched; otherwise the featured chain's drink.
  let conceptId = query ? (matchConcept(query, await loadConcepts())?.id ?? null) : null;
  if (!conceptId) conceptId = (await chainFor()).concept_id ?? null;
  const item = pickItem(items, conceptId);
  if (!item) throw new NotFound("This shop has no menu items yet");

  const chain = await chainFor(item.concept_id, conceptId);
  const [result] = await buildResults([{ shop, item }], chain.id, from);
  return result;
}

export const catalogRoutes: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof NotFound) return reply.code(404).send({ message: err.message });
    req.log.error({ err }, "catalog route failed");
    return reply.code(500).send({ message: "Something went wrong loading shops. Try again." });
  });

  app.get("/shops", async () => {
    const { rows } = await pool.query(`SELECT ${SHOP_COLS} FROM shop ORDER BY name`);
    return rows;
  });

  app.get("/featured-chain", async () => chainFor());

  app.get("/search", async (req) => {
    const q = req.query as { q?: string; lat?: string; lng?: string };
    return searchCatalog(String(q.q ?? "").slice(0, 200), fromPoint(q));
  });

  app.get("/shops/:id", async (req) => {
    const { id } = req.params as { id: string };
    const q = req.query as { q?: string; lat?: string; lng?: string };
    return shopResult(id, q.q ? String(q.q).slice(0, 200) : undefined, fromPoint(q));
  });
};
