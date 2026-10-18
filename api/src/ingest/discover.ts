import { pool } from "../db";
import { searchText, type PlaceHit, type Rect } from "./places";

// Approximate boxes. Check them on a map once and adjust if a block is missing.
export const AREAS: Record<string, Rect> = {
  // University Way NE ("the Ave"), roughly NE 40th to NE 50th.
  udistrict: { low: { latitude: 47.6535, longitude: -122.3205 }, high: { latitude: 47.668, longitude: -122.3065 } },
  // University Village shopping center.
  uvillage: { low: { latitude: 47.66, longitude: -122.304 }, high: { latitude: 47.666, longitude: -122.294 } },
};

const QUERIES = ["coffee shop", "cafe", "espresso bar", "bubble tea", "tea house"];
const OK_TYPES = new Set(["cafe", "coffee_shop", "tea_house", "coffee_roastery", "bubble_tea_store"]);

// Chains are the thing we compare AGAINST, so they never become "local" shops.
const CHAIN_RE = /starbucks|dunkin|peet'?s|tully'?s|seattle'?s best|caribou|dutch bros|coffee bean|tim hortons|blue bottle|7-eleven|mcdonald|subway|panera|jamba|kung fu tea|gong cha|sharetea|tiger sugar|happy ?lemon/i;
export async function runDiscover(payload: Record<string, unknown>): Promise<void> {
  const area = String(payload.area ?? "");
  const rect = (payload.rect as Rect | undefined) ?? AREAS[area];
  if (!rect) throw new Error(`discover_area needs payload.area (${Object.keys(AREAS).join(", ")}) or payload.rect`);
  const max = Number(payload.max ?? 40); // cap, to protect Places and Gemini quota
  const force = payload.force === true;

  const hits = new Map<string, PlaceHit>();
  for (const q of QUERIES) {
    for (const p of await searchText(q, rect)) hits.set(p.id, p);
  }

  const wanted = [...hits.values()].filter((p) => {
    const name = p.displayName?.text ?? "";
    if (p.businessStatus && p.businessStatus !== "OPERATIONAL") return false;
    if (CHAIN_RE.test(name)) return false;
    return (p.types ?? []).some((t) => OK_TYPES.has(t));
  });

  const done = new Set<string>(
    force ? [] : (await pool.query(`SELECT place_id FROM shop WHERE last_ingested_at IS NOT NULL`)).rows.map((r) => r.place_id),
  );
  const queued = new Set<string>(
    (await pool.query(`SELECT payload->>'placeId' AS id FROM job WHERE type = 'ingest_shop' AND status IN ('queued','running')`))
      .rows.map((r) => r.id),
  );

  let n = 0;
  for (const p of wanted) {
    if (n >= max) break;
    if (done.has(p.id) || queued.has(p.id)) continue;
    await pool.query(`INSERT INTO job (type, payload) VALUES ('ingest_shop', $1)`, [
      JSON.stringify({ placeId: p.id, shopName: p.displayName?.text }),
    ]);
    n++;
  }
  console.log(`discover ${area}: ${hits.size} found, ${wanted.length} local cafes, ${n} queued`);
}