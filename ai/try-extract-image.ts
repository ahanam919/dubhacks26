// Try menu photo extraction on one or more image files.
//   npx tsx ai/try-extract-image.ts "Shop Name" path/to/photo1.jpg [path/to/photo2.png ...]
import { readFileSync } from "fs";
import { extname } from "path";
import { extractMenu } from "./extract-menu";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
};

async function main() {
  const [shopName, ...files] = process.argv.slice(2);
  if (!shopName || files.length === 0) {
    console.error('Usage: npx tsx ai/try-extract-image.ts "Shop Name" photo1.jpg [photo2.png ...]');
    process.exit(1);
  }
  const images = files.map((f) => {
    const mimeType = MIME[extname(f).toLowerCase()];
    if (!mimeType) throw new Error(`Unsupported file type: ${f} (use .jpg, .png or .webp)`);
    return { mimeType, data: readFileSync(f) };
  });

  const r = await extractMenu({ shopName, images });
  if (r.error) console.log("ERROR:", r.error);
  console.log(`${r.items.length} items`);
  for (const i of r.items) {
    const price = i.priceCents == null ? "no price" : `$${(i.priceCents / 100).toFixed(2)}`;
    console.log(`- ${i.name}${i.size ? ` (${i.size})` : ""}: ${price} [${i.confidence ?? "?"}]`);
  }
  if (r.milkOptions?.length) console.log("milk:", r.milkOptions.join(", "));
  if (r.notes) console.log("notes:", r.notes);
}
main();