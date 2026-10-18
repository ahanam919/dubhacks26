// Is a shop open right now? Works with the two shapes of shop.hours we store:
//
// 1. Google Places "regularOpeningHours" (what the ingest pipeline saves):
//    { periods: [{ open: { day, hour, minute }, close: { day, hour, minute } }], ... }
//    day is 0 = Sunday ... 6 = Saturday. A period with no close means open 24 hours.
// 2. The simple shape used by the demo shop: { "mon": "07:00-18:00", ... }
//
// Times are Seattle time. Unknown or missing hours count as open, so a shop is
// never hidden or greyed out just because we lack its hours.

type GoogleTime = { day?: number; hour?: number; minute?: number };
type GooglePeriod = { open?: GoogleTime; close?: GoogleTime };

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const WEEK_MIN = 7 * 24 * 60;

/** Day of week (0 = Sunday) and minutes since midnight, in Seattle time. */
export function seattleClock(now: Date): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = DAY_KEYS.indexOf(get("weekday").slice(0, 3).toLowerCase());
  return { day, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

function toMin(t: GoogleTime | undefined): number | null {
  if (!t || typeof t.day !== "number") return null;
  return t.day * 24 * 60 + (t.hour ?? 0) * 60 + (t.minute ?? 0);
}

function parseHHMM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function isOpenNow(hours: unknown, now: Date = new Date()): boolean {
  if (!hours || typeof hours !== "object") return true;
  const { day, minutes } = seattleClock(now);
  if (day < 0) return true;
  const nowWeek = day * 24 * 60 + minutes;

  const periods = (hours as { periods?: unknown }).periods;
  if (Array.isArray(periods)) {
    if (periods.length === 0) return true;
    for (const p of periods as GooglePeriod[]) {
      const open = toMin(p.open);
      if (open === null) continue;
      const close = toMin(p.close);
      if (close === null) return true; // open 24 hours
      // A period can wrap past Saturday night into Sunday.
      const end = close > open ? close : close + WEEK_MIN;
      if ((nowWeek >= open && nowWeek < end) || (nowWeek + WEEK_MIN >= open && nowWeek + WEEK_MIN < end)) {
        return true;
      }
    }
    return false;
  }

  // Simple { "mon": "07:00-18:00" } shape. A missing day means closed that day.
  const simple = hours as Record<string, unknown>;
  const known = DAY_KEYS.some((k) => typeof simple[k] === "string");
  if (!known) return true;
  const today = simple[DAY_KEYS[day]];
  if (typeof today !== "string") return false;
  const [a, b] = today.split("-");
  const start = parseHHMM(a ?? "");
  const end = parseHHMM(b ?? "");
  if (start === null || end === null) return true;
  return end > start ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}
