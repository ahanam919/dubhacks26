import { createHash } from "node:crypto";

// This project only ever talks to the Square sandbox. The production host is
// deliberately not referenced anywhere.
const BASE = "https://connect.squareupsandbox.com";

// Sandbox test card. Square accepts it only in the sandbox, so no real money moves.
const SANDBOX_TEST_CARD = "cnon:card-nonce-ok";

export type SquareFulfillment = { uid: string; state: string };
export type SquareOrder = {
  id: string;
  location_id: string;
  version: number;
  state: string;
  total_money: { amount: number; currency: string };
  fulfillments?: SquareFulfillment[];
};
export type AppStatus = "placed" | "accepted" | "ready" | "cancelled";

export class SquareError extends Error {
  constructor(message: string, readonly status: number, readonly squareErrors?: unknown) {
    super(message);
  }
}

// Throws unless the Square settings are present and point at the sandbox.
export function assertSandbox() {
  if (process.env.SQUARE_ENV !== "sandbox") {
    throw new Error('SQUARE_ENV must be exactly "sandbox". Refusing to start.');
  }
  for (const k of ["SQUARE_ACCESS_TOKEN", "SQUARE_VERSION"]) {
    if (!process.env[k]) throw new Error(`Missing env var ${k}`);
  }
}

async function squareFetch<T>(path: string, { method = "GET", body }: { method?: string; body?: unknown } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Square-Version": process.env.SQUARE_VERSION!,
      Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  const json = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) {
    const first = json?.errors?.[0];
    // Never include headers or the token in errors.
    throw new SquareError(first ? `${first.code}: ${first.detail ?? ""}` : `HTTP ${res.status}`, res.status, json?.errors);
  }
  return json as T;
}

export async function createPickupOrder(input: {
  locationId: string;
  itemName: string;
  priceCents: number;
  requestId: string;
}) {
  const json = await squareFetch<{ order: SquareOrder }>("/v2/orders", {
    method: "POST",
    body: {
      idempotency_key: input.requestId, // the same request_id always returns the same order
      order: {
        location_id: input.locationId,
        line_items: [
          {
            name: input.itemName,
            quantity: "1",
            base_price_money: { amount: input.priceCents, currency: "USD" },
          },
        ],
        fulfillments: [
          {
            type: "PICKUP",
            state: "PROPOSED",
            pickup_details: {
              recipient: { display_name: "Demo Customer" },
              schedule_type: "ASAP",
            },
          },
        ],
      },
    },
  });
  return json.order;
}

// Square lists API orders in the Seller Dashboard only once they are paid, so
// the order is paid in full with the sandbox test card. The key is derived from
// request_id (CreatePayment allows at most 45 characters), so a retry never pays twice.
export async function payWithSandboxCard(order: SquareOrder, requestId: string) {
  const key = `pay-${createHash("sha256").update(requestId).digest("hex").slice(0, 40)}`;
  const json = await squareFetch<{ payment: { id: string; status: string } }>("/v2/payments", {
    method: "POST",
    body: {
      idempotency_key: key,
      source_id: SANDBOX_TEST_CARD,
      amount_money: order.total_money,
      order_id: order.id,
      location_id: order.location_id,
    },
  });
  return json.payment;
}

export async function retrieveOrder(orderId: string) {
  const json = await squareFetch<{ order: SquareOrder }>(`/v2/orders/${encodeURIComponent(orderId)}`);
  return json.order;
}

// Moves a pickup fulfillment forward. Used only by the dev route.
export async function updateFulfillmentState(order: SquareOrder, nextState: string, idempotencyKey: string) {
  const fulfillment = order.fulfillments?.[0];
  if (!fulfillment) throw new Error("Order has no fulfillment.");
  const json = await squareFetch<{ order: SquareOrder }>(`/v2/orders/${encodeURIComponent(order.id)}`, {
    method: "PUT",
    body: {
      idempotency_key: idempotencyKey,
      order: {
        location_id: order.location_id,
        version: order.version,
        fulfillments: [{ uid: fulfillment.uid, state: nextState }],
      },
    },
  });
  return json.order;
}

// Square fulfillment states -> the three steps the app shows.
export function toAppStatus(order: SquareOrder): AppStatus {
  if (order.state === "CANCELED") return "cancelled";
  switch (order.fulfillments?.[0]?.state) {
    case "RESERVED":
      return "accepted";
    case "PREPARED":
    case "COMPLETED":
      return "ready";
    case "CANCELED":
    case "FAILED":
      return "cancelled";
    default:
      return "placed"; // PROPOSED or unknown
  }
}
