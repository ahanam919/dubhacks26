import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../lib/theme';
import { Shop } from '../types';

type Props = { shops: Shop[]; onPressShop: (shop: Shop) => void };

const pct = (n: number) => `${n}%` as `${number}%`;

// Stand-in for the Google Map. Pins are placed from each shop's lat/lng so the
// layout behaves like a real map. Replace with <MapView> after the navigation works.
export default function MapPlaceholder({ shops, onPressShop }: Props) {
  const lats = shops.map((s) => s.lat);
  const lngs = shops.map((s) => s.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const spanLat = Math.max(maxLat - minLat, 0.0001);
  const spanLng = Math.max(maxLng - minLng, 0.0001);

  return (
    <View style={styles.map}>
      <View style={[styles.road, { top: '30%', transform: [{ rotate: '-8deg' }] }]} />
      <View style={[styles.road, { top: '58%', transform: [{ rotate: '5deg' }] }]} />
      <Text style={styles.note}>Map placeholder. Google Maps replaces this later.</Text>

      {shops.map((shop) => {
        const x = 12 + ((shop.lng - minLng) / spanLng) * 76;
        const y = 14 + (1 - (shop.lat - minLat) / spanLat) * 52; // stays above the search bar
        return (
          <Pressable
            key={shop.id}
            onPress={() => onPressShop(shop)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${shop.name}`}
            style={[styles.pinWrap, { left: pct(x), top: pct(y) }]}
          >
            <View style={[styles.pin, { backgroundColor: shop.is_demo ? colors.primary : colors.pinLocal }]} />
            <Text style={styles.label} numberOfLines={1}>
              {shop.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  map: { ...StyleSheet.absoluteFill, backgroundColor: '#DDE3DF', overflow: 'hidden' },
  road: {
    position: 'absolute',
    left: -30,
    right: -30,
    height: 16,
    backgroundColor: '#F7F8F6',
  },
  note: { position: 'absolute', top: 110, alignSelf: 'center', fontSize: 12, color: colors.muted },
  pinWrap: { position: 'absolute', alignItems: 'center', width: 110, marginLeft: -55, marginTop: -18 },
  pin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  label: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
    color: colors.ink,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
});
