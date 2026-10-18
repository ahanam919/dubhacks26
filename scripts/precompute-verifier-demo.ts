import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import * as ai from "../ai";

// Saves a few verifier verdicts to out/verifier-demo.json so the demo can show them without a live model call.
//   AI_REAL=1 npx tsx scripts/precompute-verifier-demo.ts
// Reads the real source text from samples/leon-coffee-house-about.txt and the real verified hook from out/leon-coffee-house.json.

if (process.env.AI_REAL !== "1") {
  console.error("Run with AI_REAL=1 or you will get stub data.");
  process.exit(1);
}

const SLUG = "leon-coffee-house";
const GAP_MS = 8000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Case = { label: string; hook: string; expectSupported: boolean };

async function main() {
  const sourcePath = `samples/${SLUG}-about.txt`;
  if (!existsSync(sourcePath)) {
    console.error(`Missing ${sourcePath}`);
    process.exit(1);
  }
  const sourceText = readFileSync(sourcePath, "utf8");

  const cases: Case[] = [];
  const outPath = `out/${SLUG}.json`;
  if (existsSync(outPath)) {
    const built = JSON.parse(readFileSync(outPath, "utf8"));
    if (built?.hook?.verified && typeof built.hook.hook === "string") {
      cases.push({ label: "Real hook (should pass)", hook: built.hook.hook, expectSupported: true });
    }
  }
  // A real writer output that the verifier already blocked (kept by build-fallback as rejectedHook).
  if (existsSync(outPath)) {
    const built = JSON.parse(readFileSync(outPath, "utf8"));
    if (typeof built?.hook?.rejectedHook === "string" && built.hook.rejectedHook) {
      cases.push({ label: "Real writer output, blocked by the verifier", hook: built.hook.rejectedHook, expectSupported: false });
    }
  }
  // If the Leon file no longer holds a rejected hook (it was refreshed), use the real one saved from an earlier build.
  if (!cases.some((c) => c.label.startsWith("Real writer output"))) {
    cases.push({
      label: "Real writer output, blocked by the verifier",
      hook: "Leon Coffee House is a family-owned shop in the University District featuring drinks topped with hand-poured latte art, such as a bear, cat or bunny. Visitors can also enjoy Mexican-inspired drinks like the horchata latte, alongside sandwiches, waffles, and pork tamales.",
      expectSupported: false,
    });
  }
  // A hook whose every claim is stated in the shop's About page text.
  if (!cases.some((c) => c.expectSupported)) {
    cases.push({
      label: "Hook stated in the source (should pass)",
      hook: "Leon Coffee House is a two-story shop next to the Neptune Theatre in the University District.",
      expectSupported: true,
    });
  }

  cases.push(
    { label: "Superlative not in the source (rule layer)", hook: "Leon Coffee House serves the best coffee in Seattle.", expectSupported: false },
    { label: "Invented sourcing (model layer)", hook: "Leon Coffee House roasts all of its own beans in-house.", expectSupported: false },
    { label: "Invented partnership (model layer)", hook: "Leon Coffee House is the official coffee partner of the Neptune Theatre.", expectSupported: false },
  );

  const results: any[] = [];
  for (const c of cases) {
    const v = await ai.verifyHook({ hook: c.hook, sourceText });
    await sleep(GAP_MS);
    const matches = v.blockedBy === "error" ? null : v.supported === c.expectSupported;
    console.log(`${c.label}: supported=${v.supported} blockedBy=${v.blockedBy ?? "-"}${matches === false ? "   <-- UNEXPECTED" : ""}${v.error ? `  error=${v.error}` : ""}`);
    results.push({
      label: c.label,
      hook: c.hook,
      supported: v.supported,
      blockedBy: v.blockedBy ?? null,
      unsupportedClaims: v.unsupportedClaims ?? [],
      evidence: v.evidence ?? [],
      error: v.error ?? null,
      expectedSupported: c.expectSupported,
      matchedExpectation: matches,
    });
  }

  mkdirSync("out", { recursive: true });
  writeFileSync(
    "out/verifier-demo.json",
    JSON.stringify({ shop: SLUG, builtAt: new Date().toISOString(), source: sourcePath, cases: results }, null, 2) + "\n",
  );
  const bad = results.filter((r) => r.matchedExpectation !== true).length;
  console.log(`\nwrote out/verifier-demo.json (${results.length} cases, ${bad} not as expected or errored)`);
  if (bad) console.log("Do not use the demo file until every case matches. Rerun, or paste this output to Claude.");
}

main();