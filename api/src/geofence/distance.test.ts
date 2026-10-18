import { describe, expect, it } from "vitest";
import { computeDestinationPoint } from "geolib";
import {
  type ChainLocation,
  type Point,
  type Shop,
  distanceMeters,
  findLocalShops,
  findNearbyChain,
  isAccurateEnough,
  isValidPoint,
  nearestChains,
  walkMinutes,
} from "./distance";

// Example base point (roughly UW's U District, Seattle). The tests don't depend on
// real shop locations: every other point is generated at an exact distance from here.
const BASE: Point = { lat: 47.6588, lng: -122.313 };

/** A point `meters` away from `from` in direction `bearing` (0 = north, 90 = east). */
function offset(from: Point, meters: number, bearing = 0): Point {
  const p = computeDestinationPoint({ latitude: from.lat, longitude: from.lng }, meters, bearing);
  return { lat: p.latitude, lng: p.longitude };
}

const starbucks: ChainLocation = { id: "c1", chainName: "Starbucks", ...BASE };
const farStarbucks: ChainLocation = { id: "c2", chainName: "Starbucks", ...offset(BASE, 2000, 90) };
const chains = [starbucks, farStarbucks];

describe("distanceMeters", () => {
  it("is ~0 for the same point", () => {
    expect(distanceMeters(BASE, BASE)).toBeCloseTo(0, 0);
  });

  it("matches a known offset to within 1 m", () => {
    expect(Math.abs(distanceMeters(BASE, offset(BASE, 300)) - 300)).toBeLessThan(1);
  });
});

describe("findNearbyChain", () => {
  it("matches at the chain's door", () => {
    expect(findNearbyChain(BASE, chains)?.chain.id).toBe("c1");
  });

  it("matches 60 m away", () => {
    const match = findNearbyChain(offset(BASE, 60, 45), chains);
    expect(match?.chain.id).toBe("c1");
    expect(match!.distanceMeters).toBeGreaterThan(55);
    expect(match!.distanceMeters).toBeLessThan(65);
  });

  it("matches just inside the 100 m radius", () => {
    expect(findNearbyChain(offset(BASE, 95), chains)).not.toBeNull();
  });

  it("does not match just outside the 100 m radius", () => {
    expect(findNearbyChain(offset(BASE, 105), chains)).toBeNull();
  });

  it("does not match 300 m away", () => {
    expect(findNearbyChain(offset(BASE, 300), chains)).toBeNull();
  });

  it("picks the closer chain when two are in range", () => {
    const nearby: ChainLocation = { id: "c3", chainName: "Peet's", ...offset(BASE, 80) };
    const user = offset(BASE, 70); // 70 m from c1, 10 m from c3
    expect(findNearbyChain(user, [starbucks, nearby])?.chain.id).toBe("c3");
  });

  it("returns null for an empty chain list", () => {
    expect(findNearbyChain(BASE, [])).toBeNull();
  });
});

describe("findLocalShops", () => {
  const close: Shop = { id: "s1", name: "Bluebird", ...offset(BASE, 380, 180) };
  const closer: Shop = { id: "s2", name: "Corner Cafe", ...offset(BASE, 150, 270) };
  const tooFar: Shop = { id: "s3", name: "Far Roasters", ...offset(BASE, 1200) };

  it("keeps shops within 800 m, nearest first", () => {
    const result = findLocalShops(BASE, [close, tooFar, closer]);
    expect(result.map((s) => s.shop.id)).toEqual(["s2", "s1"]);
  });

  it("reports walking minutes (380 m ≈ 5 min)", () => {
    const [shop] = findLocalShops(BASE, [close]);
    expect(shop.walkMinutes).toBe(5);
  });

  it("returns an empty list when nothing is nearby", () => {
    expect(findLocalShops(BASE, [tooFar])).toEqual([]);
  });
});

describe("walkMinutes", () => {
  it("never returns less than 1", () => {
    expect(walkMinutes(0)).toBe(1);
    expect(walkMinutes(10)).toBe(1);
  });

  it("rounds up", () => {
    expect(walkMinutes(81)).toBe(2);
  });
});

describe("nearestChains", () => {
  it("returns the closest N, nearest first", () => {
    const many: ChainLocation[] = Array.from({ length: 30 }, (_, i) => ({
      id: `c${i}`,
      chainName: "Starbucks",
      ...offset(BASE, (30 - i) * 100),
    }));
    const result = nearestChains(BASE, many, 20);
    expect(result).toHaveLength(20);
    expect(result[0].chain.id).toBe("c29"); // 100 m away
    expect(result[0].distanceMeters).toBeLessThan(result[19].distanceMeters);
  });
});

describe("isAccurateEnough", () => {
  it("accepts precise readings and missing accuracy", () => {
    expect(isAccurateEnough(10)).toBe(true);
    expect(isAccurateEnough(100)).toBe(true);
    expect(isAccurateEnough(undefined)).toBe(true);
    expect(isAccurateEnough(null)).toBe(true);
  });

  it("rejects vague or invalid readings", () => {
    expect(isAccurateEnough(250)).toBe(false);
    expect(isAccurateEnough(-1)).toBe(false);
    expect(isAccurateEnough(Number.NaN)).toBe(false);
  });
});

describe("isValidPoint", () => {
  it("accepts real coordinates", () => {
    expect(isValidPoint(BASE)).toBe(true);
  });

  it("rejects bad request bodies", () => {
    expect(isValidPoint(null)).toBe(false);
    expect(isValidPoint({ lat: "47.6", lng: -122.3 })).toBe(false);
    expect(isValidPoint({ lat: 91, lng: 0 })).toBe(false);
    expect(isValidPoint({ lat: 0, lng: 181 })).toBe(false);
    expect(isValidPoint({ lat: Number.NaN, lng: 0 })).toBe(false);
  });
});