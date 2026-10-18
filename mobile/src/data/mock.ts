import {
  ChainReference,
  Concept,
  GeofenceMessage,
  MenuItem,
  PriceComparison,
  SearchResponse,
  SearchResult,
  Shop,
  ShopPhoto,
} from '../types';
import { API_URL } from '../lib/config';

// ---------- ids (valid uuid format, readable on purpose) ----------
const SHOP_ID = {
  demo: '00000000-0000-4000-8000-000000000001',
  roasters: '00000000-0000-4000-8000-000000000002',
  bakehouse: '00000000-0000-4000-8000-000000000003',
  placeholder: '00000000-0000-4000-8000-000000000004',
  tea: '00000000-0000-4000-8000-000000000005',
};
const ITEM_ID = {
  demo: '10000000-0000-4000-8000-000000000001',
  roasters: '10000000-0000-4000-8000-000000000002',
  bakehouse: '10000000-0000-4000-8000-000000000003',
  placeholder: '10000000-0000-4000-8000-000000000004',
  tea: '10000000-0000-4000-8000-000000000005',
};

// ---------- concept + chain reference ----------
export const CONCEPT: Concept = {
  id: 'pumpkin_spice_latte',
  name: 'Pumpkin spice latte',
  aliases: ['psl', 'pumpkin latte', 'pumpkin spice'],
};

export const CHAIN: ChainReference = {
  id: 1,
  chain_name: 'Starbucks',
  concept_id: 'pumpkin_spice_latte',
  size: 'grande',
  approx_price_cents: 655,
  as_of_date: '2026-10-01',
  source_url: null, // add a real source before showing this to anyone
  is_featured: true,
};

// ---------- shops ----------
// Defaults so each shop below only lists what makes it different.
const baseShop = {
  address: null,
  hours: null,
  website_url: null,
  rating: null,
  price_level: null,
  badges: [] as string[],
  aspects: null,
  aspects_count: null,
  aspects_as_of: null,
  hook: null,
  hook_source_url: null,
  hook_source_text: null,
  hook_verified_at: null,
  source_urls: [] as string[],
  last_ingested_at: '2026-10-16T12:00:00Z',
  created_at: '2026-10-15T12:00:00Z',
  is_demo: false,
  square_location_id: null,
  prep_minutes: null,
};

export const SHOPS: Shop[] = [
  {
    ...baseShop,
    id: SHOP_ID.demo,
    // NOTE: the schema says place_id is NOT NULL UNIQUE, but this shop is not a
    // Google place. A placeholder like this (or a nullable column) is needed.
    place_id: 'demo-sandbox-cafe',
    name: 'Demo Cafe (sandbox)',
    address: '1 Sample St, Seattle, WA',
    lat: 47.6553,
    lng: -122.3035,
    hours: { mon: '7:00-18:00', tue: '7:00-18:00', wed: '7:00-18:00' },
    rating: 4.6,
    price_level: 2,
    badges: ['demo', 'owner_verified'],
    aspects: { coffee: 4.7, service: 4.5 },
    aspects_count: 120,
    aspects_as_of: '2026-10-10',
    hook: 'Sample hook: made with house pumpkin puree.',
    hook_source_url: null,
    hook_source_text: 'Sample source text (mock): house pumpkin puree.',
    hook_verified_at: '2026-10-16T12:00:00Z',
    is_demo: true,
    order_tier: 1, // Square connected: shows "Order pickup"
    square_location_id: 'SANDBOX_LOCATION_ID',
    prep_minutes: 7,
  },
  {
    ...baseShop,
    id: SHOP_ID.roasters,
    place_id: 'mock-place-roasters',
    name: 'Sample Roasters',
    address: '2 Example Ave, Seattle, WA',
    lat: 47.6561,
    lng: -122.3118,
    website_url: 'https://example.com/roasters',
    rating: 4.4,
    price_level: 2,
    badges: ['local'],
    hook: 'Sample hook: small-batch espresso.',
    hook_verified_at: '2026-10-14T12:00:00Z',
    order_tier: 2, // has its own ordering page: shows "Order link"
  },
  {
    ...baseShop,
    id: SHOP_ID.bakehouse,
    place_id: 'mock-place-bakehouse',
    name: 'Example Bakehouse',
    address: '3 Test Blvd, Seattle, WA',
    lat: 47.6537,
    lng: -122.3079,
    website_url: 'https://example.com/bakehouse',
    rating: 4.2,
    price_level: 2,
    badges: ['local'],
    // hook left null on purpose: tests the "no hook" card layout
    order_tier: 2,
  },
  {
    ...baseShop,
    id: SHOP_ID.placeholder,
    place_id: 'mock-place-placeholder',
    name: 'Placeholder Coffee Co.',
    address: '4 Fake Way, Seattle, WA',
    lat: 47.6575,
    lng: -122.3101,
    rating: 4.0,
    // Has hook text but NOT verified: the UI must NOT display it.
    hook: 'Unverified claim that must stay hidden.',
    hook_verified_at: null,
    order_tier: 3, // public info only: shows "Directions"
  },
  {
    ...baseShop,
    id: SHOP_ID.tea,
    place_id: 'mock-place-tea',
    name: 'Test Tea & Espresso',
    address: '5 Demo Ct, Seattle, WA',
    lat: 47.6529,
    lng: -122.3052,
    rating: 4.5,
    price_level: 1,
    hook: 'Sample hook: oat milk by default.',
    hook_verified_at: '2026-09-30T12:00:00Z',
    order_tier: 3,
  },
];

// ---------- menu items (the item that matched "PSL" at each shop) ----------
const baseItem = {
  description: null,
  size: 'grande',
  concept_id: 'pumpkin_spice_latte',
  concept_confidence: 0.9,
  attributes: {},
  created_at: '2026-10-15T12:00:00Z',
};

export const ITEMS: MenuItem[] = [
  {
    ...baseItem,
    id: ITEM_ID.demo,
    shop_id: SHOP_ID.demo,
    name: 'Pumpkin Spice Latte',
    price_cents: 575,
    price_source: 'menu_page',
    status: 'verified', // owner confirmed: recent
    source_url: null,
    last_checked_at: '2026-10-16T18:00:00Z',
  },
  {
    ...baseItem,
    id: ITEM_ID.roasters,
    shop_id: SHOP_ID.roasters,
    name: 'Pumpkin Latte',
    price_cents: 610,
    price_source: 'menu_page',
    status: 'verified',
    source_url: 'https://example.com/roasters/menu',
    last_checked_at: '2026-10-12T12:00:00Z',
  },
  {
    ...baseItem,
    id: ITEM_ID.bakehouse,
    shop_id: SHOP_ID.bakehouse,
    name: 'Spiced Pumpkin Latte',
    price_cents: 595,
    price_source: 'estimated',
    concept_confidence: 0.6, // borderline match
    status: 'pending', // never confirmed: tests the "not confirmed" state
    last_checked_at: null,
    source_url: null,
  },
  {
    ...baseItem,
    id: ITEM_ID.placeholder,
    shop_id: SHOP_ID.placeholder,
    name: 'Pumpkin Spice Latte',
    price_cents: null, // price not listed: no comparison possible
    price_source: null,
    status: 'pending',
    last_checked_at: null,
    source_url: null,
  },
  {
    ...baseItem,
    id: ITEM_ID.tea,
    shop_id: SHOP_ID.tea,
    name: 'Pumpkin Chai Latte',
    price_cents: 550,
    price_source: 'google_places',
    concept_confidence: 0.7,
    status: 'stale', // old date: tests the stale-price display
    source_url: null,
    last_checked_at: '2026-09-30T12:00:00Z',
  },
];

// ---------- photos (photo_name is a reference, not a URL) ----------
export const PHOTOS: ShopPhoto[] = [
  {
    id: 1,
    shop_id: SHOP_ID.demo,
    photo_name: 'mock-photo-reference-1',
    width_px: 800,
    height_px: 600,
    attributions: [{ name: 'Sample Author', url: 'https://example.com' }],
    position: 1,
    fetched_at: '2026-10-16T12:00:00Z',
  },
];

// ---------- geofence message (for the push demo) ----------
export const GEOFENCE_MESSAGES: GeofenceMessage[] = [
  {
    id: 1,
    shop_id: SHOP_ID.demo,
    chain_name: 'Starbucks',
    menu_item_id: ITEM_ID.demo,
    message:
      'Near Starbucks? Demo Cafe (sandbox) is 4 min away, $0.80 less for a pumpkin spice latte.',
    generated_at: '2026-10-16T12:00:00Z',
  },
];

// ---------- derived values (the server will do this later) ----------
function makeComparison(item: MenuItem, id: number): PriceComparison | null {
  if (item.price_cents == null) return null;
  return {
    id,
    menu_item_id: item.id,
    chain_reference_id: CHAIN.id,
    local_price_cents: item.price_cents,
    chain_price_cents: CHAIN.approx_price_cents,
    delta_cents: item.price_cents - CHAIN.approx_price_cents, // negative = cheaper
    computed_at: '2026-10-17T12:00:00Z',
  };
}

// distance and open-now are per-request values, so they live here, not on Shop.
const DISTANCE_MIN: Record<string, number> = {
  [SHOP_ID.demo]: 4,
  [SHOP_ID.roasters]: 6,
  [SHOP_ID.bakehouse]: 9,
  [SHOP_ID.placeholder]: 11,
  [SHOP_ID.tea]: 13,
};
const OPEN_NOW: Record<string, boolean> = {
  [SHOP_ID.demo]: true,
  [SHOP_ID.roasters]: true,
  [SHOP_ID.bakehouse]: false, // closed: tests the closed state
  [SHOP_ID.placeholder]: true,
  [SHOP_ID.tea]: true,
};

const RESULTS: SearchResult[] = SHOPS.map((shop, i) => {
  const item = ITEMS.find((it) => it.shop_id === shop.id)!;
  return {
    shop,
    photos: PHOTOS.filter((p) => p.shop_id === shop.id),
    item,
    comparison: makeComparison(item, i + 1),
    distance_min: DISTANCE_MIN[shop.id],
    open_now: OPEN_NOW[shop.id],
  };
});

// ---------- the functions your screens call ----------
// These now load real data from the API (the server's /app routes, which read the
// database). The sample data above is no longer used by these screens; it stays
// for reference and for getGeofenceMessage below.

let lastSearch: SearchResponse | null = null;

async function getJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${API_URL}${path}`, { signal: controller.signal });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(body.message ?? `Request failed (${res.status})`) as Error & { status?: number };
      err.status = res.status;
      throw err;
    }
    return body as T;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error('The server took too long. Try again.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function search(query: string): Promise<SearchResponse> {
  const res = await getJson<SearchResponse>(`/app/search?q=${encodeURIComponent(query)}`);
  lastSearch = res;
  return res;
}

// The shop page, compare and order screens all call this. Reuse the exact result
// from the last search when we have it, so every screen shows the same item and
// price; otherwise ask the server. undefined means "not found" (the screens show
// a friendly message for that).
export async function getResultById(id: string): Promise<SearchResult | undefined> {
  const hit = lastSearch?.results.find((r) => r.shop.id === id);
  if (hit) return hit;
  const q = lastSearch?.query ? `?q=${encodeURIComponent(lastSearch.query)}` : '';
  try {
    return await getJson<SearchResult>(`/app/shops/${encodeURIComponent(id)}${q}`);
  } catch (e) {
    if ((e as { status?: number }).status === 404) return undefined;
    throw e;
  }
}

// Used by the browse map to place pins.
export async function getMapShops(): Promise<Shop[]> {
  return getJson<Shop[]>('/app/shops');
}

// The chain item that results are compared against: the one from the last search,
// so the compare screen matches the results list.
export async function getFeaturedChain(): Promise<ChainReference> {
  return lastSearch?.chain ?? getJson<ChainReference>('/app/featured-chain');
}

// Used by the simulated-location screen to preview the geofence push.
// (Still sample data: the real suggestion comes from the map's geofence check.)
export async function getGeofenceMessage(): Promise<GeofenceMessage> {
  return GEOFENCE_MESSAGES[0];
}
