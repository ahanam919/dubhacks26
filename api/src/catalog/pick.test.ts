import { describe, expect, it } from "vitest";
import { matchConcept, pickItem } from "./pick";

const concepts = [
  { id: "pumpkin_spice_latte", name: "Pumpkin spice latte", aliases: ["psl", "pumpkin latte", "pumpkin spice"] },
  { id: "latte", name: "Latte", aliases: ["caffe latte"] },
  { id: "matcha_latte", name: "Matcha latte", aliases: ["matcha"] },
];

describe("matchConcept", () => {
  it("matches a name exactly, ignoring case", () => expect(matchConcept("LATTE", concepts)?.id).toBe("latte"));
  it("matches an alias", () => expect(matchConcept("psl", concepts)?.id).toBe("pumpkin_spice_latte"));
  it("prefers the longest term inside the query", () => {
    expect(matchConcept("iced pumpkin spice latte please", concepts)?.id).toBe("pumpkin_spice_latte");
    expect(matchConcept("cheap matcha near me", concepts)?.id).toBe("matcha_latte");
  });
  it("does not match part of a word", () => expect(matchConcept("lattes", concepts)).toBeNull());
  it("returns null for unrelated or empty queries", () => {
    expect(matchConcept("bagel", concepts)).toBeNull();
    expect(matchConcept("  ", concepts)).toBeNull();
  });
});

describe("pickItem", () => {
  const items = [
    { id: "a", price_cents: 600, concept_id: "latte" },
    { id: "b", price_cents: null, concept_id: "latte" },
    { id: "c", price_cents: 450, concept_id: "latte" },
    { id: "d", price_cents: 300, concept_id: "matcha_latte" },
  ];
  it("picks the cheapest item for the concept", () => expect(pickItem(items, "latte")?.id).toBe("c"));
  it("falls back to any item when none match the concept", () => expect(pickItem(items, "psl")?.id).toBe("d"));
  it("puts unpriced items last", () => expect(pickItem([items[1], items[0]], "latte")?.id).toBe("a"));
  it("returns null when the shop has no items", () => expect(pickItem([], "latte")).toBeNull());
});
