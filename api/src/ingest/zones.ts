import type { Rect } from "./places";

// ---------------------------------------------------------------------------------------------
// Everything you tune about discovery lives in this file. To add an area, add one entry to ZONES.
//
//   rect  the search box (low = south-west corner, high = north-east corner)
//   deep  true  = read menu PHOTOS as well as the website (team photos, images on the shop's site,
//                 and Maps photos if maps=true). Costs more Gemini calls. Use for demo areas.
//         false = website text only. A shop with no readable menu is still stored (it shows on the
//                 map) but gets no menu items.
//   maps  true  = (deep zones only) also read Google Maps photos for menus when nothing else gave enough items.
//                 Costs the most Gemini calls, so keep it on only for the demo block.
//   max   most shops one discover_area job will queue (protects Places and Gemini quota)
//
// Run a zone:  INSERT INTO job (type, payload) VALUES ('discover_area', '{"area":"ave_block"}');
// Overrides in the payload: "deep", "maps", "max", "force" (re-ingest shops already done), or a "rect".
// ---------------------------------------------------------------------------------------------
export type Zone = { rect: Rect; deep: boolean; maps: boolean; max: number };

export const ZONES: Record<string, Zone> = {
  // The Ave (University Way NE) from NE 42nd to NE 47th. Approximate box: check it against a map.
  ave_block: {
    rect: { low: { latitude: 47.6583, longitude: -122.315 }, high: { latitude: 47.664, longitude: -122.3115 } },
    deep: true,
    maps: true,
    max: 40,
  },
  // University Village shopping center.
  uvillage: {
    rect: { low: { latitude: 47.66, longitude: -122.304 }, high: { latitude: 47.666, longitude: -122.294 } },
    deep: true,
    maps: false,
    max: 40,
  },
  // The wider U District. Shops here appear on the map; menus only if the website has them.
  udistrict: {
    rect: { low: { latitude: 47.6535, longitude: -122.3205 }, high: { latitude: 47.668, longitude: -122.3065 } },
    deep: false,
    maps: false,
    max: 60,
  },
};

// A shop counts as "enough" once it has this many menu items. Used to stop reading more pages,
// to decide when to try photos, and to decide which deep-zone shops still need a re-run.
export const ENOUGH_ITEMS = 5;

// Places searches run for every zone.
export const QUERIES = ["coffee shop", "cafe", "espresso bar", "bubble tea", "tea house"];

// A place is kept only if its MAIN type is one of these (its list of other tags is ignored).
export const OK_TYPES = new Set(["cafe", "coffee_shop", "tea_house", "coffee_roastery", "bubble_tea_store"]);

// Chains are what we compare AGAINST, so they never become "local" shops.
export const CHAIN_RE = /starbucks|dunkin|peet'?s|tully'?s|seattle'?s best|caribou|dutch bros|coffee bean|tim hortons|blue bottle|7-eleven|mcdonald|subway|panera|jamba|kung fu tea|gong cha|sharetea|tiger sugar|happy ?lemon/i;