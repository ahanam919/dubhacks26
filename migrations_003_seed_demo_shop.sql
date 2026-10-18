-- migrations_003_seed_demo_shop.sql
-- Run with: psql "$DATABASE_URL" -v square_location_id="$SQUARE_LOCATION_ID" -f migrations_003_seed_demo_shop.sql
-- or, without psql: cd api && npm run sql -- ../migrations_003_seed_demo_shop.sql
-- Demo content only. The shop is a Square SANDBOX merchant and is labeled as such.

INSERT INTO concept (id, name, aliases)
VALUES ('pumpkin_spice_latte', 'Pumpkin spice latte', ARRAY['psl', 'pumpkin latte', 'pumpkin spice'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO shop (
  id, place_id, name, address, lat, lng, hours, rating, price_level, badges,
  hook, hook_source_text, hook_verified_at,
  is_demo, order_tier, square_location_id, prep_minutes
) VALUES (
  '00000000-0000-4000-8000-000000000001',
  'demo-sandbox-cafe',
  'Demo Cafe (sandbox)',
  '1 Sample St, Seattle, WA',
  47.6553, -122.3035,
  '{"mon":"00:00-23:59","tue":"00:00-23:59","wed":"00:00-23:59","thu":"00:00-23:59","fri":"00:00-23:59","sat":"00:00-23:59","sun":"00:00-23:59"}'::jsonb,
  4.6, 2, ARRAY['demo', 'owner_verified'],
  'Sample hook: made with house pumpkin puree.',
  'Sample source text (mock): house pumpkin puree.',
  now(),
  true, 1, :'square_location_id', 7
)
ON CONFLICT (id) DO UPDATE SET
  is_demo = true,
  order_tier = 1,
  square_location_id = EXCLUDED.square_location_id,
  prep_minutes = 7;

INSERT INTO menu_item (
  id, shop_id, name, price_cents, price_source, size,
  concept_id, concept_confidence, status, last_checked_at
) VALUES (
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  'Pumpkin Spice Latte', 575, 'menu_page', 'grande',
  'pumpkin_spice_latte', 0.95, 'verified', now()
)
ON CONFLICT (id) DO UPDATE SET
  price_cents = 575,
  status = 'verified',
  last_checked_at = now();
