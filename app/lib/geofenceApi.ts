// Talks to the geofence endpoints on our API server.
// The response shapes here must match api/src/geofence/routes.ts.

export interface LatLng {
  lat: number;
  lng: number;
}

export interface MapChain extends LatLng {
  id: string;
  chainName: string;
}

export interface MapShop extends LatLng {
  id: string;
  name: string;
}

export interface MapData {
  chains: MapChain[];
  shops: MapShop[];
}

export type CheckResult =
  | { match: false }
  | {
      match: true;
      chain: { id: string; name: string };
      shop: { id: string; name: string; walkMinutes: number; price?: string; lat: number; lng: number };
      message: string;
    };

// Demo area: where UW students go, from the Ave (University Way NE) across campus
// to University Village. The map opens centered here, wide enough to show all of it.
export const DEMO_CENTER: LatLng = { lat: 47.6595, lng: -122.3045 };
export const DEMO_REGION = {
  latitude: DEMO_CENTER.lat,
  longitude: DEMO_CENTER.lng,
  latitudeDelta: 0.016, // about 1.8 km north to south
  longitudeDelta: 0.028, // about 2.1 km east to west
};

// Used until the API server is running, so the map still shows something.
// Copies of api/src/geofence/chainLocations.ts and localShops.ts: keep them in
// sync until the app reads everything from /geofence/map-data.
export const DEMO_MAP_DATA: MapData = {
  chains: [
    { id: "sbux-15th-40th", chainName: "Starbucks", lat: 47.65466998756357, lng: -122.31173930735872 },
    { id: "sbux-campus-4000-15th", chainName: "Starbucks", lat: 47.65569017951035, lng: -122.30854416151266 },
    { id: "sbux-uvillage-a", chainName: "Starbucks", lat: 47.66276976593066, lng: -122.29672583754325 },
    { id: "sbux-ne-49th", chainName: "Starbucks", lat: 47.66461651938478, lng: -122.2989934925125 },
  ],
  shops: [
    { id: "ugly-mug-cafe", name: "Ugly Mug Cafe", lat: 47.660324981550566, lng: -122.31380745892217 },
    { id: "cafe-allegro", name: "Cafe Allegro", lat: 47.659380176123065, lng: -122.31271535088156 },
    { id: "rachels-ginger-beer", name: "Rachel's Ginger Beer", lat: 47.662922290800445, lng: -122.29956813553675 },
    { id: "mr-west-cafe-bar", name: "Mr West Cafe Bar", lat: 47.662876464676685, lng: -122.29830572797502 },
  ],
};

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} from ${url}`);
  return (await res.json()) as T;
}

/** Chains and local shops to draw as pins around a point. */
export function fetchMapData(apiBaseUrl: string, center: LatLng): Promise<MapData> {
  return getJson<MapData>(
    `${apiBaseUrl}/geofence/map-data?lat=${center.lat}&lng=${center.lng}`,
  );
}

/** Ask the server: is this location near a chain, and which local shop should we suggest? */
export function checkLocation(
  apiBaseUrl: string,
  body: { deviceId: string; lat: number; lng: number; accuracy?: number },
): Promise<CheckResult> {
  return getJson<CheckResult>(`${apiBaseUrl}/geofence/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}