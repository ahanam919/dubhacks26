import { Alert, Linking } from 'react-native';
import { Shop } from '../types';

export type PrimaryAction = { kind: 'order' | 'link' | 'directions'; label: string };

// The one place that decides which button a shop gets. Changing tiers later is a one-place edit.
export function primaryActionFor(shop: Shop): PrimaryAction {
  switch (shop.order_tier) {
    case 1:
      return { kind: 'order', label: 'Order pickup' };
    case 2:
      return { kind: 'link', label: 'Order link' };
    default:
      return { kind: 'directions', label: 'Directions' };
  }
}

// Walking directions in Google Maps. Takes anything with lat/lng (a shop, a map pin).
export function directionsUrl(place: Pick<Shop, 'lat' | 'lng'>): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}&travelmode=walking`;
}

export async function openUrl(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Could not open the link', url);
  }
}
