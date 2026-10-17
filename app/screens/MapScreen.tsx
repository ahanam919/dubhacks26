// Map screen for Local Swap.
//
// - Shows chains (red pins) and local shops (green pins) around the Ave.
// - Tapping a shop pin, then its label, opens Google Maps walking directions.
// - The blue "Pretend I'm here" pin can be dragged. When you let go, the app asks the
//   server whether that spot is near a chain; if so, it shows the suggestion notification.
//   This is the demo path.
//
// Works before the server exists: with no apiBaseUrl it uses DEMO_MAP_DATA and a
// simple on-phone distance check, so the notification flow can be tested early.
//
// Not tied to any navigation library: render <MapScreen apiBaseUrl="https://..." />
// from whatever screen setup the app uses (expo-router or React Navigation).

import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { openWalkingDirections } from "../lib/directions";
import {
  type CheckResult,
  type LatLng,
  type MapData,
  DEMO_MAP_DATA,
  THE_AVE,
  checkLocation,
  fetchMapData,
} from "../lib/geofenceApi";
import { setupNotifications, showSuggestion } from "../lib/notifications";

interface Props {
  /** Base URL of our API, e.g. "https://api.example.com". Leave out to use demo data. */
  apiBaseUrl?: string;
  /** Identifies this phone for the server's cooldown. */
  deviceId?: string;
}

// Starts a bit south of the chain so the first drag "walks" toward it.
const START_PIN: LatLng = { lat: THE_AVE.lat - 0.0025, lng: THE_AVE.lng };

export default function MapScreen({ apiBaseUrl, deviceId = "demo-device" }: Props) {
  const [data, setData] = useState<MapData>(DEMO_MAP_DATA);
  const [usingDemoData, setUsingDemoData] = useState(true);
  const [pin, setPin] = useState<LatLng>(START_PIN);
  const [status, setStatus] = useState("Drag the blue pin next to a chain.");

  useEffect(() => {
    void setupNotifications();

    if (!apiBaseUrl) return;
    fetchMapData(apiBaseUrl, THE_AVE)
      .then((d) => {
        setData(d);
        setUsingDemoData(false);
      })
      .catch((err) => {
        console.warn("Map data failed, using demo data", err);
        setStatus("Server not reachable, showing demo data.");
      });
  }, [apiBaseUrl]);

  async function onPinDropped(spot: LatLng) {
    setPin(spot);
    setStatus("Checking…");
    try {
      const result =
        apiBaseUrl && !usingDemoData
          ? await checkLocation(apiBaseUrl, { deviceId, lat: spot.lat, lng: spot.lng, accuracy: 10 })
          : demoCheck(spot, data);

      if (!result.match) {
        setStatus("Not near a chain (or already notified recently).");
        return;
      }
      setStatus(`Near ${result.chain.name} → suggesting ${result.shop.name}`);
      await showSuggestion({
        title: `Near ${result.chain.name}?`,
        message: result.message,
        shopId: result.shop.id,
        lat: result.shop.lat,
        lng: result.shop.lng,
      });
    } catch (err) {
      console.warn("Geofence check failed", err);
      setStatus("Check failed. Is the server running?");
    }
  }

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: THE_AVE.lat,
          longitude: THE_AVE.lng,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        }}
        showsUserLocation
      >
        {data.chains.map((c) => (
          <Marker
            key={c.id}
            coordinate={{ latitude: c.lat, longitude: c.lng }}
            title={c.chainName}
            pinColor="tomato"
          />
        ))}

        {data.shops.map((s) => (
          <Marker
            key={s.id}
            coordinate={{ latitude: s.lat, longitude: s.lng }}
            title={s.name}
            description="Tap here for walking directions"
            pinColor="green"
            onCalloutPress={() => void openWalkingDirections(s.lat, s.lng)}
          />
        ))}

        <Marker
          coordinate={{ latitude: pin.lat, longitude: pin.lng }}
          title="Pretend I'm here"
          pinColor="blue"
          draggable
          onDragEnd={(e) =>
            void onPinDropped({
              lat: e.nativeEvent.coordinate.latitude,
              lng: e.nativeEvent.coordinate.longitude,
            })
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

// --- Demo-mode check (only used before the server is connected) -----------------------
// A tiny copy of the server logic so the screen can be tested on its own.
// The real decision (ranking, cooldown, verified message) happens on the server.

const CHAIN_RADIUS_M = 100;
const WALK_RADIUS_M = 800;

function metersBetween(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function demoCheck(spot: LatLng, data: MapData): CheckResult {
  const chain = data.chains.find((c) => metersBetween(spot, c) <= CHAIN_RADIUS_M);
  if (!chain) return { match: false };

  const shop = data.shops
    .map((s) => ({ s, d: metersBetween(spot, s) }))
    .filter((x) => x.d <= WALK_RADIUS_M)
    .sort((a, b) => a.d - b.d)[0];
  if (!shop) return { match: false };

  const walkMinutes = Math.max(1, Math.ceil(shop.d / 80));
  return {
    match: true,
    chain: { id: chain.id, name: chain.chainName },
    shop: { id: shop.s.id, name: shop.s.name, walkMinutes, lat: shop.s.lat, lng: shop.s.lng },
    message: `${shop.s.name} is ${walkMinutes} min away. Tap for directions.`,
  };
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  statusBox: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 32,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  demoTag: { fontSize: 11, fontWeight: "700", color: "#b45309", marginBottom: 4 },
  statusText: { fontSize: 15, color: "#111" },
});