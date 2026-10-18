// Google Places API (New) helpers. Server-side key only: PLACES_API_KEY.
const BASE = "https://places.googleapis.com/v1";

function key(): string {
  const k = process.env.PLACES_API_KEY;
  if (!k) throw new Error("PLACES_API_KEY missing from .env");
  return k;
}

async function places<T>(path: string, mask: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key(),
      "X-Goog-FieldMask": mask,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    // The body never contains our key, so it is safe to put in the job error.
    throw new Error(`Places ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export type Rect = { low: { latitude: number; longitude: number }; high: { latitude: number; longitude: number } };

export type PlaceHit = {
  id: string;
  displayName?: { text: string };
  location?: { latitude: number; longitude: number };
  businessStatus?: string;
  types?: string[];
};

export async function searchText(textQuery: string, rect: Rect, maxPages = 3): Promise<PlaceHit[]> {
  const out: PlaceHit[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const r = await places<{ places?: PlaceHit[]; nextPageToken?: string }>(
      "/places:searchText",
      "places.id,places.displayName,places.location,places.businessStatus,places.types,nextPageToken",
      { textQuery, locationRestriction: { rectangle: rect }, pageSize: 20, ...(pageToken ? { pageToken } : {}) },
    );
    out.push(...(r.places ?? []));
    pageToken = r.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

export type PlacePhoto = {
  name: string; widthPx?: number; heightPx?: number;
  authorAttributions?: { displayName?: string; uri?: string; photoUri?: string }[];
};

export type PlaceDetails = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  regularOpeningHours?: { periods?: unknown[]; weekdayDescriptions?: string[] };
  websiteUri?: string;
  rating?: number;
  priceLevel?: string;
  photos?: PlacePhoto[];
  types?: string[];
  businessStatus?: string;
};

export async function getDetails(placeId: string): Promise<PlaceDetails> {
  return places<PlaceDetails>(
    `/places/${encodeURIComponent(placeId)}`,
    "id,displayName,formattedAddress,location,regularOpeningHours,websiteUri,rating,priceLevel,photos,types,businessStatus",
  );
}

const LEVELS: Record<string, number> = {
  PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4,
};
export const priceLevelToInt = (p?: string): number | null => (p && p in LEVELS ? LEVELS[p] : null);