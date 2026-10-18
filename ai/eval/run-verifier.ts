// Runs the planted-lie cases against verifyHook and prints a scoreboard.
//   npx tsx ai/eval/run-verifier.ts
// Optional: also run the full writer + verifier on the source and on the no-story text:
//   npx tsx ai/eval/run-verifier.ts --make
import { readFileSync } from "fs";
import { verifyHook } from "../verify";
import { makeHook } from "../make-hook";

interface Case {
  id: string;
  expect: "pass" | "block";
  hook: string;
  why: string;
}

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

  for (const c of cfg.cases) {
    const r = await verifyHook({ hook: c.hook, sourceText });
    if (r.blockedBy === "error") {
      errors++;
      console.log(`ERR   ${c.id}: ${r.error}`);
      continue;
    }
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

  if (process.argv.includes("--make")) {
    console.log("\n--- makeHook on the real source ---");
    console.log(JSON.stringify(await makeHook({ shopName: "Leon Coffee House", sourceText, sourceUrl: "https://leoncoffeehouse.com" }), null, 2));
    console.log("\n--- makeHook on a no-story source (expect hook null, no error) ---");
    console.log(JSON.stringify(await makeHook({ shopName: "Test Cafe", sourceText: cfg.noStorySource, sourceUrl: "" }), null, 2));
  }
}
main();