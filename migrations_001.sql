-- migrations_001.sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE shop (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id         text UNIQUE NOT NULL,
  name             text NOT NULL,
  address          text,
  lat              double precision NOT NULL,
  lng              double precision NOT NULL,
  hours            jsonb,
  website_url      text,
  rating           numeric(2,1),
  price_level      smallint,
  badges           text[] NOT NULL DEFAULT '{}',
  milk_options     text[] NOT NULL DEFAULT '{}',
  aspects          jsonb,
  aspects_count    integer,
  aspects_as_of    date,
  hook             text,
  hook_source_url  text,
  hook_source_text text,
  hook_verified_at timestamptz,
  source_urls      text[] NOT NULL DEFAULT '{}',
  last_ingested_at timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shop_latlng_idx ON shop (lat, lng);

CREATE TABLE shop_photo (
  id           bigserial PRIMARY KEY,
  shop_id      uuid NOT NULL REFERENCES shop(id) ON DELETE CASCADE,
  photo_name   text NOT NULL,          -- Google photo reference, not the image
  width_px     integer,
  height_px    integer,
  attributions jsonb,                  -- author names and links to display
  position     smallint NOT NULL CHECK (position BETWEEN 1 AND 5),
  fetched_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, position)
);

CREATE TABLE concept (
  id        text PRIMARY KEY,          -- e.g. 'pumpkin_spice_latte'
  name      text NOT NULL,
  aliases   text[] NOT NULL DEFAULT '{}',
  embedding vector(768)
);

CREATE TABLE menu_item (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id            uuid NOT NULL REFERENCES shop(id) ON DELETE CASCADE,
  name               text NOT NULL,
  description        text,
  -- NULL means "price not listed", never $0. When the worker sets price_cents
  -- it must also set price_source: menu_page, ordering_page or team_entered.
  price_cents        integer,
  price_source       text,
  size               text,
  concept_id         text REFERENCES concept(id),
  concept_confidence real,
  attributes         jsonb NOT NULL DEFAULT '{}',   -- category, extras, flavor...
  status             text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'verified', 'stale')),
  source_url         text,
  last_checked_at    timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT menu_item_price_positive
    CHECK (price_cents IS NULL OR price_cents > 0)
);
CREATE INDEX menu_item_shop_idx    ON menu_item (shop_id);
CREATE INDEX menu_item_concept_idx ON menu_item (concept_id);
-- Re-running the worker updates rows instead of duplicating them.
-- size is often NULL, so treat a missing size as an empty string.
CREATE UNIQUE INDEX menu_item_unique_idx
  ON menu_item (shop_id, name, coalesce(size, ''));

CREATE TABLE chain_reference (
  id                 serial PRIMARY KEY,
  chain_name         text NOT NULL,
  concept_id         text NOT NULL REFERENCES concept(id),
  size               text NOT NULL,
  approx_price_cents integer NOT NULL,
  as_of_date         date NOT NULL,
  source_url         text,
  is_featured        boolean NOT NULL DEFAULT false,
  UNIQUE (chain_name, concept_id, size)
);
CREATE UNIQUE INDEX chain_one_featured_idx
  ON chain_reference (chain_name) WHERE is_featured;

CREATE TABLE chain_location (
  id         serial PRIMARY KEY,
  chain_name text NOT NULL,
  lat        double precision NOT NULL,
  lng        double precision NOT NULL,
  address    text
);

CREATE TABLE geofence_notification (
  id                bigserial PRIMARY KEY,
  device_id         text NOT NULL,
  chain_location_id integer NOT NULL REFERENCES chain_location(id),
  sent_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX geofence_cooldown_idx
  ON geofence_notification (device_id, chain_location_id, sent_at DESC);

CREATE TABLE price_comparison (
  id                 bigserial PRIMARY KEY,
  menu_item_id       uuid NOT NULL REFERENCES menu_item(id) ON DELETE CASCADE,
  chain_reference_id integer NOT NULL REFERENCES chain_reference(id) ON DELETE CASCADE,
  local_price_cents  integer NOT NULL,
  chain_price_cents  integer NOT NULL,
  delta_cents        integer GENERATED ALWAYS AS (local_price_cents - chain_price_cents) STORED,
  size_match         text CHECK (size_match IN ('same', 'close')),
  verdict            text CHECK (verdict IN ('cheaper', 'similar', 'pricier')),
  sentence           text,
  computed_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (menu_item_id, chain_reference_id)
);

CREATE TABLE geofence_message (
  id           bigserial PRIMARY KEY,
  shop_id      uuid NOT NULL REFERENCES shop(id) ON DELETE CASCADE,
  chain_name   text NOT NULL,
  menu_item_id uuid REFERENCES menu_item(id) ON DELETE SET NULL,
  message      text NOT NULL,          -- contains a literal {minutes} placeholder
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, chain_name)
);

CREATE TABLE job (
  id          bigserial PRIMARY KEY,
  type        text NOT NULL,
  payload     jsonb NOT NULL,
  status      text NOT NULL DEFAULT 'queued'
              CHECK (status IN ('queued', 'running', 'done', 'failed')),
  attempts    integer NOT NULL DEFAULT 0,
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  started_at  timestamptz,
  finished_at timestamptz
);
CREATE INDEX job_queue_idx ON job (status, created_at);

-- ---------- hypertables ----------
CREATE TABLE search_event (
  time            timestamptz NOT NULL DEFAULT now(),
  query           text,
  concept_id      text,
  parsed_intent   jsonb,
  result_shop_ids uuid[],
  clicked_shop_id uuid,
  source          text                 -- 'app' | 'simulated'
) WITH (tsdb.hypertable);

CREATE TABLE price_observation (
  time         timestamptz NOT NULL DEFAULT now(),
  menu_item_id uuid NOT NULL,
  price_cents  integer NOT NULL,
  source_url   text
) WITH (tsdb.hypertable);

-- ---------- continuous aggregate ----------
CREATE MATERIALIZED VIEW search_counts_hourly
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT time_bucket('1 hour', time) AS bucket,
       concept_id,
       count(*) AS searches
FROM search_event
GROUP BY bucket, concept_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy('search_counts_hourly',
  start_offset      => INTERVAL '1 day',
  end_offset        => INTERVAL '1 minute',
  schedule_interval => INTERVAL '1 minute');

-- ---------- OPTIONAL, add once the worker writes real data ----------
-- ALTER TABLE menu_item ADD CONSTRAINT menu_item_price_source_valid
--   CHECK (price_source IS NULL
--          OR price_source IN ('menu_page', 'ordering_page', 'team_entered'));
-- ALTER TABLE menu_item ADD CONSTRAINT menu_item_price_has_source
--   CHECK (price_cents IS NULL OR price_source IS NOT NULL);