// Opens Google Maps with walking directions to a specific shop.
// No API key needed. On Android this opens the Google Maps app if it's installed,
// otherwise the browser.
// Use this everywhere a shop appears: map pins, shop cards, notification taps.

import { Linking } from "react-native";

export function walkingDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
}

export async function openWalkingDirections(lat: number, lng: number): Promise<void> {
  try {
    await Linking.openURL(walkingDirectionsUrl(lat, lng));
  } catch (err) {
    console.warn("Could not open Google Maps", err);
  }
}