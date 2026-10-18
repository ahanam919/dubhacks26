import { pool } from "../db";
import { searchText, type PlaceHit, type Rect } from "./places";
import { ZONES, QUERIES, OK_TYPES, CHAIN_RE, ENOUGH_ITEMS } from "./zones";

// Finds cafes in a zone and queues one ingest_shop job per shop. Settings live in zones.ts.
export async function runDiscover(payload: Record<string, unknown>): Promise<void> {
  const area = String(payload.area ?? "");
  const zone = ZONES[area];
  const rect = (payload.rect as Rect | undefined) ?? zone?.rect;
  if (!rect) throw new Error(`discover_area needs payload.area (${Object.keys(ZONES).join(", ")}) or payload.rect`);
  const deep = typeof payload.deep === "boolean" ? payload.deep : zone?.deep ?? false;
  const maps = deep && (typeof payload.maps === "boolean" ? payload.maps : zone?.maps ?? false);
  const max = Number(payload.max ?? zone?.max ?? 40);
  const force = payload.force === true;

  const hits = new Map<string, PlaceHit>();
  for (const q of QUERIES) {
    for (const p of await searchText(q, rect)) hits.set(p.id, p);
  }

  const wanted = [...hits.values()].filter((p) => {
    const name = p.displayName?.text ?? "";
    if (p.businessStatus && p.businessStatus !== "OPERATIONAL") return false;
    if (CHAIN_RE.test(name)) return false;
    // The place's MAIN type has to be a coffee or tea type. "types" lists everything a place is
    // tagged as, which lets chocolate shops, bakeries and restaurants in because they also say "cafe".
    return p.primaryType ? OK_TYPES.has(p.primaryType) : false;
  });

  // Which shops to skip. A normal zone skips anything already ingested. A deep zone only skips shops
  // that already have enough menu items, so shops that were stored thin get another go with photos.
  const { rows: doneRows } = force
    ? { rows: [] as { place_id: string }[] }
    : deep
      ? await pool.query(
          `SELECT s.place_id FROM shop s
            WHERE (SELECT count(*) FROM menu_item m WHERE m.shop_id = s.id AND m.status <> 'stale') >= $1`,
          [ENOUGH_ITEMS],
        )
      : await pool.query(`SELECT place_id FROM shop WHERE last_ingested_at IS NOT NULL`);
  const done = new Set<string>(doneRows.map((r) => r.place_id));
  const queued = new Set<string>(
    (await pool.query(`SELECT payload->>'placeId' AS id FROM job WHERE type = 'ingest_shop' AND status IN ('queued','running')`))
      .rows.map((r) => r.id),
  );

  let n = 0;
  for (const p of wanted) {
    if (n >= max) break;
    if (done.has(p.id) || queued.has(p.id)) continue;
    await pool.query(`INSERT INTO job (type, payload) VALUES ('ingest_shop', $1)`, [
      JSON.stringify({ placeId: p.id, shopName: p.displayName?.text, deep, maps }),
    ]);
    n++;
  }
  console.log(`discover ${area || "custom rect"} (deep=${deep}, maps=${maps}): ${hits.size} found, ${wanted.length} local cafes, ${n} queued`);
}