export interface ConceptDef { id: string; label: string; aliases?: string[] }

export interface MenuItemDraft {
  name: string; description?: string; priceCents?: number; size?: string;
  category?: string;
  confidence?: "high" | "medium" | "low";
}

export interface ExtractMenuInput {
  shopName: string;
  text?: string;
  imageUrls?: string[];
  images?: { mimeType: string; dataBase64: string }[]; // for photos teammates take
}
export interface ExtractMenuResult {
  items: MenuItemDraft[]; notes?: string; error?: string;
  milkOptions?: string[]; extras?: string[];
}
export interface MatchItem { name: string; description?: string; category?: string }
export interface MatchConceptResult {
  conceptId: string | null; confidence: number; attributes: Record<string, unknown>;
}

export interface WriteHookInput { shopName: string; sourceText: string; sourceUrl: string }
export interface WriteHookResult {
  hook: string | null; sourceUrl: string;
  claims?: { claim: string; sourceQuote: string }[];
}

export interface VerifyHookResult {
  supported: boolean; unsupportedClaims: string[];
  evidence?: { claim: string; quote: string }[];
}

export interface ParseQueryResult {
  itemConcept: string | null; chainAnchor?: string; dietary: string[]; size?: string;
  needsClarification?: boolean; clarifyingQuestion?: string;
}

export interface ComparePriceInput {
  chain: string;
  local: { name: string; priceCents: number; size?: string };
  chainRef: { priceCents: number; size?: string; asOf: string };
}
export interface ComparePriceResult {
  sizeMatch: "same" | "close" | "different" | "unknown";
  priceDiffCents: number | null;
  verdict: "cheaper" | "similar" | "pricier" | "not_comparable";
  sentence: string;
}

export type AspectKey = "taste" | "ambience" | "study_friendly" | "service_speed" | "value";
export interface ScoreAspectsResult {
  aspects: Record<AspectKey, { score: number | null; nMentions: number; evidence: string[] }>;
  basedOnReviews: number;
}

export interface GeofenceInput {
  chain: string; shopName: string; itemName: string;
  priceCents: number; walkMinutes: number; hook?: string;
}