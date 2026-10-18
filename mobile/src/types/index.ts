// Mirrors migrations_001.sql. Field names are snake_case ON PURPOSE so the
// API JSON can match the database columns 1:1 with no translation layer.
// Fields marked PROPOSED are not in the schema yet (see the notes to your
// backend teammate). Fields marked GUESS have an unknown jsonb shape.

export type OrderTier = 1 | 2 | 3; // PROPOSED. 1 = order here, 2 = order link, 3 = directions
export type ItemStatus = 'pending' | 'verified' | 'stale';
export type PriceSource = 'menu_page' | 'google_places' | 'estimated'; // list TBD with AI teammate

export type Shop = {
  id: string; // uuid
  place_id: string; // Google place id (NOT NULL UNIQUE in the schema)
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  hours: Record<string, string> | null; // GUESS: jsonb shape unknown
  website_url: string | null;
  rating: number | null;
  price_level: number | null;
  badges: string[];
  aspects: Record<string, number> | null; // GUESS: jsonb shape unknown
  aspects_count: number | null;
  aspects_as_of: string | null; // date
  hook: string | null;
  hook_source_url: string | null;
  hook_source_text: string | null;
  hook_verified_at: string | null; // only show the hook when this is set
  source_urls: string[];
  last_ingested_at: string | null;
  created_at: string;
  // PROPOSED additions for the Square piece:
  is_demo: boolean;
  order_tier: OrderTier;
  square_location_id: string | null;
  prep_minutes: number | null;
};

export type PhotoAttribution = { name: string; url: string }; // GUESS

export type ShopPhoto = {
  id: number;
  shop_id: string;
  photo_name: string; // Google photo reference, NOT an image URL
  width_px: number | null;
  height_px: number | null;
  attributions: PhotoAttribution[] | null; // must be displayed with the photo
  position: number; // 1 to 5
  fetched_at: string;
};

export type Concept = {
  id: string; // e.g. 'pumpkin_spice_latte'
  name: string;
  aliases: string[];
  // embedding is never sent to the app
};

export type MenuItem = {
  id: string;
  shop_id: string;
  name: string;
  description: string | null;
  price_cents: number | null; // null means "price not listed", never $0
  price_source: PriceSource | null;
  size: string | null;
  concept_id: string | null;
  concept_confidence: number | null;
  attributes: Record<string, unknown>;
  status: ItemStatus;
  source_url: string | null;
  last_checked_at: string | null;
  created_at: string;
};

export type ChainReference = {
  id: number;
  chain_name: string;
  concept_id: string;
  size: string;
  approx_price_cents: number;
  as_of_date: string; // date
  source_url: string | null;
  is_featured: boolean;
};

export type PriceComparison = {
  id: number;
  menu_item_id: string;
  chain_reference_id: number;
  local_price_cents: number;
  chain_price_cents: number;
  delta_cents: number; // local - chain. NEGATIVE means the local shop is cheaper
  computed_at: string;
};

export type GeofenceMessage = {
  id: number;
  shop_id: string;
  chain_name: string;
  menu_item_id: string | null;
  message: string;
  generated_at: string;
};

// One row in the results list: a shop plus the menu item that matched the
// search. distance_min and open_now are computed per request by the server,
// so they are not stored columns.
export type SearchResult = {
  shop: Shop;
  photos: ShopPhoto[];
  item: MenuItem;
  comparison: PriceComparison | null; // null when the item has no price
  distance_min: number; // walking minutes
  open_now: boolean;
};

// What the results screen needs from one search.
export type SearchResponse = {
  query: string;
  concept: Concept | null;
  chain: ChainReference; // the featured chain item (left column)
  results: SearchResult[]; // ranked local shops (right column)
};

export type RankFactor = 'price' | 'distance' | 'openNow';
