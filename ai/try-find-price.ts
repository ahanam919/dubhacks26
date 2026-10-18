// Try the grounded delivery-price lookup. Uses grounded searches, which have their own small quota, so use it sparingly.
//   AI_REAL=1 npx tsx ai/try-find-price.ts "Shop Name" "Item Name" ["Shop address"]
import { findDeliveryPrice } from "./find-delivery-price";

async function main() {
  const [shopName, itemName, address] = process.argv.slice(2);
  if (!shopName || !itemName) {
    console.error('Usage: npx tsx ai/try-find-price.ts "Shop Name" "Item Name" ["Shop address"]');
    process.exit(1);
  }
  const r = await findDeliveryPrice({ shopName, itemName, address });
  if (r.error) console.log("ERROR:", r.error);
  if (r.priceCents == null) {
    console.log("No solid price found (null).");
    return;
  }
  console.log(`price: $${(r.priceCents / 100).toFixed(2)}${r.size ? ` (${r.size})` : ""}`);
  console.log("source:", r.sourceUrl);
  console.log("snippet:", r.snippet);
}
main();