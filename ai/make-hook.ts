import { writeHook, type WriteHookInput } from "./write-hook";
import { verifyHook } from "./verify";

export interface MakeHookResult {
  /** Set only when verified. Safe to show. */
  hook: string | null;
  sourceUrl: string;
  verified: boolean;
  unsupportedClaims: string[];
  /** The blocked text, kept for logs and the demo. Never show this to users. */
  rejectedHook?: string;
  /** Present when a Gemini call failed. The worker should retry later; this is NOT "no story". */
  error?: string;
}

/** write, then verify. Fails closed: nothing is returned as `hook` unless the verifier approves it. */
export async function makeHook(input: WriteHookInput): Promise<MakeHookResult> {
  const written = await writeHook(input);
  if (written.error) {
    return { hook: null, sourceUrl: written.sourceUrl, verified: false, unsupportedClaims: [], error: written.error };
  }
  if (!written.hook) {
    // NO_STORY: a valid outcome. The app shows plain facts instead.
    return { hook: null, sourceUrl: written.sourceUrl, verified: false, unsupportedClaims: [] };
  }

  const check = await verifyHook({ hook: written.hook, sourceText: input.sourceText });
  if (check.error) {
    return {
      hook: null,
      sourceUrl: written.sourceUrl,
      verified: false,
      unsupportedClaims: [],
      rejectedHook: written.hook,
      error: check.error,
    };
  }
  if (!check.supported) {
    console.log(
      JSON.stringify({ event: "hook_blocked", shop: input.shopName, by: check.blockedBy, claims: check.unsupportedClaims })
    );
    return {
      hook: null,
      sourceUrl: written.sourceUrl,
      verified: false,
      unsupportedClaims: check.unsupportedClaims,
      rejectedHook: written.hook,
    };
  }
  return { hook: written.hook, sourceUrl: written.sourceUrl, verified: true, unsupportedClaims: [] };
}