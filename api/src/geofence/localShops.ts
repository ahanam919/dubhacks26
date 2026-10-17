// Seed data: local shops in the demo area, copied by hand from Google Maps, Oct 2026.
//
// TEMPORARY: the real list of local shops lives in the backend's Shop table
// (with menus, prices and verified one-liners). This file lets /geofence/check and
// /geofence/map-data work before that table exists. Once it does, read from it
// instead and delete this file, so the shop list lives in one place.

import type { Shop } from "./distance";

export const LOCAL_SHOPS: Shop[] = [
  {
    id: "ugly-mug-cafe",
    name: "Ugly Mug Cafe",
    // 1309 NE 43rd St. ~650 m (about 9 min walk) from the 15th Ave Starbucks.
    lat: 47.660324981550566,
    lng: -122.31380745892217,
  },
  {
    id: "cafe-allegro",
    name: "Cafe Allegro",
    // 4214 University Way NE (in the alley). ~520 m from the 15th Ave Starbucks.
    lat: 47.659380176123065,
    lng: -122.31271535088156,
  },
  {
    id: "rachels-ginger-beer",
    name: "Rachel's Ginger Beer",
    // 4626 26th Ave NE, U Village. ~200 m from both U Village Starbucks.
    lat: 47.662922290800445,
    lng: -122.29956813553675,
  },
  {
    id: "mr-west-cafe-bar",
    name: "Mr West Cafe Bar",
    // 2685 NE Village Ln, U Village. ~120 m from the U Village Starbucks.
    lat: 47.662876464676685,
    lng: -122.29830572797502,
  },
];