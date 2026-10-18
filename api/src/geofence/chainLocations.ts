// Seed data: chain locations in the demo area (the Ave -> UW campus -> U Village).
// Coordinates copied by hand from Google Maps, Oct 2026.
// TODO before the demo: confirm each pin lands on its store in Google Maps.

import type { ChainLocation } from "./distance";

export const CHAIN_LOCATIONS: ChainLocation[] = [
  {
    id: "sbux-15th-40th",
    chainName: "Starbucks",
    // Address as copied: 3980 15th Ave NE. Closest chain to the Ave.
    lat: 47.65466998756357,
    lng: -122.31173930735872,
  },
  {
    id: "sbux-campus-4000-15th",
    chainName: "Starbucks",
    // Address as copied: 4000 15th Ave NE (pin is on campus, east of 15th).
    lat: 47.65569017951035,
    lng: -122.30854416151266,
  },
  {
    id: "sbux-uvillage-a",
    chainName: "Starbucks",
    // Near U Village. Address to confirm (was mislabeled 3980 15th Ave NE).
    lat: 47.66276976593066,
    lng: -122.29672583754325,
  },
  {
    id: "sbux-ne-49th",
    chainName: "Starbucks",
    // Address as copied: 2650 NE 49th St.
    lat: 47.66461651938478,
    lng: -122.2989934925125,
  },
  // Left out: 4800 Sand Point Way NE is ~1.3 km past U Village, outside the demo area.
];
