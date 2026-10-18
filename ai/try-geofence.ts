import { writeGeofenceMessage } from "./geofence-message";
(async () => {
  const cases = [
    { chain: "Starbucks", shopName: "Ugly Mug Cafe", itemName: "Pumpkin Spice Latte", priceCents: 575, hook: null },
    { chain: "Starbucks", shopName: "Leon Coffee House", itemName: "Pumpkin Spice Latte", priceCents: null, hook: "Family-owned in the U District." },
    { chain: "Starbucks", shopName: "Leon Coffee House", itemName: "Pumpkin Spice Latte", priceCents: 575, hook: "Leon Coffee House is a family-owned shop in the University District featuring drinks topped with hand-poured latte art." },
    { chain: "", shopName: "Cafe {Allegro}", itemName: "", priceCents: 0, hook: null },
  ];
  for (const c of cases) { const r = await writeGeofenceMessage(c); console.log(r.message.length, r.message, "| one {minutes}:", r.message.split("{minutes}").length === 2); }
})();