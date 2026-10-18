// Closest-name matching between a local item and a chain's items. Plain word overlap:
// free, instant, and the same answer every time (no Gemini, so no quota).
const STOP = new Set(["the", "a", "an", "with", "and", "w", "of", "large", "medium", "small", "iced", "hot", "l"]);

export function tokens(s: string): Set<string> {
  const words = s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/)
    .filter((t) => t && !STOP.has(t))
    .map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t));
  const out = new Set(words);
  // "passion fruit" and "passionfruit" should match: also add each pair of neighbours glued together.
  for (let i = 0; i + 1 < words.length; i++) out.add(words[i] + words[i + 1]);
  return out;
}

export function nameScore(a: string, b: string): number {
  const x = tokens(a), y = tokens(b);
  if (x.size === 0 || y.size === 0) return 0;
  let both = 0;
  for (const t of x) if (y.has(t)) both++;
  return both / (x.size + y.size - both); // Jaccard, 0..1
}

// Best candidate for a name. Ties go to the cheaper price, then the featured row.
export function closest<T extends { item_name: string | null; approx_price_cents: number; is_featured?: boolean }>(
  name: string, candidates: T[],
): T | null {
  let best: T | null = null, bestScore = -1;
  for (const c of candidates) {
    const s = nameScore(name, c.item_name ?? "");
    const better =
      s > bestScore ||
      (s === bestScore && best && (c.approx_price_cents < best.approx_price_cents ||
        (c.approx_price_cents === best.approx_price_cents && c.is_featured && !best.is_featured)));
    if (better) { best = c; bestScore = s; }
  }
  return best;
}