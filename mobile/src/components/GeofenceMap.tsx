// Drag-the-pin geofence demo.
//
// - Chains are red pins, local shops are green. Tap a shop pin, then its label, for
//   walking directions.
// - Drag the blue "Pretend I'm here" pin and let go: the app asks the server whether
//   that spot is near a chain, the same check a real geofence uses, and shows the
//   suggestion in a card that slides up from the bottom. (Real background geofencing
//   would use lib/notifications.ts instead, since the app isn't open then.)
// - If the API can't be reached, it falls back to built-in demo data and an
//   on-phone distance check, so the demo still works.

import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, type TextStyle, View } from 'react-native';
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
import { colors, font, radius, spacing } from '../lib/theme';
import SuggestionCard, { type Suggestion } from './SuggestionCard';

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
  no_chain: 'Not near a chain. Drag your blue pin onto a grey chain pin.',
  no_shop: 'Near a chain, but no local shop within walking distance.',
  cooldown: 'Already suggested a shop here recently.',
  quiet_hours: 'Quiet hours: no suggestions right now.',
};

export default function GeofenceMap({ apiBaseUrl, deviceId = 'demo-device' }: Props) {
  const [data, setData] = useState<MapData>(DEMO_MAP_DATA);
  const [usingDemoData, setUsingDemoData] = useState(true);
  const [pin, setPin] = useState<LatLng>(DEMO_CENTER);
  const [status, setStatus] = useState('Drag the blue pin next to a chain.');
  const [suggestedShopId, setSuggestedShopId] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

  // The chain zone the pin is inside, if any (same 100 m radius the server uses).
  const activeChainId = useMemo(
    () => data.chains.find((c) => metersBetween(pin, c) <= CHAIN_RADIUS_M)?.id ?? null,
    [data.chains, pin],
  );

  useEffect(() => {
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
    setSuggestion(null);
    setStatus('Checking…');
    try {
      const result =
        apiBaseUrl && !usingDemoData
          ? await checkLocation(apiBaseUrl, { deviceId, lat: spot.lat, lng: spot.lng, accuracy: 10, simulated: true })
          : demoCheck(spot, data);

      if (!result.match) {
        setSuggestedShopId(null);
        setStatus(NO_MATCH_TEXT[result.reason ?? 'no_chain']);
        return;
      }
      setSuggestedShopId(result.shop.id);
      setStatus(`Near ${result.chain.name}: suggesting ${result.shop.name}`);
      setSuggestion({ chainName: result.chain.name, shop: result.shop, message: result.message });
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
          <Marker
            key={c.id}
            coordinate={{ latitude: c.lat, longitude: c.lng }}
            title={c.chainName}
            anchor={pinAnchor(22)}
            zIndex={1}
          >
            <Teardrop size={22} color={colors.chainMuted} />
          </Marker>
        ))}

        {data.shops.map((s) => {
          const suggested = s.id === suggestedShopId;
          return (
            <Marker
              // The key includes the highlight so Android redraws the pin when it changes.
              key={`${s.id}-${suggested ? 'on' : 'off'}`}
              coordinate={{ latitude: s.lat, longitude: s.lng }}
              title={s.name}
              description="Tap here for walking directions"
              anchor={pinAnchor(suggested ? 36 : 28, true)}
              zIndex={suggested ? 3 : 2}
              onCalloutPress={() => void openUrl(directionsUrl(s))}
            >
              <Teardrop
                size={suggested ? 36 : 28}
                color={suggested ? colors.good : colors.ink}
                label={s.name}
                labelStyle={suggested ? pinStyles.labelSuggested : undefined}
              />
            </Marker>
          );
        })}

        <Marker
          coordinate={{ latitude: pin.lat, longitude: pin.lng }}
          title="Pretend I'm here"
          description="Press and hold, then drag"
          anchor={pinAnchor(30)}
          zIndex={4}
          draggable
          onDragEnd={(e) =>
            void onPinDropped({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })
          }
        >
          <Teardrop size={30} color={colors.primary} />
        </Marker>
      </MapView>

      {suggestion ? (
        <SuggestionCard suggestion={suggestion} onClose={() => setSuggestion(null)} />
      ) : (
        <View style={styles.statusBox}>
          {usingDemoData && <Text style={styles.demoTag}>DEMO DATA</Text>}
          <Text style={styles.statusText}>{status}</Text>
        </View>
      )}
    </View>
  );
}

// --- Pins ---------------------------------------------------------------------------
// Classic teardrop map pins in the app's colors: you = blue, local shops = dark,
// chains = light grey (they fade back), the suggested shop = bigger and green.

// The pin is drawn in a square box (plus room for a name label below it). The marker
// is anchored at the pin's point, so the point (not the middle) lands on the exact spot.
const PIN_BOX = 1.3; // box size as a multiple of the pin size
const PIN_TOP = 0.05; // gap above the pin, as a multiple of the pin size
const LABEL_W = 120;
const LABEL_H = 20;

function pinAnchor(size: number, withLabel = false) {
  const height = size * PIN_BOX + (withLabel ? LABEL_H : 0);
  return { x: 0.5, y: ((PIN_TOP + 0.5 + Math.SQRT1_2) * size) / height };
}

function Teardrop({
  size,
  color,
  label,
  labelStyle,
}: {
  size: number;
  color: string;
  label?: string;
  labelStyle?: TextStyle;
}) {
  const half = size / 2;
  const box = size * PIN_BOX;
  return (
    <View style={{ width: label ? Math.max(LABEL_W, box) : box, height: box + (label ? LABEL_H : 0), alignItems: 'center' }}>
      <View
        style={[
          pinStyles.drop,
          {
            top: size * PIN_TOP,
            width: size,
            height: size,
            backgroundColor: color,
            borderTopLeftRadius: half,
            borderTopRightRadius: half,
            borderBottomLeftRadius: half,
          },
        ]}
      >
        <View style={{ width: size * 0.34, height: size * 0.34, borderRadius: half, backgroundColor: '#FFFFFF' }} />
      </View>
      {label ? (
        <Text style={[pinStyles.label, { top: box }, labelStyle]} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
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

const pinStyles = StyleSheet.create({
  drop: {
    position: 'absolute',
    borderBottomRightRadius: 0, // the sharp corner becomes the point after rotating
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  label: {
    position: 'absolute',
    maxWidth: LABEL_W,
    fontSize: 11,
    fontWeight: '600',
    color: colors.ink,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  labelSuggested: { color: colors.good, fontWeight: '700' },
});
