// Geofence distance logic for Local Swap.
// Pure functions only: no database, no network, no Expo. That makes them easy to test
// and lets the /geofence/check and /geofence/regions routes stay thin.

import { getDistance } from "geolib";

export interface Point {
  lat: number;
  lng: number;
}

export interface ChainLocation extends Point {
  id: string;
  chainName: string; // e.g. "Starbucks"
}

export interface Shop extends Point {
  id: string;
  name: string;
}

export interface ChainMatch {
  chain: ChainLocation;
  distanceMeters: number;
}

export interface NearbyShop {
  shop: Shop;
  distanceMeters: number;
  walkMinutes: number;
}

/**
 * How close (meters) the user must be to a chain to count as "near" it.
 * 200 m is about a block and a half: big enough to catch someone walking toward the
 * door, small enough that the start pin on campus is not "near" anything.
 * Keep in sync with CHAIN_RADIUS_M in mobile/src/components/GeofenceMap.tsx.
 */
export const CHAIN_RADIUS_M = 200;
/** How far (meters) we'll suggest walking to a local shop (~10 min). */
export const WALK_RADIUS_M = 800;
/** Normal walking pace. */
export const WALK_SPEED_M_PER_MIN = 80;
/** Readings vaguer than this are ignored (indoor/cell-tower fixes). */
export const MAX_ACCURACY_M = 100;
/** iOS caps monitored regions at 20; Android at 100. 20 is safe for both. */
export const DEFAULT_REGION_LIMIT = 20;

/** True if lat/lng are real numbers in range. Use this to reject bad request bodies. */
export function isValidPoint(p: unknown): p is Point {
  if (typeof p !== "object" || p === null) return false;
  const { lat, lng } = p as Record<string, unknown>;
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * True if a location reading is precise enough to act on.
 * A missing accuracy is allowed, because some code paths (e.g. a geofence event
 * followed by getLastKnownPositionAsync) may not report one. Only a reported
 * accuracy worse than the limit is rejected.
 */
export function isAccurateEnough(
  accuracyMeters: number | null | undefined,
  maxAccuracy = MAX_ACCURACY_M,
): boolean {
  if (accuracyMeters === null || accuracyMeters === undefined) return true;
  return Number.isFinite(accuracyMeters) && accuracyMeters >= 0 && accuracyMeters <= maxAccuracy;
}

/** Straight-line distance in meters between two points. */
export function distanceMeters(a: Point, b: Point): number {
  return getDistance(
    { latitude: a.lat, longitude: a.lng },
    { latitude: b.lat, longitude: b.lng },
    0.1,
  );
}

/** Walking time in whole minutes, never less than 1. */
export function walkMinutes(meters: number): number {
  return Math.max(1, Math.ceil(meters / WALK_SPEED_M_PER_MIN));
}

/** The closest chain within `radius`, or null if none is close enough. */
export function findNearbyChain(
  user: Point,
  chains: ChainLocation[],
  radius = CHAIN_RADIUS_M,
): ChainMatch | null {
  let best: ChainMatch | null = null;
  for (const chain of chains) {
    const d = distanceMeters(user, chain);
    if (d <= radius && (best === null || d < best.distanceMeters)) {
      best = { chain, distanceMeters: d };
    }
  }
  return best;
}

/**
 * Local shops within walking distance, nearest first.
 * This is the candidate list; the backend's ranking function decides the final pick.
 */
export function findLocalShops(
  user: Point,
  shops: Shop[],
  radius = WALK_RADIUS_M,
): NearbyShop[] {
  return shops
    .map((shop) => {
      const d = distanceMeters(user, shop);
      return { shop, distanceMeters: d, walkMinutes: walkMinutes(d) };
    })
    .filter((s) => s.distanceMeters <= radius)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

/** The `limit` nearest chain locations, for the app to register as geofences (/geofence/regions). */
export function nearestChains(
  user: Point,
  chains: ChainLocation[],
  limit = DEFAULT_REGION_LIMIT,
): ChainMatch[] {
  return chains
    .map((chain) => ({ chain, distanceMeters: distanceMeters(user, chain) }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, limit);
}