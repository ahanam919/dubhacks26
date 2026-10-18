import { readFileSync } from "fs";
import { extractMenu } from "./extract-menu";
import { matchConcepts } from "./match-concept";
import { CONCEPTS } from "./concepts";

(async () => {
  const [file, shopName = "Test Cafe"] = process.argv.slice(2);
  const menu = await extractMenu({ shopName, text: readFileSync(file, "utf8") });
  const matches = await matchConcepts(menu.items, CONCEPTS);
  menu.items.forEach((it, i) => {
    const m = matches[i];
    console.log(`${it.name} [${it.category}] -> ${m.conceptId ?? "null"} (${m.confidence})`, m.attributes);
  });
})();