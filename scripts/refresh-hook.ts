import { readFileSync, writeFileSync, existsSync } from "node:fs";
import * as ai from "../ai";

// Rebuilds ONLY the hook (and its sourceUrl) in out/<slug>.json. Items, prices and comparisons are left alone.
//   AI_REAL=1 npx tsx scripts/refresh-hook.ts leon-coffee-house --source=3
// If samples/<slug>-about.txt is split into "SOURCE n:" sections, the hook is built from ONE section and cites that
// section's URL, so a press fact is never labeled with the shop's own site. Otherwise samples/<slug>-url.txt is the URL.
// Tries up to 3 times (writer output varies). A hook is saved only if it passed the verifier.

if (process.env.AI_REAL !== "1") {
  console.error("Run with AI_REAL=1 or you will get stub data.");
  process.exit(1);
}

const slug = process.argv[2];
const sourceArg = process.argv.find((a) => a.startsWith("--source="))?.split("=")[1];
if (!slug || slug.startsWith("--")) {
  console.error("Usage: AI_REAL=1 npx tsx scripts/refresh-hook.ts <slug> [--source=N]");
  process.exit(1);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const titleCase = (s: string) => s.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
const isRealUrl = (u: string) => /^https?:\/\//i.test(u) && !/REPLACE/i.test(u);

async function main() {
  const outPath = `out/${slug}.json`;
  const aboutPath = `samples/${slug}-about.txt`;
  const urlPath = `samples/${slug}-url.txt`;
  for (const p of [outPath, aboutPath]) {
    if (!existsSync(p)) {
      console.error(`Missing ${p}`);
      process.exit(1);
    }
  }
  const about = readFileSync(aboutPath, "utf8");

  let sourceText = about;
  let sourceUrl = existsSync(urlPath) ? readFileSync(urlPath, "utf8").trim() : "";

  const chunks = about.split(/^(?=SOURCE \d+:)/m).filter((c) => /^SOURCE \d+:/.test(c));
  if (chunks.length > 0) {
    const parsed = chunks.map((c) => {
      const num = c.match(/^SOURCE (\d+):/)![1];
      const url = c.match(/^URL:\s*(\S+)/m)?.[1] ?? "";
      const body = c.split("\n").filter((l) => !/^SOURCE \d+:/.test(l) && !/^URL:/.test(l)).join("\n").trim();
      const title = c.split("\n")[0].replace(/^SOURCE \d+:\s*/, "");
      return { num, url, body, title };
    });
    if (!sourceArg) {
      console.error("This about file has several sources. Pick one with --source=N:");
      for (const s of parsed) console.error(`  --source=${s.num}  ${s.title}  ${s.url}`);
      process.exit(1);
    }
    const pick = parsed.find((s) => s.num === sourceArg);
    if (!pick) {
      console.error(`No SOURCE ${sourceArg} in ${aboutPath}`);
      process.exit(1);
    }
    sourceText = pick.body;
    sourceUrl = pick.url;
    console.log(`using SOURCE ${pick.num}: ${pick.title}\n  ${pick.url}`);
  }

  if (!isRealUrl(sourceUrl)) {
    console.error(`No real source URL found (got "${sourceUrl}").`);
    process.exit(1);
  }

  const shopName = titleCase(slug);
  const built = JSON.parse(readFileSync(outPath, "utf8"));

  let last: any = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const h = await ai.makeHook({ shopName, sourceText, sourceUrl });
    last = h;
    console.log(`attempt ${attempt}: verified=${h.verified}${h.error ? ` error=${h.error}` : ""}${h.hook ? `\n  ${h.hook}` : ""}`);
    if (h.verified || h.error) break;
    await sleep(8000);
  }

  built.hook = last;
  built.errors = (built.errors ?? []).filter((e: string) => !e.startsWith("makeHook"));
  if (last?.error) built.errors.push(`makeHook: ${last.error}`);
  writeFileSync(outPath, JSON.stringify(built, null, 2) + "\n");
  console.log(last?.verified ? `\nwrote verified hook to ${outPath}` : `\nno verified hook; ${outPath} now has hook=null and sourceUrl set. The app shows plain facts.`);
  console.log("Geofence message was not changed. Rerun build-fallback if you want the hook sentence added to it.");
}

main();