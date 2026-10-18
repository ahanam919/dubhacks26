import { describe, expect, it } from "vitest";
import { CHAIN_LOCATIONS } from "./chainLocations";
import { distanceMeters, findLocalShops, findNearbyChain, isValidPoint } from "./distance";
import { LOCAL_SHOPS } from "./localShops";

// Middle of the demo area (UW campus, between the Ave and U Village).
const DEMO_CENTER = { lat: 47.6595, lng: -122.3045 };

describe("chain seed data", () => {
  it("has valid coordinates", () => {
    for (const c of CHAIN_LOCATIONS) expect(isValidPoint(c)).toBe(true);
  });

  it("has unique ids", () => {
    const ids = CHAIN_LOCATIONS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("stays inside the demo area (within 1.2 km of campus)", () => {
    for (const c of CHAIN_LOCATIONS) {
      expect(distanceMeters(DEMO_CENTER, c)).toBeLessThan(1200);
    }
  });

  it("the map's starting pin is not near any chain", () => {
    expect(findNearbyChain(DEMO_CENTER, CHAIN_LOCATIONS)).toBeNull();
  });

  it("standing at a seeded Starbucks matches it", () => {
    for (const c of CHAIN_LOCATIONS) {
      expect(findNearbyChain(c, CHAIN_LOCATIONS)?.chain.id).toBe(c.id);
    }
  });
});

describe("local shop seed data", () => {
  it("has valid coordinates and unique ids", () => {
    for (const s of LOCAL_SHOPS) expect(isValidPoint(s)).toBe(true);
    const ids = LOCAL_SHOPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // The demo breaks if someone stands at a Starbucks and there's nothing to suggest.
  it("every Starbucks has at least one local shop within walking distance", () => {
    for (const c of CHAIN_LOCATIONS) {
      expect(findLocalShops(c, LOCAL_SHOPS).length).toBeGreaterThan(0);
    }
  });
});