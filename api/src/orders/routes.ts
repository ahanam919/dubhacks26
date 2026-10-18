import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { pool } from "../db";
import {
  assertSandbox,
  createPickupOrder,
  payWithSandboxCard,
  retrieveOrder,
  SquareError,
  toAppStatus,
  updateFulfillmentState,
} from "./square";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Logs Square's error codes, never the token or request headers.
function logError(app: { log: { error: (o: object, m: string) => void } }, err: unknown, msg: string) {
  const e = err as Error & { squareErrors?: unknown };
  app.log.error({ err: e.message, squareErrors: e.squareErrors }, msg);
}

export const orderRoutes: FastifyPluginAsync = async (app) => {
  // Refuses to register (and so the server refuses to start) unless Square is
  // configured for the sandbox.
  assertSandbox();

  // POST /swap/confirm  { shop_id, menu_item_id, request_id }
  // 201 { order_id, square_order_id, status }   (200 if request_id was already used)
  // 400 invalid, 404 not found, 409 not orderable, 502 Square failed
  app.post("/swap/confirm", { bodyLimit: 10 * 1024 }, async (req, reply) => {
    const { shop_id, menu_item_id, request_id } = (req.body ?? {}) as Record<string, unknown>;
    if (
      typeof shop_id !== "string" || !UUID.test(shop_id) ||
      typeof menu_item_id !== "string" || !UUID.test(menu_item_id) ||
      typeof request_id !== "string" || request_id.length < 8 || request_id.length > 100
    ) {
      return reply.code(400).send({ message: "Invalid request." });
    }

    try {
      // 1. Idempotency: a repeated request_id returns the same order and creates nothing new.
      const existing = await pool.query(
        "SELECT id, square_order_id, status FROM swap_order WHERE request_id = $1",
        [request_id],
      );
      if (existing.rowCount) {
        const o = existing.rows[0];
        return reply.code(200).send({ order_id: o.id, square_order_id: o.square_order_id, status: o.status });
      }

      // 2. Load shop and item. The price comes from the database, never from the phone.
      const { rows } = await pool.query(
        `SELECT s.id AS shop_id, s.order_tier, s.square_location_id,
                m.id AS item_id, m.name AS item_name, m.price_cents
           FROM shop s
           JOIN menu_item m ON m.shop_id = s.id
          WHERE s.id = $1 AND m.id = $2`,
        [shop_id, menu_item_id],
      );
      if (!rows.length) return reply.code(404).send({ message: "Shop or item not found." });
      const r = rows[0];

      if (r.order_tier !== 1 || !r.square_location_id) {
        return reply.code(409).send({ message: "This shop does not take orders through the app." });
      }
      if (r.price_cents == null) {
        return reply.code(409).send({ message: "This item has no listed price." });
      }
      // NOTE: the demo shop is treated as always open. A real open-now check for other
      // tier-1 shops belongs with the search backend's hours logic (TODO).

      // 3. Create the Square order and pay it with the sandbox test card. Both calls
      // are idempotent on request_id, so a retry after a failure reuses them.
      const order = await createPickupOrder({
        locationId: r.square_location_id,
        itemName: r.item_name,
        priceCents: r.price_cents,
        requestId: request_id,
      });
      const payment = await payWithSandboxCard(order, request_id);

      // 4. Save it. ON CONFLICT guards a double-tap race between steps 1 and 4.
      const saved = await pool.query(
        `INSERT INTO swap_order (shop_id, menu_item_id, request_id, square_order_id, square_payment_id, amount_cents, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (request_id) DO UPDATE SET request_id = EXCLUDED.request_id
         RETURNING id, square_order_id, status`,
        [r.shop_id, r.item_id, request_id, order.id, payment.id, r.price_cents, toAppStatus(order)],
      );
      const o = saved.rows[0];
      return reply.code(201).send({ order_id: o.id, square_order_id: o.square_order_id, status: o.status });
    } catch (err) {
      logError(app, err, "confirm failed");
      if (err instanceof SquareError) {
        return reply.code(502).send({ message: "The ordering system could not take this order. Please try again." });
      }
      return reply.code(500).send({ message: "Something went wrong on our side. Please try again." });
    }
  });

  // GET /order/:id  -> { status: 'placed'|'accepted'|'ready'|'cancelled', simulated: boolean }
  // Real Square state by default. Set SIMULATE_STATUS=true to derive it from elapsed time
  // instead (fallback if the sandbox will not advance orders). The response says which.
  app.get<{ Params: { id: string } }>("/order/:id", async (req, reply) => {
    if (!UUID.test(req.params.id)) return reply.code(400).send({ message: "Invalid order id." });

    try {
      const { rows } = await pool.query(
        "SELECT id, square_order_id, status, created_at FROM swap_order WHERE id = $1",
        [req.params.id],
      );
      if (!rows.length) return reply.code(404).send({ message: "Order not found." });
      const row = rows[0];

      if (process.env.SIMULATE_STATUS === "true") {
        const seconds = (Date.now() - new Date(row.created_at).getTime()) / 1000;
        const status = seconds < 5 ? "placed" : seconds < 12 ? "accepted" : "ready";
        return { status, simulated: true };
      }

      const order = await retrieveOrder(row.square_order_id);
      const status = toAppStatus(order);
      if (status !== row.status) {
        await pool.query("UPDATE swap_order SET status = $1 WHERE id = $2", [status, row.id]);
      }
      return { status, simulated: false };
    } catch (err) {
      logError(app, err, "order lookup failed");
      return reply.code(502).send({ message: "Could not check the order status right now." });
    }
  });

  // DEV ONLY: POST /dev/order/:id/advance moves the Square fulfillment one step
  // (PROPOSED -> RESERVED -> PREPARED). Disabled unless ENABLE_DEV_ROUTES=true.
  app.post<{ Params: { id: string } }>("/dev/order/:id/advance", async (req, reply) => {
    if (process.env.ENABLE_DEV_ROUTES !== "true") return reply.code(404).send();
    if (!UUID.test(req.params.id)) return reply.code(400).send({ message: "Invalid order id." });

    try {
      const { rows } = await pool.query("SELECT square_order_id FROM swap_order WHERE id = $1", [req.params.id]);
      if (!rows.length) return reply.code(404).send({ message: "Order not found." });

      const order = await retrieveOrder(rows[0].square_order_id);
      const current = order.fulfillments?.[0]?.state ?? "";
      const next = ({ PROPOSED: "RESERVED", RESERVED: "PREPARED" } as Record<string, string>)[current];
      if (!next) return reply.code(409).send({ message: `Cannot advance from ${current}.` });

      const updated = await updateFulfillmentState(order, next, randomUUID());
      return { square_state: updated.fulfillments?.[0]?.state, status: toAppStatus(updated) };
    } catch (err) {
      logError(app, err, "advance failed");
      return reply.code(502).send({ message: (err as Error).message });
    }
  });
};
