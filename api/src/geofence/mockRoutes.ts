import type { FastifyPluginAsync } from "fastify";

const CHAIN = { id: "sbux-15th-40th", chainName: "Starbucks",
  lat: 47.65466998756357, lng: -122.31173930735872 };
const SHOP = { id: "cafe-allegro", name: "Cafe Allegro",
  lat: 47.659380176123065, lng: -122.31271535088156 };

export const geofenceMock: FastifyPluginAsync = async (app) => {
  app.post("/check", async () => ({
    match: true,
    chain: { id: CHAIN.id, name: CHAIN.chainName },
    shop: { ...SHOP, walkMinutes: 7, priceCents: null },
    message: "Near Starbucks? Cafe Allegro is 7 min away. Tap for directions.",
  }));

  app.get("/regions", async () => ({ chains: [CHAIN] }));

  app.get("/map-data", async () => ({ chains: [CHAIN], shops: [SHOP] }));
};