import { RankFactor, SearchResult } from '../types';

// Pure function: replace with the backend ranking later without touching the UI.
export function rankResults(results: SearchResult[], factor: RankFactor): SearchResult[] {
  const copy = [...results];
  // Missing prices sort last. (Infinity - Infinity is NaN, which falls through to the tiebreaker.)
  const price = (r: SearchResult) => r.item.price_cents ?? Number.POSITIVE_INFINITY;

  switch (factor) {
    case 'price':
      return copy.sort((a, b) => price(a) - price(b) || a.distance_min - b.distance_min);
    case 'distance':
      return copy.sort((a, b) => a.distance_min - b.distance_min);
    case 'openNow':
      return copy.sort(
        (a, b) => Number(b.open_now) - Number(a.open_now) || a.distance_min - b.distance_min
      );
  }
}
