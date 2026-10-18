// Card that slides up from the bottom of the map when you walk into a chain's zone:
// which local shop to try instead and how far it is. "Show route" draws the way there
// on the app's own map (so you stay in the app); a second tap opens Google Maps for
// step-by-step directions.

import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from './Button';
import { directionsUrl, openUrl } from '../lib/actions';
import { formatPrice } from '../lib/format';
import { colors, font, radius, spacing } from '../lib/theme';

export type Suggestion = {
  chainName: string;
  shop: { id: string; name: string; lat: number; lng: number; walkMinutes: number; priceCents?: number | null };
  message: string;
};

type Props = {
  suggestion: Suggestion;
  /** True once the route is drawn on the map. */
  routeShown: boolean;
  /** Which swap this is since the app opened (shown after Show route), or null. */
  swapNumber?: number | null;
  onShowRoute: () => void;
  onClose: () => void;
};

export default function SuggestionCard({ suggestion, routeShown, swapNumber = null, onShowRoute, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(1)).current; // 1 = hidden below, 0 = in place

  // Slide in each time a new suggestion arrives.
  useEffect(() => {
    slide.setValue(1);
    Animated.spring(slide, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 160 }).start();
  }, [suggestion, slide]);

  const close = () => {
    Animated.timing(slide, { toValue: 1, duration: 180, useNativeDriver: true }).start(() => onClose());
  };

  const { shop, chainName, message } = suggestion;
  const minutes = `${shop.walkMinutes} min walk`;

  return (
    <Animated.View
      style={[
        styles.card,
        { paddingBottom: insets.bottom + spacing.lg },
        { transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [0, 320] }) }] },
      ]}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Near {chainName}? Try local</Text>
        <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel="Dismiss suggestion">
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>

      <Text style={styles.name} numberOfLines={1}>
        {shop.name}
      </Text>

      <View style={styles.chips}>
        <Text style={[styles.chip, styles.chipWalk]}>{minutes}</Text>
        {shop.priceCents != null && <Text style={styles.chip}>{formatPrice(shop.priceCents)}</Text>}
        {swapNumber != null && (
          <Text style={[styles.chip, styles.chipSwap]}>
            {swapNumber === 1 ? 'First local swap!' : `Local swap #${swapNumber} today`}
          </Text>
        )}
      </View>

      <Text style={styles.message}>{message}</Text>

      <View style={styles.actions}>
        {/* TODO: add "View shop" (opens /shop/[id]) once the app's shops come from the same database. */}
        <View style={styles.action}>
          {routeShown ? (
            <Button label="Open in Google Maps" onPress={() => void openUrl(directionsUrl(shop))} />
          ) : (
            <Button label="Show route" onPress={onShowRoute} />
          )}
        </View>
        <View style={styles.action}>
          <Button label="Not now" variant="secondary" onPress={close} />
        </View>
      </View>

      {routeShown && (
        <Text style={styles.hint}>The dotted line shows the way. Google Maps has step-by-step directions.</Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
    elevation: 12,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { ...font.small, color: colors.muted, fontWeight: '600' },
  close: { fontSize: 16, color: colors.muted },
  name: { ...font.title, color: colors.ink },
  chips: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    ...font.small,
    fontWeight: '600',
    color: colors.ink,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  chipWalk: { color: colors.good, backgroundColor: colors.goodSoft },
  chipSwap: { color: colors.primary, backgroundColor: colors.primarySoft },
  message: { ...font.body, color: colors.ink },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  action: { flex: 1 },
  hint: { ...font.small, color: colors.muted, textAlign: 'center' },
});
