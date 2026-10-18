-- migrations_002_square.sql
-- Additive: columns for ordering and the demo shop.
ALTER TABLE shop
  ADD COLUMN IF NOT EXISTS is_demo            boolean  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS order_tier         smallint NOT NULL DEFAULT 3
                                              CHECK (order_tier IN (1, 2, 3)),
  ADD COLUMN IF NOT EXISTS square_location_id text,
  ADD COLUMN IF NOT EXISTS prep_minutes       smallint;

-- One row per confirmed order. request_id is the idempotency key from the app.
-- square_payment_id is the sandbox test-card payment that makes the order
-- visible in the Seller Dashboard.
CREATE TABLE IF NOT EXISTS swap_order (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id           uuid    NOT NULL REFERENCES shop(id),
  menu_item_id      uuid    NOT NULL REFERENCES menu_item(id),
  request_id        text    NOT NULL UNIQUE,
  square_order_id   text,
  square_payment_id text,
  amount_cents      integer NOT NULL CHECK (amount_cents > 0),
  status            text    NOT NULL DEFAULT 'placed'
                    CHECK (status IN ('placed', 'accepted', 'ready', 'cancelled')),
  created_at        timestamptz NOT NULL DEFAULT now()
);
-- Note: no location columns, on purpose.
