// Real /geofence endpoints. Same request and response shapes as mockRoutes.ts,
// backed by the database (chain_location, shop, geofence_message,
// geofence_notification). If a table is empty or the database can't be reached,
// they fall back to the seed files, so the demo keeps working.
//
// Settings (in the root .env):
//   GEOFENCE_COOLDOWN_MIN  minutes before the same device hears about the same chain again (default 180)
//   GEOFENCE_QUIET_HOURS   e.g. 21-7 for no alerts 9pm to 7am Seattle time (default: off)

import type { FastifyBaseLogger, FastifyPluginAsync } from "fastify";
import { pool } from "../db";
import { CHAIN_LOCATIONS } from "./chainLocations";
import { decideCheck, parseQuietHours, type CheckInput } from "./check";
import { type ChainLocation, type Shop, isValidPoint, nearestChains } from "./distance";
import { LOCAL_SHOPS } from "./localShops";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isDbChainId = (id: string) => /^\d+$/.test(id); // chain_location.id is a serial number

async function loadChains(log: FastifyBaseLogger): Promise<ChainLocation[]> {
  try {
    const { rows } = await pool.query("SELECT id, chain_name, lat, lng FROM chain_location");
    if (rows.length > 0) {
      return rows.map((r) => ({ id: String(r.id), chainName: r.chain_name, lat: Number(r.lat), lng: Number(r.lng) }));
    }
  } catch (err) {
    log.warn({ err }, "geofence: chain_location unavailable, using seed chains");
  }
  return CHAIN_LOCATIONS;
}

async function loadShops(log: FastifyBaseLogger): Promise<Shop[]> {
  try {
    const { rows } = await pool.query("SELECT id, name, lat, lng FROM shop");
    if (rows.length > 0) {
      return rows.map((r) => ({ id: String(r.id), name: r.name, lat: Number(r.lat), lng: Number(r.lng) }));
    }
  } catch (err) {
    log.warn({ err }, "geofence: shop table unavailable, using seed shops");
  }
  return LOCAL_SHOPS;
}

// Used when the cooldown can't be stored in the database (seed chains, or no database).
const memoryCooldown = new Map<string, Date>();

export const geofenceRoutes: FastifyPluginAsync = async (app) => {
  const cooldownMinutes = Number(process.env.GEOFENCE_COOLDOWN_MIN ?? 180);
  const quietHours = parseQuietHours(process.env.GEOFENCE_QUIET_HOURS);

  app.post("/check", async (req, reply) => {
    const input = (req.body ?? {}) as CheckInput;
    const [chains, shops] = await Promise.all([loadChains(req.log), loadShops(req.log)]);

    const result = await decideCheck(input, {
      chains,
      shops,
      now: new Date(),
      cooldownMinutes,
      quietHours,
      timeZone: "America/Los_Angeles",

      async lastNotifiedAt(deviceId, chainId) {
        if (isDbChainId(chainId)) {
          try {
            const { rows } = await pool.query(
              "SELECT max(sent_at) AS last FROM geofence_notification WHERE device_id = $1 AND chain_location_id = $2",
              [deviceId, Number(chainId)],
            );
            return rows[0]?.last ? new Date(rows[0].last) : null;
          } catch (err) {
            req.log.warn({ err }, "geofence: cooldown lookup failed, using memory");
          }
        }
        return memoryCooldown.get(`${deviceId}|${chainId}`) ?? null;
      },

      async recordNotification(deviceId, chainId) {
        memoryCooldown.set(`${deviceId}|${chainId}`, new Date());
        if (!isDbChainId(chainId)) return;
        try {
          await pool.query(
            "INSERT INTO geofence_notification (device_id, chain_location_id) VALUES ($1, $2)",
            [deviceId, Number(chainId)],
          );
        } catch (err) {
          req.log.warn({ err }, "geofence: could not record notification");
        }
      },

      async messageFor(shopId, chainName) {
        if (!UUID.test(shopId)) return null; // seed shops have no stored message
        try {
          const { rows } = await pool.query(
            "SELECT message FROM geofence_message WHERE shop_id = $1 AND chain_name = $2",
            [shopId, chainName],
          );
          return rows[0]?.message ?? null;
        } catch (err) {
          req.log.warn({ err }, "geofence: message lookup failed, using template");
          return null;
        }
      },
    });

    if (!result.match && result.reason === "bad_request") reply.code(400);
    return result;
  });

  app.get("/regions", async (req) => {
    const q = req.query as { lat?: string; lng?: string };
    const spot = { lat: Number(q.lat), lng: Number(q.lng) };
    const chains = await loadChains(req.log);
    if (!isValidPoint(spot)) return { chains: chains.slice(0, 20) };
    return { chains: nearestChains(spot, chains, 20).map((m) => m.chain) };
  });

  app.get("/map-data", async (req) => {
    const [chains, shops] = await Promise.all([loadChains(req.log), loadShops(req.log)]);
    return { chains, shops };
  });
};
