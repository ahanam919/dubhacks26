// The decision behind POST /geofence/check, kept free of Fastify and the database
// so it can be tested on its own. routes.ts supplies the data and the lookups.

import {
  type ChainLocation,
  type Shop,
  findLocalShops,
  findNearbyChain,
  isAccurateEnough,
  isValidPoint,
} from "./distance";

export type NoMatchReason =
  | "bad_request" // missing or invalid lat/lng
  | "inaccurate" // GPS reading too vague to trust
  | "no_chain" // not within 100 m of a chain
  | "no_shop" // near a chain, but no local shop within walking distance
  | "cooldown" // this device was already told about this chain recently
  | "quiet_hours"; // too late or too early to send anything

export type CheckResponse =
  | { match: false; reason: NoMatchReason }
  | {
      match: true;
      chain: { id: string; name: string };
      shop: { id: string; name: string; lat: number; lng: number; walkMinutes: number; priceCents: null };
      message: string;
    };

export interface CheckInput {
  deviceId?: unknown;
  lat?: unknown;
  lng?: unknown;
  accuracy?: unknown;
  /** True for the drag-the-pin screen: skips the cooldown and quiet hours so demos can repeat. */
  simulated?: unknown;
}

export interface CheckDeps {
  chains: ChainLocation[];
  shops: Shop[];
  now: Date;
  cooldownMinutes: number;
  /** Local hours when nothing is sent, e.g. { start: 21, end: 7 }. null = never quiet. */
  quietHours: { start: number; end: number } | null;
  timeZone: string;
  lastNotifiedAt(deviceId: string, chainId: string): Promise<Date | null>;
  recordNotification(deviceId: string, chainId: string): Promise<void>;
  /** The pre-written, verified message for this shop near this chain, if there is one. */
  messageFor(shopId: string, chainName: string): Promise<string | null>;
}

export function localHour(now: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone }).format(now);
  return Number(hour);
}

export function isQuietHour(hour: number, quiet: { start: number; end: number } | null): boolean {
  if (!quiet) return false;
  // A window like 21-7 wraps past midnight.
  return quiet.start <= quiet.end
    ? hour >= quiet.start && hour < quiet.end
    : hour >= quiet.start || hour < quiet.end;
}

/** Parses "21-7" into { start: 21, end: 7 }. Anything else means no quiet hours. */
export function parseQuietHours(raw: string | undefined): { start: number; end: number } | null {
  const m = raw?.trim().match(/^(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  const start = Number(m[1]);
  const end = Number(m[2]);
  if (start > 23 || end > 23 || start === end) return null;
  return { start, end };
}

export async function decideCheck(input: CheckInput, deps: CheckDeps): Promise<CheckResponse> {
  const spot = { lat: input.lat, lng: input.lng };
  if (!isValidPoint(spot)) return { match: false, reason: "bad_request" };

  const accuracy = typeof input.accuracy === "number" ? input.accuracy : undefined;
  if (!isAccurateEnough(accuracy)) return { match: false, reason: "inaccurate" };

  const near = findNearbyChain(spot, deps.chains);
  if (!near) return { match: false, reason: "no_chain" };
  const chain = near.chain;

  const simulated = input.simulated === true;
  const deviceId = typeof input.deviceId === "string" && input.deviceId ? input.deviceId : "unknown-device";

  if (!simulated) {
    if (isQuietHour(localHour(deps.now, deps.timeZone), deps.quietHours)) {
      return { match: false, reason: "quiet_hours" };
    }
    const last = await deps.lastNotifiedAt(deviceId, chain.id);
    if (last && deps.now.getTime() - last.getTime() < deps.cooldownMinutes * 60_000) {
      return { match: false, reason: "cooldown" };
    }
  }

  // Nearest first. TODO: swap in the backend's ranking (prefer shops that sell
  // the drink being swapped) once it exists.
  const [best] = findLocalShops(spot, deps.shops);
  if (!best) return { match: false, reason: "no_shop" };

  const template = await deps.messageFor(best.shop.id, chain.chainName);
  const message = template
    ? template.replaceAll("{minutes}", String(best.walkMinutes))
    : `${best.shop.name} is ${best.walkMinutes} min away. Tap for directions.`;

  if (!simulated) await deps.recordNotification(deviceId, chain.id);

  return {
    match: true,
    chain: { id: chain.id, name: chain.chainName },
    shop: {
      id: best.shop.id,
      name: best.shop.name,
      lat: best.shop.lat,
      lng: best.shop.lng,
      walkMinutes: best.walkMinutes,
      priceCents: null,
    },
    message,
  };
}
