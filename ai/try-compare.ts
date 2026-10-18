import { comparePrice } from "./compare-price";
const ref = { id: "sbux-psl", priceCents: 645, size: "grande 16oz", asOf: "2026-10-17" };
const cases: [string, any, any?][] = [
  ["cheaper same", { chain: "Starbucks", local: { name: "PSL", priceCents: 560, size: "16 oz" }, chainRef: ref }],
  ["similar", { chain: "Starbucks", local: { name: "PSL", priceCents: 650, size: "16oz" }, chainRef: ref }],
  ["pricier close", { chain: "Starbucks", local: { name: "PSL", priceCents: 725, size: "14 oz" }, chainRef: ref }],
  ["size mismatch -> null", { chain: "Starbucks", local: { name: "PSL", priceCents: 560, size: "12 oz" }, chainRef: ref }],
  ["no local price -> null", { chain: "Starbucks", local: { name: "PSL", priceCents: null, size: "16 oz" }, chainRef: ref }],
  ["no local size -> null", { chain: "Starbucks", local: { name: "PSL", priceCents: 560 }, chainRef: ref }],
  ["no local size + allow", { chain: "Starbucks", local: { name: "PSL", priceCents: 560 }, chainRef: ref }, { allowUnknownLocalSize: true }],
];
for (const [n, i, o] of cases) console.log(n, "=>", JSON.stringify(comparePrice(i, o)));