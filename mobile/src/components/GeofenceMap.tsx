// Drag-the-pin geofence demo.
//
// - Chains are red pins, local shops are green. Tap a shop pin, then its label, for
//   walking directions.
// - Tap anywhere on the map (or drag the blue pin) to move "you": the app asks the server whether
//   that spot is near a chain, the same check a real geofence uses, and shows the
//   suggestion in a card that slides up from the bottom. (Real background geofencing
//   would use lib/notifications.ts instead, since the app isn't open then.)
// - When the app opens (and whenever you're not near a chain), the card shows the
//   closest local coffee shop to you instead.
// - If the API can't be reached, it falls back to built-in demo data and an
//   on-phone distance check, so the demo still works.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, type TextStyle, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Circle, Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useFocusEffect } from 'expo-router';
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
  no_chain: 'Not near a chain, and no local coffee close by.',
  no_shop: 'Near a chain, but no local shop within walking distance.',
  cooldown: 'Already suggested a shop here recently.',
  quiet_hours: 'Quiet hours: no suggestions right now.',
};

export default function GeofenceMap({ apiBaseUrl, deviceId = 'demo-device' }: Props) {
  const [data, setData] = useState<MapData>(DEMO_MAP_DATA);
  const [usingDemoData, setUsingDemoData] = useState(true);
  const [pin, setPin] = useState<LatLng>(DEMO_CENTER);
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState('Loading the map…');
  // True once the map data has loaded (or failed and fell back to demo data).
  const [dataReady, setDataReady] = useState(!apiBaseUrl);
  const [suggestedShopId, setSuggestedShopId] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  // Walking path drawn on this map (straight line from you to the suggested shop).
  const [route, setRoute] = useState<{ from: LatLng; to: LatLng } | null>(null);
  const mapRef = useRef<MapView>(null);
  // Swap counter: how many times you took a suggestion (tapped Show route) since the
  // app opened. Kept in memory for now; saving it across launches needs storage.
  const [swapCount, setSwapCount] = useState(0);
  const [countedThisSuggestion, setCountedThisSuggestion] = useState(false);

  // The chain zone the pin is inside, if any (same radius the server uses).
  // Android bug: custom pins are drawn as pictures, and when you leave this screen
  // (e.g. to Simulate) and come back, some of those pictures get lost and the pins
  // fall back to Google's default red pin. Bumping this number every time the screen
  // comes back into view makes every pin redraw itself.
  const [pinEpoch, setPinEpoch] = useState(0);
  useFocusEffect(useCallback(() => setPinEpoch((n) => n + 1), []));

  const activeChainId = useMemo(() => nearestChainWithin(pin, data)?.id ?? null, [data, pin]);

  useEffect(() => {
    if (!apiBaseUrl) return;
    fetchMapData(apiBaseUrl)
      .then((d) => {
        setData(d);
        setUsingDemoData(false);
      })
      .catch((err) => {
        console.warn('Map data failed, using demo data', err);
      })
      .finally(() => setDataReady(true));
  }, [apiBaseUrl]);

  // As soon as the map has its data, suggest the closest local coffee to where you are.
  const shownOnOpen = useRef(false);
  useEffect(() => {
    if (!dataReady || shownOnOpen.current) return;
    shownOnOpen.current = true;
    if (!showClosestCoffee(pin)) setStatus('Tap the map near a chain to move your pin.');
    // Only on open: later updates come from moving the pin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataReady]);

  // Not near a chain: show the closest local coffee shop instead. Returns false if
  // there's none within reach (e.g. you tapped far outside the demo area).
  function showClosestCoffee(spot: LatLng): boolean {
    const closest = closestCoffee(spot, data);
    if (!closest) {
      setSuggestedShopId(null);
      return false;
    }
    setSuggestedShopId(closest.shop.id);
    setStatus(`Closest local coffee: ${closest.shop.name}`);
    setSuggestion(closest);
    return true;
  }

  async function onPinDropped(spot: LatLng) {
    setPin(spot);
    setSuggestion(null);
    setRoute(null);
    setCountedThisSuggestion(false);
    setStatus('Checking…');
    try {
      const result =
        apiBaseUrl && !usingDemoData
          ? await checkLocation(apiBaseUrl, { deviceId, lat: spot.lat, lng: spot.lng, accuracy: 10, simulated: true })
          : demoCheck(spot, data);

      if (!result.match) {
        const reason = result.reason ?? 'no_chain';
        // Not near a chain: still point you to the closest local coffee.
        if (reason === 'no_chain' && showClosestCoffee(spot)) return;
        setSuggestedShopId(null);
        setStatus(NO_MATCH_TEXT[reason]);
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

  // Draw the path to the suggested shop and zoom so both you and the shop are in view,
  // leaving room at the bottom for the card.
  function showRoute() {
    if (!suggestion) return;
    const to = { lat: suggestion.shop.lat, lng: suggestion.shop.lng };
    setRoute({ from: pin, to });
    if (!countedThisSuggestion) {
      setSwapCount((n) => n + 1);
      setCountedThisSuggestion(true);
    }
    mapRef.current?.fitToCoordinates(
      [
        { latitude: pin.lat, longitude: pin.lng },
        { latitude: to.lat, longitude: to.lng },
      ],
      { edgePadding: { top: 140, right: 80, bottom: 420, left: 80 }, animated: true },
    );
  }

  // Zoom in or out one step. Google Maps (Android) zooms by level; Apple Maps (iPhone)
  // works by camera height instead, so halve or double that.
  async function zoomBy(step: 1 | -1) {
    const map = mapRef.current;
    if (!map) return;
    const camera = await map.getCamera();
    if (camera.zoom != null) {
      map.animateCamera({ zoom: Math.min(20, Math.max(3, camera.zoom + step)) }, { duration: 250 });
    } else if (camera.altitude != null) {
      map.animateCamera({ altitude: camera.altitude * (step > 0 ? 0.5 : 2) }, { duration: 250 });
    }
  }

  function recenter() {
    mapRef.current?.animateToRegion(DEMO_REGION, 400);
  }

  function closeSuggestion() {
    setSuggestion(null);
    setRoute(null);
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        // Google Maps on Android. On iPhone, Apple Maps (Google's map engine on
        // iPhone needs extra setup in a development build).
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={DEMO_REGION}
        showsUserLocation
        // Tap anywhere to move your pin there (taps on pins are ignored).
        onPress={(e) => {
          if (e.nativeEvent.action === 'marker-press') return;
          const { latitude, longitude } = e.nativeEvent.coordinate;
          void onPinDropped({ lat: latitude, lng: longitude });
        }}
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

        {route && (
          <Polyline
            coordinates={[
              { latitude: route.from.lat, longitude: route.from.lng },
              { latitude: route.to.lat, longitude: route.to.lng },
            ]}
            strokeColor={colors.good}
            strokeWidth={4}
            lineDashPattern={[12, 10]}
            geodesic
            zIndex={2}
          />
        )}

        {data.chains.map((c) => (
          <Marker
            key={`${c.id}-${pinEpoch}`}
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
              key={`${s.id}-${suggested ? 'on' : 'off'}-${pinEpoch}`}
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
          key={`you-${pinEpoch}`}
          coordinate={{ latitude: pin.lat, longitude: pin.lng }}
          title="Pretend I'm here"
          description="Tap the map to move me, or press and hold to drag"
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

      {/* Legend */}
      <View style={[styles.legend, { top: insets.top + 8 }]} pointerEvents="none">
        <LegendItem color={colors.primary} label="You" />
        <LegendItem color={colors.ink} label="Local" />
        <LegendItem color={colors.chainMuted} label="Chain" />
      </View>

      {/* Map controls: zoom in/out, and back to the whole area */}
      {!suggestion && (
        <View style={styles.controls}>
          <View style={styles.zoomGroup}>
            <Pressable
              style={styles.zoomButton}
              onPress={() => void zoomBy(1)}
              accessibilityRole="button"
              accessibilityLabel="Zoom in"
              hitSlop={4}
            >
              <Text style={styles.zoomText}>+</Text>
            </Pressable>
            <View style={styles.zoomDivider} />
            <Pressable
              style={styles.zoomButton}
              onPress={() => void zoomBy(-1)}
              accessibilityRole="button"
              accessibilityLabel="Zoom out"
              hitSlop={4}
            >
              <Text style={styles.zoomText}>−</Text>
            </Pressable>
          </View>
          <Pressable
            style={styles.recenter}
            onPress={recenter}
            accessibilityRole="button"
            accessibilityLabel="Show the whole area"
          >
            <Text style={styles.recenterText}>Recenter</Text>
          </Pressable>
        </View>
      )}

      {suggestion ? (
        <SuggestionCard
          suggestion={suggestion}
          routeShown={route != null}
          swapNumber={countedThisSuggestion ? swapCount : null}
          onShowRoute={showRoute}
          onClose={closeSuggestion}
        />
      ) : (
        <View style={styles.statusBox}>
          {usingDemoData && <Text style={styles.demoTag}>DEMO DATA</Text>}
          <Text style={styles.statusText}>{status}</Text>
        </View>
      )}
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
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

// Keep CHAIN_RADIUS_M in sync with api/src/geofence/distance.ts.
const CHAIN_RADIUS_M = 200;
const WALK_RADIUS_M = 800;
const WALK_M_PER_MIN = 80;
// The "closest local coffee" card is skipped if the nearest shop is farther than this.
const CLOSEST_MAX_M = 2000;
// Shops on the map that aren't coffee, so "closest coffee" never picks them.
// TODO: replace with a category field on shops once the database has one.
const NOT_COFFEE_IDS = new Set(['rachels-ginger-beer']);

function walkMinutes(meters: number): number {
  return Math.max(1, Math.ceil(meters / WALK_M_PER_MIN));
}

/** The nearest chain within CHAIN_RADIUS_M (zones can overlap, so nearest wins). */
function nearestChainWithin(spot: LatLng, data: MapData) {
  let best: { c: MapData['chains'][number]; d: number } | null = null;
  for (const c of data.chains) {
    const d = metersBetween(spot, c);
    if (d <= CHAIN_RADIUS_M && (!best || d < best.d)) best = { c, d };
  }
  return best?.c ?? null;
}

/** The closest local coffee shop to `spot`, as a card suggestion, or null if none is in reach. */
function closestCoffee(spot: LatLng, data: MapData): Suggestion | null {
  const nearest = data.shops
    .filter((s) => !NOT_COFFEE_IDS.has(s.id))
    .map((s) => ({ s, d: metersBetween(spot, s) }))
    .sort((a, b) => a.d - b.d)[0];
  if (!nearest || nearest.d > CLOSEST_MAX_M) return null;
  const minutes = walkMinutes(nearest.d);
  return {
    chainName: null,
    shop: { id: nearest.s.id, name: nearest.s.name, lat: nearest.s.lat, lng: nearest.s.lng, walkMinutes: minutes },
    message: `${nearest.s.name} is the closest local coffee, ${minutes} min on foot. Skip the chain line.`,
  };
}

function metersBetween(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function demoCheck(spot: LatLng, data: MapData): CheckResult {
  const chain = nearestChainWithin(spot, data);
  if (!chain) return { match: false, reason: 'no_chain' };

  const nearest = data.shops
    .map((s) => ({ s, d: metersBetween(spot, s) }))
    .filter((x) => x.d <= WALK_RADIUS_M)
    .sort((a, b) => a.d - b.d)[0];
  if (!nearest) return { match: false, reason: 'no_shop' };

  const minutes = walkMinutes(nearest.d);
  return {
    match: true,
    chain: { id: chain.id, name: chain.chainName },
    shop: { id: nearest.s.id, name: nearest.s.name, walkMinutes: minutes, lat: nearest.s.lat, lng: nearest.s.lng },
    message: `${nearest.s.name} is ${minutes} min away. Tap for directions.`,
  };
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  legend: {
    position: 'absolute',
    left: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: colors.line,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: '#FFFFFF' },
  legendText: { fontSize: 12, fontWeight: '600', color: colors.ink },
  controls: {
    position: 'absolute',
    right: spacing.lg,
    bottom: 120,
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  zoomGroup: {
    width: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
    elevation: 3,
  },
  zoomButton: { height: 44, alignItems: 'center', justifyContent: 'center' },
  zoomDivider: { height: 1, backgroundColor: colors.line },
  zoomText: { fontSize: 22, fontWeight: '500', color: colors.ink, lineHeight: 26 },
  recenter: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    elevation: 3,
  },
  recenterText: { fontSize: 13, fontWeight: '600', color: colors.primary },
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
