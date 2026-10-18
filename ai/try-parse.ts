// Usage: npx tsx ai/try-parse.ts "psl" "oat milk latte large" ...
import { parseQuery } from "./parse-query";
(async () => {
  const qs = process.argv.slice(2);
  for (const q of qs.length ? qs : ["psl", "iced pumpkin spice latte", "oat milk chai", "vegan matcha, large", "starbucks frappuccino", "something sweet", "a hot toddy"]) {
    console.log(JSON.stringify(q), "=>", JSON.stringify(await parseQuery(q)));
  }
})();