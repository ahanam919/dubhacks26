// Runs the planted-lie cases against verifyHook and prints a scoreboard.
//   npx tsx ai/eval/run-verifier.ts
// Optional: also run the full writer + verifier on the source and on the no-story text:
//   npx tsx ai/eval/run-verifier.ts --make
// Calls are spaced out to stay under free-tier quota. Override the gap in ms:
//   npx tsx ai/eval/run-verifier.ts --gap=20000
import { readFileSync } from "fs";
import { verifyHook } from "../verify";
import { makeHook } from "../make-hook";

interface Case {
  id: string;
  expect: "pass" | "block";
  hook: string;
  why: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const gapArg = process.argv.find((a) => a.startsWith("--gap="));
const GAP_MS = gapArg ? Number(gapArg.split("=")[1]) : 15000;
const RETRY_WAIT_MS = 65000; // longer than the 60s per-model cooldown in gemini.ts
const MAX_CONSECUTIVE_ERRORS = 2;

async function main() {
  const cfg = JSON.parse(readFileSync("ai/eval/verifier-cases.json", "utf8")) as {
    source: string;
    cases: Case[];
    noStorySource: string;
  };
  const sourceText = readFileSync(cfg.source, "utf8");

  let correct = 0;
  let wrongPass = 0; // a lie got through (the dangerous failure)
  let wrongBlock = 0; // a true hook was blocked (annoying, not dangerous)
  let errors = 0;
  let skipped = 0;
  let consecutiveErrors = 0;
  let usedApi = false;

  for (const c of cfg.cases) {
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      skipped++;
      console.log(`SKIP  ${c.id}: stopped after ${MAX_CONSECUTIVE_ERRORS} errors in a row`);
      continue;
    }

    if (usedApi) await sleep(GAP_MS);

    let r = await verifyHook({ hook: c.hook, sourceText });
    if (r.blockedBy === "error") {
      console.log(`retry ${c.id}: waiting ${RETRY_WAIT_MS / 1000}s after error`);
      await sleep(RETRY_WAIT_MS);
      r = await verifyHook({ hook: c.hook, sourceText });
    }

    if (r.blockedBy === "error") {
      errors++;
      consecutiveErrors++;
      usedApi = true;
      console.log(`ERR   ${c.id}: ${r.error}`);
      continue;
    }
    consecutiveErrors = 0;
    usedApi = r.blockedBy !== "rule";

    const got = r.supported ? "pass" : "block";
    const ok = got === c.expect;
    if (ok) correct++;
    else if (got === "pass") wrongPass++;
    else wrongBlock++;
    const by = r.blockedBy ? ` [${r.blockedBy}]` : "";
    const detail = r.unsupportedClaims.length ? ` -> ${r.unsupportedClaims.join(" | ")}` : "";
    console.log(`${ok ? "ok   " : "WRONG"} ${c.id}: expected ${c.expect}, got ${got}${by}${detail}`);
  }

  const total = cfg.cases.length;
  console.log("\n--- verifier scoreboard ---");
  console.log(`correct: ${correct}/${total}`);
  console.log(`lies that got through (must be 0): ${wrongPass}`);
  console.log(`true hooks blocked: ${wrongBlock}`);
  console.log(`API errors (not counted): ${errors}`);
  if (skipped) console.log(`skipped after repeated errors: ${skipped} (quota likely exhausted; rerun later)`);

  if (process.argv.includes("--make")) {
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      console.log("\nSkipping --make: quota looks exhausted. Rerun later.");
      return;
    }
    await sleep(GAP_MS);
    console.log("\n--- makeHook on the real source ---");
    console.log(JSON.stringify(await makeHook({ shopName: "Leon Coffee House", sourceText, sourceUrl: "https://leoncoffeehouse.com" }), null, 2));
    await sleep(GAP_MS);
    console.log("\n--- makeHook on a no-story source (expect hook null, no error) ---");
    console.log(JSON.stringify(await makeHook({ shopName: "Test Cafe", sourceText: cfg.noStorySource, sourceUrl: "" }), null, 2));
  }
}
main();