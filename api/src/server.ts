import "./env";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { pool } from "./db";
import { geofenceRoutes } from "./geofence/routes";
// The mock is kept for offline testing: swap geofenceRoutes for geofenceMock if needed.
// import { geofenceMock } from "./geofence/mockRoutes";

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

app.get("/health", async () => ({ ok: true }));

// Also tells you how fast the database is from wherever this runs.
app.get("/health/db", async () => {
  const t0 = Date.now();
  await pool.query("SELECT 1");
  return { ok: true, ms: Date.now() - t0 };
});

await app.register(geofenceRoutes, { prefix: "/geofence" });

const port = Number(process.env.PORT ?? 3000);
await app.listen({ port, host: "0.0.0.0" });