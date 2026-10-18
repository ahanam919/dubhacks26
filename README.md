# Local Swap

Local Swap suggests an independent coffee shop when you're about to go to a chain. Search for a drink ("PSL", "oat milk chai", "something sweet") or walk near a Starbucks, and the app shows a nearby local shop that has the same drink, how its price compares, and a short "why go" story taken from the shop's own pages or press. You can then place a pickup order.

Built at DubHacks 2026. The demo area is Seattle's U District (the Ave and University Village).

## Team

| Name | Area |
| --- | --- |
| Neeti | Backend: API, database, ingestion worker, deployment |
| Ashwari | Gemini AI integration |
| Ishita | Geofence |
| Ahana | Square integration and UI/UX |

## Contents

- [How it works](#how-it-works)
- [Repo layout](#repo-layout)
- [Setup](#setup)
- [Environment variables](#environment-variables)
- [Database](#database)
- [Running the API and worker](#running-the-api-and-worker)
- [Ingestion jobs](#ingestion-jobs)
- [Running the mobile app](#running-the-mobile-app)
- [API routes](#api-routes)
- [Square sandbox ordering](#square-sandbox-ordering)
- [AI module](#ai-module)
- [Scripts and tools](#scripts-and-tools)
- [Deploy](#deploy)
- [Safety and honesty rules](#safety-and-honesty-rules)

## How it works

1. **Ingestion.** A background worker finds cafes with Google Places, reads their menus from their own websites (and optionally menu photos), and uses Gemini to turn them into structured items with prices. Each item is mapped to a drink concept such as `pumpkin_spice_latte`.
2. **Comparison.** Local prices are compared to chain reference prices in plain code, not by the model. Chain prices that are estimates are labeled as estimates.
3. **Hooks.** Gemini writes a one or two sentence story using only the source text. A separate verifier checks every claim, and anything it can't confirm is not shown.
4. **Geofence.** The app sends the user's location. When they're near a chain location, the API picks a local alternative and the app shows a notification, with a cooldown and optional quiet hours.
5. **Ordering.** Confirming a swap creates and pays a pickup order in Square's **sandbox**. No real money is involved.

## Repo layout

| Path | What it is |
| --- | --- |
| `ai/` | All Gemini logic: menu extraction, concept matching, query parsing, hook writing and verification, price comparison, geofence messages. Pure TypeScript with no database access. |
| `ai/eval/` | Verifier test cases (`verifier-cases.json`), the runner, and recorded results (`RESULTS.md`). |
| `api/src/server.ts` | Fastify server: health checks, catalog, geofence, orders, `/ingest`. |
| `api/src/worker.ts` | Background worker that runs jobs from the `job` table. |
| `api/src/catalog/` | Search, shop pages, opening hours (`openNow.ts`), pick logic (`pick.ts`). |
| `api/src/geofence/` | Location checks, distance math, cooldowns, quiet hours. Includes seed fallbacks and an offline mock (`mockRoutes.ts`). |
| `api/src/ingest/` | Ingestion pipeline: Places lookup, website and menu scraping, chain menus, concept classification, manual menus, zone config. |
| `api/src/orders/` | Square sandbox ordering. |
| `api/src/seed.ts` | Loads concepts and chain reference prices from `seed/`. |
| `api/scripts/` | `run-sql.mjs`, `square-check.mjs`, `square-test-order.mjs`. |
| `mobile/` | Expo / React Native app (Expo Router, `react-native-maps`, `expo-notifications`). |
| `seed/` | `concept.json` (drink concepts and aliases), `chain_reference.json` (chain prices), `manual_menus.json` (hand-entered menus). |
| `samples/` | Sample shop inputs (`<slug>-menu.txt` or `.jpg`, `-about.txt`, `-url.txt`). |
| `out/` | Precomputed pipeline output, used as the demo fallback. |
| `scripts/` | `build-fallback.ts`, `precompute-verifier-demo.ts`, `refresh-hook.ts`. |
| `migrations_*.sql` | Database schema and seed migrations. |
| `docker-compose.yml`, `Caddyfile`, `api/Dockerfile` | Deployment: API, worker and Caddy (HTTPS) on one server. |

## Setup

Requires Node 22 and a Postgres database (we use Tiger Data).

```bash
cp .env.example .env          # then fill it in (see below)
npm install                   # root packages, used by ai/ and scripts/
cd api && npm install
cd ../mobile && npm install
```

`.env` at the repo root is read by both `ai/` and `api/`. Never commit it. It is in `.gitignore`, as are the Tiger Cloud credential files.

## Environment variables

### Root `.env`

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string (`...?sslmode=require`) |
| `GEMINI_API_KEY` | for real AI | Gemini key. Server-side only. |
| `AI_REAL` | for real AI | Set to `1` to make real Gemini calls. Without it `ai/` returns stub data in the same shapes, and ingestion refuses to run. |
| `PORT` | no | API port (default `3000`) |
| `NODE_ENV` | no | `development` or `production` |
| `PLACES_API_KEY` | for ingestion | Google Places key, used to find shops |
| `INGEST_TOKEN` | for `/ingest` | Shared secret for the `x-ingest-token` header |
| `INGEST_USER_AGENT` | for ingestion | User agent for fetching shop websites. Include a contact. |
| `INGEST_DELAY_MS` | no | Delay between page fetches (default `3000`) |
| `SQUARE_ENV` | yes | Must be exactly `sandbox`, or the API won't start |
| `SQUARE_ACCESS_TOKEN` | yes | Token of the **Demo Cafe (sandbox)** test account (see [Square](#square-sandbox-ordering)) |
| `SQUARE_LOCATION_ID` | yes | That account's location. `npm run square:check` lists it. |
| `SQUARE_VERSION` | yes | Square-Version header, a date from Square's API changelog (e.g. `2026-09-16`) |
| `ENABLE_DEV_ROUTES` | no | `true` enables `POST /dev/order/:id/advance` |
| `SIMULATE_STATUS` | no | `true` fakes order status from elapsed time (the app labels it as simulated) |
| `GEOFENCE_COOLDOWN_MIN` | no | Minutes before the same device hears about the same chain again (default `180`) |
| `GEOFENCE_QUIET_HOURS` | no | For example `21-7` means no alerts from 9pm to 7am Seattle time (off by default) |

### `mobile/.env`

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | Where the app finds the API. If unset, it uses the deployed server `https://104-238-157-17.nip.io`. Android emulator: `http://10.0.2.2:3000`. iOS simulator: `http://localhost:3000`. Physical phone on the same Wi-Fi: your computer's LAN IP, e.g. `http://192.168.1.20:3000`. |
| `GOOGLE_MAPS_ANDROID_API_KEY` | Maps SDK for Android key. Only used by development builds (`npx expo run:android`), not Expo Go. |

## Database

Tables (from `migrations_001.sql`): `shop`, `shop_photo`, `concept`, `menu_item`, `chain_reference`, `chain_location`, `geofence_notification`, `price_comparison`, `geofence_message`, `job`, `search_event`, `price_observation`, plus `swap_order` from the Square migration.

Run once per database, from `api/`. `npm run sql` runs a SQL file without needing psql:

```bash
cd api
npm run sql -- ../migrations_001.sql                  # schema
npm run sql -- ../migrations_002_geofence_seed.sql    # chain locations for the geofence
npm run sql -- ../migrations_002_square.sql           # ordering columns + swap_order
npm run sql -- ../migrations_003_seed_demo_shop.sql   # demo shop + Pumpkin Spice Latte
npx tsx src/seed.ts                                   # concepts and chain reference prices from seed/
```

The demo shop seed uses the fixed ids from `mobile/src/data/mock.ts` and fills the shop's Square location from `SQUARE_LOCATION_ID`. With psql instead:

```bash
psql "$DATABASE_URL" -v square_location_id="$SQUARE_LOCATION_ID" -f migrations_003_seed_demo_shop.sql
```

If the `chain_location` or `shop` tables are empty or the database can't be reached, the geofence routes fall back to the seed data in `api/src/geofence/`, so the demo keeps working.

## Running the API and worker

```bash
cd api
npm run dev                   # API on http://localhost:3000, restarts on change
npm start                     # API without watch mode
npx tsx src/worker.ts         # ingestion worker (separate terminal)
npm test                      # vitest: geofence, distance, chain locations, opening hours, pick
```

`GET /health/db` also reports database latency from wherever the API runs.

## Ingestion jobs

The worker polls the `job` table every 3 seconds. It claims jobs with `FOR UPDATE SKIP LOCKED`, so several workers can run at once. A failed job is retried up to 3 times. Jobs stuck in `running` for over 10 minutes are put back in the queue on startup.

Queue jobs with SQL, or with `POST /ingest` (header `x-ingest-token: $INGEST_TOKEN`, body `{ placeId }` or `{ shopName }`).

| Job type | Payload | What it does |
| --- | --- | --- |
| `discover_area` | `{"area":"ave_block"}` or a `rect`. Optional `deep`, `maps`, `max`, `force`. | Finds cafes in a zone with Places and queues one `ingest_shop` per shop |
| `ingest_shop` | `{"placeId":"..."}` | Places details, then menu from the website (and photos for deep zones), concept matching, price comparison, hook, geofence message |
| `ingest_chain` | `{"chain":"Happy Lemon","url":"...","defaultSize":"large"}` | Reads a chain's online menu into chain reference prices |
| `classify_concepts` | `{}` or `{"force":true}` | Picks each concept's natural comparison chain (`concept.default_chain`). Only empty rows unless `force`, so hand edits survive. |
| `load_manual` | `{}` or `{"shop":"Leon Coffee House"}` | Loads `seed/manual_menus.json`. No Gemini or network needed. |

```sql
INSERT INTO job (type, payload) VALUES ('discover_area', '{"area":"ave_block"}');
INSERT INTO job (type, payload) VALUES ('load_manual', '{}');
INSERT INTO job (type, payload) VALUES ('classify_concepts', '{}');
-- Fix a comparison chain by hand:
UPDATE concept SET default_chain = 'Starbucks' WHERE id = 'matcha_latte';
```

**Zones** are set in `api/src/ingest/zones.ts` (`ave_block`, `uvillage`, ...). Each zone has a search box, `deep` (also read menu photos, which costs more Gemini calls), `maps` (also read Google Maps photos, deep zones only) and `max` (cap on shops queued). Photo reads are currently commented out in `pipeline.ts` to save Gemini quota.

**Manual menus.** In `seed/manual_menus.json`, each key matches the start of a shop's name ("Leon Coffee House" matches "Leon Coffee House - U District"). Items are `{ name, size, price (dollars), concept, category, description }`. `"replace": true` marks the shop's scraped items as stale.

## Running the mobile app

```bash
cd mobile
npx expo start                # then open in Expo Go, a simulator, or a dev build
npx expo run:ios              # development build (needed for some native modules)
npx expo run:android
npx expo lint
npx tsc --noEmit
```

Use `npx expo install <package>` to add dependencies so the versions match the Expo SDK (57). `ios/` and `android/` are generated, so don't edit them by hand.

Screens (`mobile/src/app/`):

| Screen | What it shows |
| --- | --- |
| `index.tsx` | Home: map of chains and local shops, with the drag-the-pin geofence check |
| `explore.tsx` | Search and browse (opened with **Simulate**) |
| `results.tsx` | Search results with ranking chips |
| `shop/[id].tsx` | Shop page: menu, hook, price comparison |
| `compare/[id].tsx` | Local versus chain side by side |
| `order/confirm.tsx`, `order/status.tsx` | Confirm a swap, then follow order status |
| `dev/simulate.tsx` | Drag a pin to simulate a location. This stands in for real geofencing, which is unreliable in a crowded hall. |

Notifications use `expo-notifications` where it is available (development builds, or Expo Go on iPhone). On Expo Go for Android they fall back to an in-app pop-up with a Directions button. iPhone uses Apple Maps so that Expo Go works.

## API routes

| Route | Purpose |
| --- | --- |
| `GET /health` | Liveness |
| `GET /health/db` | Database check with latency in ms |
| `GET /app/shops` | All shops |
| `GET /app/shops/:id?q=&lat=&lng=` | Shop page, optionally for a search and a location |
| `GET /app/search?q=&lat=&lng=` | Drink search with price comparisons |
| `GET /app/featured-chain` | Chain used for comparisons |
| `POST /geofence/check` | Location check. Returns a local suggestion when near a chain, honoring cooldown and quiet hours. |
| `GET /geofence/regions` | Chain locations |
| `GET /geofence/map-data` | Chains and shops for the map |
| `POST /swap/confirm` | `{ shop_id, menu_item_id, request_id }`. Returns 201 for a new order, 200 for a repeat, 400/404/409, or 502 if Square fails. |
| `GET /order/:id` | `{ status: placed \| accepted \| ready \| cancelled, simulated }` |
| `POST /dev/order/:id/advance` | Only with `ENABLE_DEV_ROUTES=true`. Moves the order one step forward. |
| `POST /ingest` | Queues an `ingest_shop` job. Requires the `x-ingest-token` header. |

## Square sandbox ordering

Tapping **Confirm** in the app calls `POST /swap/confirm`. The API reads the price from the database, creates a Square **sandbox** pickup order at the Demo Cafe (sandbox) test account, and pays it with Square's sandbox test card (`cnon:card-nonce-ok`, no real money). Square only lists API orders in the Seller Dashboard once they are paid. A repeated `request_id` returns the same order and never pays twice.

The API only ever calls `connect.squareupsandbox.com`. It refuses to start unless `SQUARE_ENV=sandbox`, `SQUARE_ACCESS_TOKEN` and `SQUARE_VERSION` are set.

**Getting the token.** In the Square Developer Console, go to your app > Sandbox test accounts > Demo Cafe (sandbox) > authorization for this app. The app's default sandbox token belongs to "Default Test Account" and will not work with Demo Cafe's location.

```bash
cd api
npm run square:check          # token is valid and the location matches
npm run square:test-order     # creates and pays one test order
```

**Order status during the demo.** We use real Square status: in the Demo Cafe (sandbox) Seller Dashboard, accept the order and then mark it ready. The app polls `GET /order/:id` every 3 seconds and follows along. Fallbacks: set `ENABLE_DEV_ROUTES=true` and call the advance route twice, or set `SIMULATE_STATUS=true` (the app then labels the status as simulated).

## AI module

Everything Gemini does lives in `ai/`. Gemini turns messy inputs (menu text, menu photos, shop descriptions, search queries) into structured data and short sourced text. It never supplies facts on its own: shops, prices and distances come from the database and Maps. Every sentence shown to a user first passes a separate verifier.

All functions are pure TypeScript with no database access and never throw. On failure they return `null`, an empty array or an `error` field. Bad or unverified text fails closed, meaning it is not shown. Models are set in one place, `ai/config.ts`.

| Function | What it does | Model |
| --- | --- | --- |
| `extractMenu` | Turns menu text or menu photos (jpeg, png, webp) into items: name, description, price in cents, size, confidence. Prices are never guessed, so anything unreadable or missing is `null`. | `gemini-3.5-flash-lite` for text, `gemini-3.7-flash` (vision) for photos |
| `matchConcept` | Maps each menu item to a drink concept (e.g. "Great Pumpkin Latte" to `pumpkin_spice_latte`) with a confidence and attributes. Search only trusts 0.75 and above. | `gemini-3.5-flash-lite` |
| `parseQuery` | Turns a search into a concept, dietary needs, size and chain. Common queries are resolved in code first, and Gemini is called only when code finds no match. It can ask a clarifying question. | `gemini-3.5-flash-lite` |
| `writeHook` | Writes a one or two sentence "why go" story using only facts in the source text. Returns nothing if there is no real story. | `gemini-3.5-flash-lite` |
| `verifyHook` | A rule layer blocks wrong numbers and unsupported superlatives ("best", "only", "award"). A model call then requires evidence for each remaining claim and rejects by default. | `gemini-3.7-flash`, falling back to `gemini-flash-latest` |
| `makeHook` | `writeHook` followed by `verifyHook`. Returns a hook only if it is verified. | both |

These parts deliberately don't use a model:

- **`comparePrice`** matches sizes and computes the price difference, a verdict and a one-line sentence in plain code, so the money math is exact. It returns `null` when a price is missing or the sizes don't match. Estimated chain prices are marked "est.", phrased with "about", and use a wider band for "similar".
- **`writeGeofenceMessage`** fills a fixed template, so prices and walk minutes can't drift. It adds the first sentence of a verified hook only if the message stays within 140 characters.

Not built yet: `scoreAspects` (review-based scores), `selectPhotos` (photo carousel) and embeddings are stubs.

## Scripts and tools

Run these from the repo root.

```bash
npx tsx ai/probe-models.ts                              # which Gemini models respond right now (run before a demo)
npx tsx ai/list-models.ts                               # list available models
npx tsx ai/try-parse.ts "psl" "oat milk latte large"    # parse one or more search queries
AI_REAL=1 npx tsx ai/try-extract.ts samples/leon-coffee-house-menu.txt "Leon Coffee House"   # extract a menu from text
AI_REAL=1 npx tsx ai/try-extract-image.ts "Shop Name" path/to/menu.jpg [more.png ...]       # read prices from menu photos
AI_REAL=1 npx tsx ai/try-match.ts samples/leon-coffee-house-menu.txt "Leon Coffee House"     # concept matching
npx tsx ai/try-compare.ts                               # price comparison examples
npx tsx ai/try-hook.ts samples/leon-coffee-house-about.txt "Leon Coffee House" https://leoncoffeehouse.com [planted hook]
npx tsx ai/try-geofence.ts                              # geofence message examples
npx tsx ai/eval/run-verifier.ts --make                  # planted-lie tests against the verifier, prints a scoreboard
AI_REAL=1 npx tsx scripts/build-fallback.ts             # run the whole pipeline on samples/, write one JSON per shop to out/
AI_REAL=1 npx tsx scripts/precompute-verifier-demo.ts   # save verifier verdicts to out/verifier-demo.json for an offline demo
AI_REAL=1 npx tsx scripts/refresh-hook.ts leon-coffee-house --source=3   # rebuild only the hook in out/<slug>.json
```

- `try-hook.ts` with a fourth argument skips writing and verifies the planted text directly.
- `refresh-hook.ts`: if `samples/<slug>-about.txt` is split into `SOURCE n:` sections, the hook is built from one section and cites that section's URL, so a press fact is never credited to the shop's own site. It tries up to 3 times and saves only a verified hook.

- `build-fallback.ts` reads every `samples/<slug>-menu.txt` or `samples/<slug>-menu.jpg` (plus `-about.txt` and `-url.txt` if present). A photo is used when one exists. The output in `out/` is the demo fallback if live calls fail.
- The verifier eval spaces out its calls to respect rate limits. Results from each test pass are recorded in `ai/eval/RESULTS.md`.

## Deploy

```bash
docker compose up -d --build
```

This runs three services on one server, all reading the root `.env`:

- `api`: the Fastify server, built from `api/Dockerfile`. The image contains only `ai/`, `api/` and `seed/`.
- `worker`: the same image, running `src/worker.ts`.
- `caddy`: serves HTTPS for the hostname in the `Caddyfile` (`104-238-157-17.nip.io`) and proxies to `api:3000`.

## Safety and honesty rules

- No invented stories. "No story" is a valid result, and the app falls back to plain facts.
- Hooks must be supported by the source, with no superlatives the source doesn't use and no implied affiliation or endorsement. Press-based hooks cite the article.
- Money math is done in code. A missing price stays missing and is never guessed.
- Menus come only from a shop's own pages, or from menu photos the team took. There is no Instagram scraping. Maps photos are kept only as a reference, and the image is read in memory and then discarded.
- API keys live in `.env` on the server only.
- Square is sandbox-only.
