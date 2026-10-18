// Creates one sandbox pickup order and reads it back. Run from api/: npm run square:test-order
import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
dotenv.config({ path: new URL('../../.env', import.meta.url) });

for (const k of ['SQUARE_ACCESS_TOKEN', 'SQUARE_LOCATION_ID', 'SQUARE_VERSION']) {
  if (!process.env[k]) { console.error('Missing', k); process.exit(1); }
}
if (process.env.SQUARE_ENV !== 'sandbox') {
  console.error('SQUARE_ENV must be exactly "sandbox".');
  process.exit(1);
}

const BASE = 'https://connect.squareupsandbox.com';
const headers = {
  'Square-Version': process.env.SQUARE_VERSION,
  Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
  'Content-Type': 'application/json',
};

async function call(path, init) {
  const res = await fetch(`${BASE}${path}`, { ...init, headers, signal: AbortSignal.timeout(10000) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('Square error', res.status);
    console.error(json?.errors?.map((e) => `${e.code}: ${e.detail}${e.field ? ` (field: ${e.field})` : ''}`).join('\n'));
    process.exit(1);
  }
  return json;
}

const created = await call('/v2/orders', {
  method: 'POST',
  body: JSON.stringify({
    idempotency_key: `test-${randomUUID()}`,
    order: {
      location_id: process.env.SQUARE_LOCATION_ID,
      line_items: [
        {
          name: 'Pumpkin Spice Latte',
          quantity: '1',
          base_price_money: { amount: 575, currency: 'USD' },
        },
      ],
      fulfillments: [
        {
          type: 'PICKUP',
          state: 'PROPOSED',
          pickup_details: {
            recipient: { display_name: 'Demo Customer' },
            schedule_type: 'ASAP',
          },
        },
      ],
    },
  }),
});

const order = created.order;
console.log('Created order id:', order.id);
console.log('Order state:', order.state);
console.log('Fulfillment state:', order.fulfillments?.[0]?.state);

// Square only lists API orders in the Seller Dashboard once they are paid.
// cnon:card-nonce-ok is Square's sandbox test card: no real money moves.
const paid = await call('/v2/payments', {
  method: 'POST',
  body: JSON.stringify({
    idempotency_key: `test-pay-${randomUUID()}`,
    source_id: 'cnon:card-nonce-ok',
    amount_money: order.total_money,
    order_id: order.id,
    location_id: process.env.SQUARE_LOCATION_ID,
  }),
});
console.log('Payment status:', paid.payment.status);

const fetched = await call(`/v2/orders/${order.id}`, { method: 'GET' });
console.log('Retrieved again OK. Order state:', fetched.order.state, 'Fulfillment state:', fetched.order.fulfillments?.[0]?.state);
