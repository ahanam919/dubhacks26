import type { GeofenceInput, GeofenceResult } from "./types";

// Pure code, no LLM: the message always contains exactly one literal "{minutes}"
// (the app fills it in at push time) and only uses facts we were given.
const MAX_LEN = 140;

// Braces in names would break the {minutes} placeholder, so strip them.
const clean = (s: string) => (s ?? "").replace(/[{}]/g, "").replace(/\s+/g, " ").trim();

const firstSentence = (s: string) => {
  const m = clean(s).match(/^.*?[.!?](?=\s|$)/);
  return (m ? m[0] : clean(s)).trim();
};

export async function writeGeofenceMessage(input: GeofenceInput): Promise<GeofenceResult> {
  const chain = clean(input?.chain);
  const shop = clean(input?.shopName) || "A local cafe";
  const item = clean(input?.itemName);

  const price = input?.priceCents == null || !Number.isFinite(input.priceCents) || input.priceCents < 0
    ? "" : ` for $${(input.priceCents / 100).toFixed(2)}`;

  const opener = chain ? `Near ${chain}?` : "Craving something local?";
  let msg = item
    ? `${opener} ${shop} has ${item}${price}, {minutes} min away.`
    : `${opener} ${shop} is {minutes} min away.`;

  // Add the verified "why go" hook only if its first sentence still fits a push.
  const hook = input?.hook ? firstSentence(input.hook) : "";
  if (hook && !hook.includes("{") && (msg + " " + hook).length <= MAX_LEN) msg += " " + hook;

  return { message: msg };
}