// Small pure helpers for the search routes, kept separate so they can be tested
// without a database.

export type ConceptRow = { id: string; name: string; aliases: string[] };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * Which concept a search is about. Exact name or alias wins; otherwise the
 * longest concept name or alias found inside the query ("iced latte near me"
 * finds "latte"); otherwise null (the search falls back to item names).
 */
export function matchConcept(query: string, concepts: ConceptRow[]): ConceptRow | null {
  const q = norm(query);
  if (!q) return null;
  for (const c of concepts) {
    if (norm(c.name) === q || c.aliases.some((a) => norm(a) === q)) return c;
  }
  let best: { c: ConceptRow; len: number } | null = null;
  const padded = ` ${q} `;
  for (const c of concepts) {
    for (const term of [c.name, ...c.aliases]) {
      const t = norm(term);
      if (t.length >= 3 && padded.includes(` ${t} `) && (!best || t.length > best.len)) {
        best = { c, len: t.length };
      }
    }
  }
  return best?.c ?? null;
}

export type ItemLike = { id: string; price_cents: number | null; concept_id: string | null };

/**
 * The one item to show for a shop: one that matches the concept if given,
 * cheapest first; items with no price come last. Null if the shop has no items.
 */
export function pickItem<T extends ItemLike>(items: T[], conceptId: string | null): T | null {
  const pool = conceptId ? items.filter((i) => i.concept_id === conceptId) : items;
  const list = pool.length > 0 ? pool : items;
  if (list.length === 0) return null;
  return [...list].sort(
    (a, b) => (a.price_cents ?? Number.POSITIVE_INFINITY) - (b.price_cents ?? Number.POSITIVE_INFINITY),
  )[0];
}
