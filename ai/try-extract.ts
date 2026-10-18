import { readFileSync } from "fs";
import { extractMenu } from "./extract-menu";

(async () => {
  const [file, shopName = "Test Cafe"] = process.argv.slice(2);
  if (!file) {
    console.error('Usage: npx tsx ai/try-extract.ts <menu-file> "<shop name>"');
    process.exit(1);
  }
  const text = readFileSync(file, "utf8");
  const res = await extractMenu({ shopName, text });
  console.log(JSON.stringify(res, null, 2));
})();