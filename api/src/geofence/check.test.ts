import { describe, expect, it } from "vitest";
import { CHAIN_LOCATIONS } from "./chainLocations";
import { type CheckDeps, decideCheck, isQuietHour, localHour, parseQuietHours } from "./check";
import { LOCAL_SHOPS } from "./localShops";

const AT_15TH_STARBUCKS = { lat: 47.65466998756357, lng: -122.31173930735872 };
const MIDDLE_OF_CAMPUS = { lat: 47.6595, lng: -122.3045 };
// 2pm in Seattle (21:00 UTC during daylight time).
const AFTERNOON = new Date("2026-10-17T21:00:00Z");

function deps(overrides: Partial<CheckDeps> = {}) {
  const sent: string[] = [];
  const d: CheckDeps = {
    chains: CHAIN_LOCATIONS,
    shops: LOCAL_SHOPS,
    now: AFTERNOON,
    cooldownMinutes: 180,
    quietHours: null,
    timeZone: "America/Los_Angeles",
    lastNotifiedAt: async () => null,
    recordNotification: async (deviceId, chainId) => {
      sent.push(`${deviceId}|${chainId}`);
    },
    messageFor: async () => null,
    ...overrides,
  };
  return { d, sent };
}

describe("decideCheck", () => {
  it("suggests a local shop at a Starbucks", async () => {
    const { d, sent } = deps();
    const r = await decideCheck({ deviceId: "phone-1", ...AT_15TH_STARBUCKS, accuracy: 10 }, d);
    expect(r.match).toBe(true);
    if (!r.match) return;
    expect(r.chain.id).toBe("sbux-15th-40th");
    expect(r.shop.id).toBe("cafe-allegro"); // nearest local shop
    expect(r.message).toContain("Cafe Allegro");
    expect(sent).toEqual(["phone-1|sbux-15th-40th"]); // cooldown recorded
  });

  it("uses the stored message and fills in the minutes", async () => {
    const { d } = deps({ messageFor: async () => "Near Starbucks? Allegro is {minutes} min away." });
    const r = await decideCheck({ ...AT_15TH_STARBUCKS }, d);
    expect(r.match && r.message).toBe("Near Starbucks? Allegro is 7 min away.");
  });

  it("returns no_chain away from every chain", async () => {
    const r = await decideCheck({ ...MIDDLE_OF_CAMPUS }, deps().d);
    expect(r).toEqual({ match: false, reason: "no_chain" });
  });

  it("rejects bad input and vague GPS", async () => {
    expect(await decideCheck({ lat: "x", lng: 1 }, deps().d)).toEqual({ match: false, reason: "bad_request" });
    expect(await decideCheck({ ...AT_15TH_STARBUCKS, accuracy: 400 }, deps().d)).toEqual({
      match: false,
      reason: "inaccurate",
    });
  });

  it("respects the cooldown for real geofence events", async () => {
    const tenMinAgo = new Date(AFTERNOON.getTime() - 10 * 60_000);
    const { d, sent } = deps({ lastNotifiedAt: async () => tenMinAgo });
    expect(await decideCheck({ deviceId: "phone-1", ...AT_15TH_STARBUCKS }, d)).toEqual({
      match: false,
      reason: "cooldown",
    });
    expect(sent).toEqual([]);
  });

  it("lets the drag-the-pin demo repeat (simulated skips cooldown and quiet hours)", async () => {
    const tenMinAgo = new Date(AFTERNOON.getTime() - 10 * 60_000);
    const { d, sent } = deps({ lastNotifiedAt: async () => tenMinAgo, quietHours: { start: 0, end: 23 } });
    const r = await decideCheck({ deviceId: "demo", ...AT_15TH_STARBUCKS, simulated: true }, d);
    expect(r.match).toBe(true);
    expect(sent).toEqual([]); // simulated checks don't count toward the cooldown
  });

  it("stays quiet during quiet hours", async () => {
    const { d } = deps({ quietHours: { start: 13, end: 15 } }); // 2pm falls inside
    expect(await decideCheck({ ...AT_15TH_STARBUCKS }, d)).toEqual({ match: false, reason: "quiet_hours" });
  });

  it("returns no_shop when nothing local is within walking distance", async () => {
    const { d } = deps({ shops: [] });
    expect(await decideCheck({ ...AT_15TH_STARBUCKS }, d)).toEqual({ match: false, reason: "no_shop" });
  });
});

describe("quiet hours helpers", () => {
  it("parses windows and rejects nonsense", () => {
    expect(parseQuietHours("21-7")).toEqual({ start: 21, end: 7 });
    expect(parseQuietHours(undefined)).toBeNull();
    expect(parseQuietHours("late")).toBeNull();
    expect(parseQuietHours("25-3")).toBeNull();
  });

  it("handles windows that wrap past midnight", () => {
    const q = { start: 21, end: 7 };
    expect(isQuietHour(23, q)).toBe(true);
    expect(isQuietHour(3, q)).toBe(true);
    expect(isQuietHour(7, q)).toBe(false);
    expect(isQuietHour(14, q)).toBe(false);
  });

  it("reads the Seattle hour", () => {
    expect(localHour(AFTERNOON, "America/Los_Angeles")).toBe(14);
  });
});
