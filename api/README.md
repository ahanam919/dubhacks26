# API

Fastify + Postgres (Tiger Data). Reads its settings from the `.env` at the repo root
(see `.env.example`). Never commit `.env`.

## Run

```
cd api
npm install
npm run dev        # http://localhost:3000, restarts on change
```

## Square sandbox ordering

Tapping **Confirm** in the app calls `POST /swap/confirm`. The API reads the price
from the database, creates a Square **sandbox** pickup order at the Demo Cafe
(sandbox) test account, and pays it with Square's sandbox test card
(`cnon:card-nonce-ok`, no real money). Square only lists API orders in the Seller
Dashboard once they are paid. A repeated `request_id` returns the same order and
never pays twice.

| Route | Purpose |
| --- | --- |
| `POST /swap/confirm` `{ shop_id, menu_item_id, request_id }` | 201 new order, 200 repeat, 400/404/409, 502 if Square fails |
| `GET /order/:id` | `{ status: placed\|accepted\|ready\|cancelled, simulated }` |
| `POST /dev/order/:id/advance` | Only with `ENABLE_DEV_ROUTES=true`: moves the order one step |

The API only ever calls `connect.squareupsandbox.com` and refuses to start unless
`SQUARE_ENV=sandbox`, `SQUARE_ACCESS_TOKEN` and `SQUARE_VERSION` are set.

### Env variables

- `SQUARE_ENV=sandbox`
- `SQUARE_ACCESS_TOKEN`: the **Demo Cafe (sandbox)** test account's token. In the
  Developer Console: your app > Sandbox test accounts > Demo Cafe (sandbox) >
  authorization for this app. The app's default sandbox token belongs to
  "Default Test Account" and will not work with Demo Cafe's location.
- `SQUARE_LOCATION_ID`: run `npm run square:check`. It lists the token's
  locations and confirms the ID matches.
- `SQUARE_VERSION`: a date from Square's API changelog.
- `DATABASE_URL`: Tiger Data connection string.
- Optional: `ENABLE_DEV_ROUTES`, `SIMULATE_STATUS` (see `.env.example`).

### Scripts

```
npm run square:check        # token valid + location matches
npm run square:test-order   # creates and pays one test order
npm run sql -- <file.sql>   # runs a SQL file without psql
```

### Database migrations (once per database)

```
npm run sql -- ../migrations_002_square.sql            # ordering columns + swap_order
npm run sql -- ../migrations_003_seed_demo_shop.sql    # demo shop + Pumpkin Spice Latte
```

The seed uses the fixed ids from `mobile/src/data/mock.ts` and fills the shop's
Square location from `SQUARE_LOCATION_ID`. With psql instead:
`psql "$DATABASE_URL" -v square_location_id="$SQUARE_LOCATION_ID" -f migrations_003_seed_demo_shop.sql`.

### Order status on stage

We use **real Square status**: accept the order, then mark it ready, in the Demo
Cafe (sandbox) Seller Dashboard. The app polls `GET /order/:id` every 3 seconds and
follows along. Fallbacks: `ENABLE_DEV_ROUTES=true` and call the advance route
twice, or `SIMULATE_STATUS=true` (the app then labels the status as simulated).
