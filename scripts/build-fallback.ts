import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import * as ai from "../ai";
import type { ConceptDef } from "../ai";

const GAP_MS = 4000;
const MIN_CONF = 0.75;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

if (process.env.AI_REAL !== "1") {
  console.error("Run with AI_REAL=1 or you will get stub data.");
  process.exit(1);
}

const concepts: ConceptDef[] = JSON.parse(readFileSync("seed/concept.json", "utf8"));
const chainRows: any[] = JSON.parse(readFileSync("seed/chain_reference.json", "utf8"));
// Rows without price_verified: true are estimates. They still compare, but are labeled approximate.
console.log(`chain rows: ${chainRows.length} total, ${chainRows.filter((r) => r.price_verified === true).length} verified, the rest approximate`);

const read = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : null);
const titleCase = (s: string) => s.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

const IMAGE_MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
// samples/<slug>-menu.txt and/or menu photos: samples/<slug>-menu.jpg (also -menu-2.jpg and so on)
const MENU_FILE = /^(.*)-menu(?:-\d+)?\.(txt|jpe?g|png|webp)$/i;

async function main() {
  mkdirSync("out", { recursive: true });
  const sampleFiles = readdirSync("samples");
  const slugs = [...new Set(sampleFiles.map((f) => f.match(MENU_FILE)?.[1]).filter((s): s is string => !!s))];

  if (slugs.length === 0) {
    console.error("No samples/<slug>-menu.txt (or -menu.jpg/.png/.webp) files found.");
    process.exit(1);
  }

  for (const slug of slugs) {
    const shopName = titleCase(slug);
    console.log(`\n== ${slug}`);
    const menuText = read(`samples/${slug}-menu.txt`);
    const images = sampleFiles
      .filter((f) => {
        const m = f.match(MENU_FILE);
        return m !== null && m[1] === slug && m[2].toLowerCase() !== "txt";
      })
      .sort()
      .map((f) => ({ mimeType: IMAGE_MIME[f.split(".").pop()!.toLowerCase()], data: readFileSync(`samples/${f}`) }));
    const aboutText = read(`samples/${slug}-about.txt`);
    const sourceUrl = (read(`samples/${slug}-url.txt`) ?? "").trim();
    const result: any = { slug, shopName, builtAt: new Date().toISOString(), errors: [] };

    // Menu photos win over menu text: the photo is where the prices are when the text menu has none.
    if (images.length) console.log(`using ${images.length} menu photo(s) for ${slug}`);
    const menu = images.length
      ? await ai.extractMenu({ shopName, images })
      : await ai.extractMenu({ shopName, text: menuText ?? "" });
    await sleep(GAP_MS);
    if (menu.error) result.errors.push(`extractMenu: ${menu.error}`);
    result.notes = menu.notes ?? null;

    result.items = [];
    for (const item of menu.items) {
      const m = await ai.matchConcept(item, concepts);
      await sleep(GAP_MS);
      if (m.error) result.errors.push(`matchConcept(${item.name}): ${m.error}`);

      let comparison: ai.ComparePriceResult | null = null;
      const ref = chainRows.find((r) => r.concept_id === m.conceptId);
      if (ref && m.conceptId && m.confidence >= MIN_CONF) {
        comparison = await ai.comparePrice({
          chain: ref.chain_name,
          local: { name: item.name, priceCents: item.priceCents, size: item.size },
          chainRef: {
            id: String(chainRows.indexOf(ref) + 1),
            priceCents: ref.approx_price_cents,
            size: ref.size,
            asOf: ref.as_of_date,
            approximate: ref.price_verified !== true,
          },
        });
      }
      result.items.push({ ...item, match: m, comparison });
    }

    if (aboutText) {
      const h = await ai.makeHook({ shopName, sourceText: aboutText, sourceUrl });
      await sleep(GAP_MS);
      if (h.error) result.errors.push(`makeHook: ${h.error}`);
      result.hook = h;
    } else {
      result.hook = null;
    }

    const featured = chainRows.find((r) => r.is_featured);
    const pick =
      result.items.find((i: any) => featured && i.match.conceptId === featured.concept_id && i.match.confidence >= MIN_CONF) ??
      result.items.find((i: any) => i.match.conceptId && i.match.confidence >= MIN_CONF);
    result.geofence = pick
      ? await ai.writeGeofenceMessage({
          chain: featured?.chain_name ?? "Starbucks",
          shopName,
          itemName: pick.name,
          priceCents: pick.priceCents,
          hook: result.hook?.verified ? result.hook.hook : null,
        })
      : null;

    writeFileSync(`out/${slug}.json`, JSON.stringify(result, null, 2) + "\n");
    console.log(`wrote out/${slug}.json (${result.items.length} items, ${result.errors.length} errors)`);
  }
}

main();