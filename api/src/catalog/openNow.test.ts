import { describe, expect, it } from "vitest";
import { isOpenNow, seattleClock } from "./openNow";

// 2026-10-14 is a Wednesday. 17:00 UTC = 10:00 in Seattle (PDT, UTC-7).
const WED_10AM = new Date("2026-10-14T17:00:00Z");
const WED_11PM = new Date("2026-10-15T06:00:00Z");
const SUN_1AM = new Date("2026-10-18T08:00:00Z");

const google = (periods: unknown[]) => ({ periods, weekdayDescriptions: [] });
const daily = (openH: number, closeH: number) =>
  google([0, 1, 2, 3, 4, 5, 6].map((d) => ({ open: { day: d, hour: openH, minute: 0 }, close: { day: d, hour: closeH, minute: 0 } })));

describe("seattleClock", () => {
  it("reads Seattle day and time", () => {
    expect(seattleClock(WED_10AM)).toEqual({ day: 3, minutes: 600 });
  });
});

describe("isOpenNow with Google hours", () => {
  it("open inside a period", () => expect(isOpenNow(daily(7, 18), WED_10AM)).toBe(true));
  it("closed outside every period", () => expect(isOpenNow(daily(7, 18), WED_11PM)).toBe(false));
  it("handles a period past midnight", () => {
    const late = google([{ open: { day: 6, hour: 20, minute: 0 }, close: { day: 0, hour: 2, minute: 0 } }]);
    expect(isOpenNow(late, SUN_1AM)).toBe(true);
  });
  it("a period with no close means 24 hours", () => {
    expect(isOpenNow(google([{ open: { day: 0, hour: 0, minute: 0 } }]), WED_11PM)).toBe(true);
  });
});

describe("isOpenNow with simple hours", () => {
  it("the demo shop's all-day hours are open", () => {
    expect(isOpenNow({ wed: "00:00-23:59" }, WED_10AM)).toBe(true);
  });
  it("closed on a day that is missing", () => {
    expect(isOpenNow({ mon: "07:00-18:00" }, WED_10AM)).toBe(false);
  });
});

describe("isOpenNow with unknown hours", () => {
  it("treats missing hours as open", () => {
    expect(isOpenNow(null, WED_11PM)).toBe(true);
    expect(isOpenNow({ something: 1 }, WED_11PM)).toBe(true);
  });
});
