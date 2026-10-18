// Drag-the-pin geofence demo.
//
// - Chains are red pins, local shops are green. Tap a shop pin, then its label, for
//   walking directions.
// - Drag the blue "Pretend I'm here" pin and let go: the app asks the server whether
//   that spot is near a chain, the same check a real geofence uses, and shows the
//   suggestion as a notification (or an in-app pop-up where notifications aren't available).
// - If the API can't be reached, it falls back to built-in demo data and an
//   on-phone distance check, so the demo still works.

import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { directionsUrl, openUrl } from '../lib/actions';
import {
  type CheckResult,
  type LatLng,
  type MapData,
  type NoMatchReason,
  DEMO_CENTER,
  DEMO_MAP_DATA,
  DEMO_REGION,
  checkLocation,
  fetchMapData,
} from '../lib/geofenceApi';
import { setupNotifications, showSuggestion } from '../lib/notifications';
import { colors, font, radius, spacing } from '../lib/theme';

type Props = {
  /** Base URL of the API. Leave out to use demo data only. */
  apiBaseUrl?: string;
  /** Identifies this phone for the server's cooldown. */
  deviceId?: string;
};

// Geofence zones: quiet by default so they don't compete with the pins, a little
// stronger (in the app's accent blue) for the zone the pin is standing in.
const ZONE_IDLE = { fill: 'rgba(34, 37, 43, 0.05)', stroke: 'rgba(34, 37, 43, 0.18)' };
const ZONE_ACTIVE = { fill: 'rgba(47, 75, 219, 0.14)', stroke: 'rgba(47, 75, 219, 0.55)' };

const NO_MATCH_TEXT: Record<NoMatchReason, string> = {
  bad_request: 'That spot could not be checked.',
  inaccurate: 'Location too imprecise to check.',
  no_chain: 'Not near a chain. Drag the pin onto a red pin.',
  no_shop: 'Near a chain, but no local shop within walking distance.',
  cooldown: 'Already suggested a shop here recently.',
  quiet_hours: 'Quiet hours: no suggestions right now.',
};

export default function GeofenceMap({ apiBaseUrl, deviceId = 'demo-device' }: Props) {
  const [data, setData] = useState<MapData>(DEMO_MAP_DATA);
  const [usingDemoData, setUsingDemoData] = useState(true);
  const [pin, setPin] = useState<LatLng>(DEMO_CENTER);
  const [status, setStatus] = useState('Drag the blue pin next to a chain.');

  // The chain zone the pin is inside, if any (same 100 m radius the server uses).
  const activeChainId = useMemo(
    () => data.chains.find((c) => metersBetween(pin, c) <= CHAIN_RADIUS_M)?.id ?? null,
    [data.chains, pin],
  );

  useEffect(() => {
    // A notification problem must never take down the map, so failures are only logged.
    setupNotifications().catch((err) => console.warn('Notification setup failed', err));

    if (!apiBaseUrl) return;
    fetchMapData(apiBaseUrl)
      .then((d) => {
        setData(d);
        setUsingDemoData(false);
      })
      .catch((err) => {
        console.warn('Map data failed, using demo data', err);
        setStatus('Server not reachable, showing demo data.');
      });
  }, [apiBaseUrl]);

  async function onPinDropped(spot: LatLng) {
    setPin(spot);
    setStatus('Checking…');
    try {
      const result =
        apiBaseUrl && !usingDemoData
          ? await checkLocation(apiBaseUrl, { deviceId, lat: spot.lat, lng: spot.lng, accuracy: 10, simulated: true })
          : demoCheck(spot, data);

      if (!result.match) {
        setStatus(NO_MATCH_TEXT[result.reason ?? 'no_chain']);
        return;
      }
      setStatus(`Near ${result.chain.name}: suggesting ${result.shop.name}`);
      await showSuggestion({
        title: `Near ${result.chain.name}?`,
        message: result.message,
        shopId: result.shop.id,
        lat: result.shop.lat,
        lng: result.shop.lng,
      });
    } catch (err) {
      console.warn('Geofence check failed', err);
      setStatus('Check failed. Is the server running?');
    }
  }

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFill}
        // Google Maps on Android. On iPhone, Apple Maps (Google's map engine on
        // iPhone needs extra setup in a development build).
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={DEMO_REGION}
        showsUserLocation
      >
        {data.chains.map((c) => {
          const zone = c.id === activeChainId ? ZONE_ACTIVE : ZONE_IDLE;
          return (
            <Circle
              key={`zone-${c.id}`}
              center={{ latitude: c.lat, longitude: c.lng }}
              radius={CHAIN_RADIUS_M}
              fillColor={zone.fill}
              strokeColor={zone.stroke}
              strokeWidth={1}
              zIndex={0}
            />
          );
        })}

        {data.chains.map((c) => (
          <Marker key={c.id} coordinate={{ latitude: c.lat, longitude: c.lng }} title={c.chainName} pinColor="tomato" />
        ))}

        {data.shops.map((s) => (
          <Marker
            key={s.id}
            coordinate={{ latitude: s.lat, longitude: s.lng }}
            title={s.name}
            description="Tap here for walking directions"
            pinColor="green"
            onCalloutPress={() => void openUrl(directionsUrl(s))}
          />
        ))}

        <Marker
          coordinate={{ latitude: pin.lat, longitude: pin.lng }}
          title="Pretend I'm here"
          pinColor="blue"
          draggable
          onDragEnd={(e) =>
            void onPinDropped({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })
          }
        />
      </MapView>

      <View style={styles.statusBox}>
        {usingDemoData && <Text style={styles.demoTag}>DEMO DATA</Text>}
        <Text style={styles.statusText}>{status}</Text>
      </View>
    </View>
  );
}

// --- Demo-mode check (only used when the API can't be reached) -------------------
// A tiny copy of the server logic so the screen still works offline.

const CHAIN_RADIUS_M = 100;
const WALK_RADIUS_M = 800;

function metersBetween(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function demoCheck(spot: LatLng, data: MapData): CheckResult {
  const chain = data.chains.find((c) => metersBetween(spot, c) <= CHAIN_RADIUS_M);
  if (!chain) return { match: false, reason: 'no_chain' };

  const nearest = data.shops
    .map((s) => ({ s, d: metersBetween(spot, s) }))
    .filter((x) => x.d <= WALK_RADIUS_M)
    .sort((a, b) => a.d - b.d)[0];
  if (!nearest) return { match: false, reason: 'no_shop' };

  const walkMinutes = Math.max(1, Math.ceil(nearest.d / 80));
  return {
    match: true,
    chain: { id: chain.id, name: chain.chainName },
    shop: { id: nearest.s.id, name: nearest.s.name, walkMinutes, lat: nearest.s.lat, lng: nearest.s.lng },
    message: `${nearest.s.name} is ${walkMinutes} min away. Tap for directions.`,
  };
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  statusBox: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: 32,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  demoTag: { fontSize: 11, fontWeight: '700', color: colors.warn, marginBottom: 4 },
  statusText: { ...font.body, color: colors.ink },
});
