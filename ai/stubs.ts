import type * as T from "./types";

export const extractMenu = async (_i: T.ExtractMenuInput): Promise<T.ExtractMenuResult> => ({
  items: [
    { name: "Pumpkin Spice Latte", description: "house syrup", priceCents: 575, priceSource: "menu_page", size: "12 oz", category: "SPECIALTIES", confidence: "high" },
    { name: "Chai Latte", priceCents: null, category: "NON ESPRESSO", confidence: "high" },
  ],
  milkOptions: ["oat", "soy", "almond"],
  extras: ["Add Shot"],
});

export const matchConcepts = async (items: T.MatchItem[], _c: T.ConceptDef[]): Promise<T.MatchConceptResult[]> =>
  items.map((it) => ({
    conceptId: it.name.toLowerCase().includes("pumpkin") ? "pumpkin_spice_latte"
      : it.name.toLowerCase().includes("chai") ? "chai_latte" : null,
    confidence: 0.9,
    attributes: {},
  }));

export const matchConcept = async (item: T.MatchItem, c: T.ConceptDef[]) =>
  (await matchConcepts([item], c))[0];

export const embedText = async (_t: string): Promise<number[]> => new Array(768).fill(0);

export const writeHook = async (i: T.WriteHookInput): Promise<T.WriteHookResult> => ({
  hook: `${i.shopName} makes its syrups in house.`, sourceUrl: i.sourceUrl,
});

export const verifyHook = async (_i: T.VerifyHookInput): Promise<T.VerifyHookResult> => ({
  supported: true, unsupportedClaims: [],
});

export const makeHook = async (i: T.WriteHookInput): Promise<T.MakeHookResult> => ({
  hook: `${i.shopName} makes its syrups in house.`, sourceUrl: i.sourceUrl,
  verified: true, unsupportedClaims: [],
});

export const parseQuery = async (
  _t: string, _c?: T.ConceptDef[], _o?: T.ParseQueryOptions
): Promise<T.ParseQueryResult> => ({
  itemConcept: "pumpkin_spice_latte", chainAnchor: "Starbucks", dietary: [],
});

export const scoreAspects = async (
  _r: string[], _o?: T.ScoreAspectsOptions
): Promise<T.ScoreAspectsResult> => ({
  aspects: {
    taste: { score: 4.5, nMentions: 4, evidence: [] },
    ambience: { score: 4, nMentions: 3, evidence: [] },
    study_friendly: { score: null, nMentions: 0, evidence: [] },
    service_speed: { score: null, nMentions: 0, evidence: [] },
    value: { score: null, nMentions: 0, evidence: [] },
  },
  count: 5,
  asOf: new Date().toISOString().slice(0, 10),
});

export const writeGeofenceMessage = async (i: T.GeofenceInput): Promise<T.GeofenceResult> => ({
  message: `Near ${i.chain}? ${i.shopName} is {minutes} min away${
    i.priceCents == null ? "" : `, ${i.itemName} $${(i.priceCents / 100).toFixed(2)}`
  }.`,
});

export const comparePrice = async (i: T.ComparePriceInput): Promise<T.ComparePriceResult | null> =>
  i.local.priceCents == null || i.chainRef.priceCents == null
    ? null
    : {
        chainReferenceId: i.chainRef.id,
        sizeMatch: "same",
        priceDiffCents: i.local.priceCents - i.chainRef.priceCents,
        verdict: i.local.priceCents > i.chainRef.priceCents ? "pricier" : "cheaper",
        sentence: "Compared with the chain's approximate price, comparable size",
      };

export const selectPhotos = async (i: T.SelectPhotosInput): Promise<T.SelectPhotosResult> => ({
  photos: i.candidates.slice(0, i.max ?? 5).map((c) => ({
    id: c.id, url: c.url, source: c.source, kind: "drink" as const, authorName: c.authorName,
  })),
});