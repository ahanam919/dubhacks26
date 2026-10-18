import "./env";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { pool } from "./db";
import { geofenceRoutes } from "./geofence/routes";
// The mock is kept for offline testing: swap geofenceRoutes for geofenceMock if needed.
// import { geofenceMock } from "./geofence/mockRoutes";
import { orderRoutes } from "./orders/routes";
// When your teammate's real routes exist, swap geofenceMock for her plugin:
// import { geofenceRoutes } from "./geofence/routes";

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
await app.register(orderRoutes);

// Queues an ingestion job. The worker does the slow work in the background.
// The token stops strangers from queuing jobs that spend your Gemini and Google quota.
app.post("/ingest", async (req, reply) => {
  const token = process.env.INGEST_TOKEN;
  if (!token || req.headers["x-ingest-token"] !== token) {
    return reply.code(401).send({ error: "unauthorized" });
  }
  const body = (req.body ?? {}) as { placeId?: string; shopName?: string; websiteUrl?: string };
  if (!body.placeId && !body.shopName) {
    return reply.code(400).send({ error: "placeId or shopName required" });
  }
  const { rows } = await pool.query(
    `INSERT INTO job (type, payload) VALUES ('ingest_shop', $1) RETURNING id`,
    [body],
  );
  return { queued: true, jobId: rows[0].id };
});

const port = Number(process.env.PORT ?? 3000);
await app.listen({ port, host: "0.0.0.0" });