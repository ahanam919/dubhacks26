import type { ComparePriceInput, ComparePriceResult } from "./types";

// Pure code, no LLM. Returns null when not comparable.
const SIMILAR_CENTS = 25;   // within a quarter = "similar"
const APPROX_SIMILAR_PCT = 0.12; // for estimated chain prices, differences under 12% read as "similar"
const CLOSE_OZ = 2;         // within 2 oz = "close"

const NAMED_OZ: Record<string, number> = {
  short: 8, tall: 12, grande: 16, venti: 20,
  small: 12, medium: 16, large: 20,
};

export function sizeToOz(size?: string): number | null {
  if (!size) return null;
  const s = size.toLowerCase().trim();
  const m = s.match(/(\d+(?:\.\d+)?)\s*(?:oz|ounce)/);
  if (m) return parseFloat(m[1]);
  for (const k of Object.keys(NAMED_OZ)) if (new RegExp(`\\b${k}\\b`).test(s)) return NAMED_OZ[k];
  return null;
}

const usd = (c: number) => `$${(Math.abs(c) / 100).toFixed(2)}`;

export function comparePrice(
  input: ComparePriceInput,
  opts: { allowUnknownLocalSize?: boolean } = {},
): ComparePriceResult | null {
  const { chain, local, chainRef } = input;
  if (local.priceCents == null || chainRef.priceCents == null) return null;

  const lo = sizeToOz(local.size);
  const co = sizeToOz(chainRef.size);
  let sizeMatch: "same" | "close";
  if (lo != null && co != null) {
    const d = Math.abs(lo - co);
    if (d === 0) sizeMatch = "same";
    else if (d <= CLOSE_OZ) sizeMatch = "close";
    else return null;
  } else if (lo == null && co != null && opts.allowUnknownLocalSize) {
    sizeMatch = "close";
  } else return null;

  // An estimated chain price is not exact, so say so and use a wider "similar" band.
  const approximate = chainRef.approximate === true;
  const similarBand = approximate
    ? Math.max(SIMILAR_CENTS, Math.round(chainRef.priceCents * APPROX_SIMILAR_PCT))
    : SIMILAR_CENTS;

  const priceDiffCents = local.priceCents - chainRef.priceCents;
  const verdict = Math.abs(priceDiffCents) < similarBand ? "similar"
    : priceDiffCents < 0 ? "cheaper" : "pricier";

  const vs = approximate
    ? `${usd(local.priceCents)} vs est. ${usd(chainRef.priceCents)}`
    : `${usd(local.priceCents)} vs ${usd(chainRef.priceCents)}`;
  const more = verdict === "cheaper" ? "less" : "more";
  const core = verdict === "similar"
    ? `About the same as ${chain} (${vs})`
    : approximate
      ? `About ${usd(priceDiffCents)} ${more} than ${chain} (${vs})`
      : `${usd(priceDiffCents)} ${more} than ${chain} (${vs})`;
  const sentence = core + (sizeMatch === "close" ? ", sizes are close but not identical." : ".");

  return { chainReferenceId: chainRef.id, sizeMatch, priceDiffCents, verdict, sentence, approximate };
}