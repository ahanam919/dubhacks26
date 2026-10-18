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

export function directionsUrl(shop: Shop): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lng}`;
}

export async function openUrl(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Could not open the link', url);
  }
}
