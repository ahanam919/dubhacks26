const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runIngest(payload: Record<string, unknown>): Promise<void> {
  console.log("ingest start", payload);

  // 1. TODO Places lookup: details, hours, reviews, photo references
  // 2. TODO fetch the shop's website and menu page, turn them into plain text
  // 3. TODO call the ai/ functions: extractMenu, matchConcepts, makeHook,
  //         scoreAspects, writeGeofenceMessage, comparePrice
  //         (check .error after every call and throw if it is set)
  // 4. TODO validate, then upsert into shop, menu_item, shop_photo,
  //         geofence_message and price_comparison
  await sleep(1000); // stand-in so you can watch it run

  console.log("ingest finished", payload);
}