export type PriceSource = "menu_page" | "ordering_page" | "team_entered";
export type AspectKey = "taste" | "ambience" | "study_friendly" | "service_speed" | "value";

export interface ConceptDef { id: string; name: string; aliases?: string[] }

export interface ExtractMenuInput { shopName: string; text?: string; imageUrls?: string[] }
export interface MenuItemDraft {
  name: string; description?: string; priceCents: number | null; priceSource?: PriceSource;
  size?: string; category?: string; confidence?: "high" | "medium" | "low";
}
export interface ExtractMenuResult {
  items: MenuItemDraft[]; milkOptions?: string[]; extras?: string[]; notes?: string; error?: string;
}

export interface MatchItem { name: string; description?: string; category?: string }
export interface MatchConceptResult {
  conceptId: string | null; confidence: number; attributes: Record<string, unknown>; error?: string;
}

export interface WriteHookInput { shopName: string; sourceText: string; sourceUrl: string }
export interface WriteHookResult { hook: string | null; sourceUrl: string; error?: string }
export interface VerifyHookInput { hook: string; sourceText: string }
export interface VerifyHookResult {
  supported: boolean; unsupportedClaims: string[];
  evidence?: string[]; blockedBy?: string; error?: string;
}
export interface MakeHookResult {
  hook: string | null; sourceUrl: string; verified: boolean; unsupportedClaims: string[];
  rejectedHook?: string; error?: string;
}

export interface ParseQueryResult {
    itemConcept: string | null; chainAnchor?: string; dietary: string[]; size?: string;
    needsClarification?: boolean; clarifyingQuestion?: string; error?: string;
}
export interface ParseQueryOptions { timeoutMs?: number }

export interface ScoreAspectsResult {
  aspects: Record<AspectKey, { score: number | null; nMentions: number; evidence: string[] }>;
  count: number; asOf: string;
}
export interface ScoreAspectsOptions { includeEvidence?: boolean }   // default false

export interface GeofenceInput {
  chain: string; shopName: string; itemName: string;
  priceCents: number | null; hook: string | null;
}
export interface GeofenceResult { message: string }   // contains the literal {minutes}

export interface ComparePriceInput {
  chain: string;
  local: { name: string; priceCents: number | null; size?: string };
  chainRef: { id: string; priceCents: number | null; size?: string; asOf: string };
}
// null result = not comparable (a price is missing or the sizes don't match)
export interface ComparePriceResult {
  chainReferenceId: string;
  sizeMatch: "same" | "close";
  priceDiffCents: number;
  verdict: "cheaper" | "similar" | "pricier";
  sentence: string;
}

export interface PhotoCandidate { id: string; url: string; source: "website" | "places"; authorName?: string }
export interface SelectPhotosInput { shopName: string; candidates: PhotoCandidate[]; max?: number }
export interface SelectedPhoto {
  id: string; url: string; source: "website" | "places";
  kind: "food" | "drink" | "interior" | "exterior" | "other"; authorName?: string;
}
export interface SelectPhotosResult { photos: SelectedPhoto[]; error?: string }