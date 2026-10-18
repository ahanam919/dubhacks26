-- Seed: chain locations for the demo area (the Ave -> UW campus -> U Village).
-- Same coordinates as api/src/geofence/chainLocations.ts. Safe to run more than
-- once: each row is only added if that chain isn't already at that spot.
-- TODO: confirm each pin in Google Maps and fill in the U Village address.

INSERT INTO chain_location (chain_name, lat, lng, address)
SELECT v.chain_name, v.lat, v.lng, v.address
FROM (VALUES
  ('Starbucks', 47.65466998756357, -122.31173930735872, '3980 15th Ave NE, Seattle, WA 98105'),
  ('Starbucks', 47.65569017951035, -122.30854416151266, '4000 15th Ave NE, Seattle, WA 98105'),
  ('Starbucks', 47.66276976593066, -122.29672583754325, NULL),
  ('Starbucks', 47.66461651938478, -122.2989934925125,  '2650 NE 49th St, Seattle, WA 98105')
) AS v(chain_name, lat, lng, address)
WHERE NOT EXISTS (
  SELECT 1 FROM chain_location c
  WHERE c.chain_name = v.chain_name AND c.lat = v.lat AND c.lng = v.lng
);
