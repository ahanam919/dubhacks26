// Usage:
//   npx tsx ai/try-hook.ts samples/leon-coffee-house-about.txt "Leon Coffee House" https://leoncoffeehouse.com
//   npx tsx ai/try-hook.ts samples/leon-coffee-house-about.txt "Leon Coffee House" https://leoncoffeehouse.com "Planted hook text to verify directly"
import { readFileSync } from "fs";
import { makeHook } from "./make-hook";
import { verifyHook } from "./verify";

async function main() {
  const [file, shopName, sourceUrl, planted] = process.argv.slice(2);
  if (!file || !shopName) {
    console.error('Usage: npx tsx ai/try-hook.ts <source.txt> "<Shop Name>" <sourceUrl> ["planted hook"]');
    process.exit(1);
  }
  const sourceText = readFileSync(file, "utf8");
  if (planted) {
    console.log("VERIFY ONLY:", planted);
    console.log(JSON.stringify(await verifyHook({ hook: planted, sourceText }), null, 2));
    return;
  }
  console.log(JSON.stringify(await makeHook({ shopName, sourceText, sourceUrl: sourceUrl ?? "" }), null, 2));
}
main();