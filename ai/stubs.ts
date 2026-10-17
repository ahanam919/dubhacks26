import type * as T from "./types";

export const extractMenu = async (_i: T.ExtractMenuInput): Promise<T.ExtractMenuResult> => ({
  items: [
    { name: "Pumpkin Spice Latte", priceCents: 575, size: "12 oz", confidence: "high" },
    { name: "Chai Latte", priceCents: 525, size: "12 oz", confidence: "high" },
  ],
});
export const matchConcept = async (item: { name: string }, _c: T.ConceptDef[]): Promise<T.MatchConceptResult> => ({
  conceptId: item.name.toLowerCase().includes("pumpkin") ? "pumpkin_spice_latte" : null,
  confidence: 0.9, attributes: {},
});
export const writeHook = async (i: T.WriteHookInput): Promise<T.WriteHookResult> => ({
  hook: `${i.shopName} makes its syrup in house.`, sourceUrl: i.sourceUrl,
});
export const verifyHook = async (_i: { hook: string; sourceText: string }): Promise<T.VerifyHookResult> => ({
  supported: true, unsupportedClaims: [],
});
export const parseQuery = async (_t: string): Promise<T.ParseQueryResult> => ({
  itemConcept: "pumpkin_spice_latte", chainAnchor: "Starbucks", dietary: [],
});
export const comparePrice = async (_i: T.ComparePriceInput): Promise<T.ComparePriceResult> => ({
  sizeMatch: "same", priceDiffCents: 60, verdict: "pricier",
  sentence: "$0.60 more than Starbucks, comparable size",
});
export const scoreAspects = async (_i: { shopName: string; reviews: string[] }): Promise<T.ScoreAspectsResult> => ({
  aspects: {
    taste: { score: 4.5, nMentions: 4, evidence: [] },
    ambience: { score: 4, nMentions: 3, evidence: [] },
    study_friendly: { score: null, nMentions: 0, evidence: [] },
    service_speed: { score: null, nMentions: 0, evidence: [] },
    value: { score: null, nMentions: 0, evidence: [] },
  },
  basedOnReviews: 5,
});
export const writeGeofenceMessage = async (i: T.GeofenceInput): Promise<{ message: string }> => ({
  message: `Near ${i.chain}? ${i.shopName} is ${i.walkMinutes} min away, ${i.itemName} $${(i.priceCents / 100).toFixed(2)}.`,
});