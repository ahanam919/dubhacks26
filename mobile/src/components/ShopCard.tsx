import { Pressable, StyleSheet, Text, View } from 'react-native';
import { confirmedLabel, formatPrice, savingsLabel, visibleHook } from '../lib/format';
import { colors, font, radius } from '../lib/theme';
import { SearchResult } from '../types';
import TierBadge from './TierBadge';

type Props = { result: SearchResult; onPress: () => void };

// Compact card for the results list. Opens the full shop card when tapped.
export default function ShopCard({ result, onPress }: Props) {
  const { shop, item, comparison, distance_min, open_now } = result;
  const savings = savingsLabel(comparison);
  const cheaper = comparison != null && comparison.delta_cents < 0;
  const hook = visibleHook(shop); // null unless verified

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${shop.name}, ${item.name}, ${formatPrice(item.price_cents)}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Text style={styles.name} numberOfLines={2}>
        {shop.name}
      </Text>
      <TierBadge tier={shop.order_tier} />

      <Text style={styles.item} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={styles.price}>{formatPrice(item.price_cents)}</Text>

      {savings && (
        <View style={[styles.pill, cheaper ? styles.pillGood : styles.pillWarn]}>
          <Text style={[styles.pillText, { color: cheaper ? colors.good : colors.warn }]}>
            {savings}
          </Text>
        </View>
      )}

      {hook && (
        <Text style={styles.hook} numberOfLines={2}>
          {hook}
        </Text>
      )}

      <View style={styles.meta}>
        <Text style={styles.metaText}>{distance_min} min walk</Text>
        <Text style={[styles.metaText, { color: open_now ? colors.good : colors.bad }]}>
          {open_now ? 'Open now' : 'Closed'}
        </Text>
        <Text style={styles.metaText}>{confirmedLabel(item)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pressed: { opacity: 0.85 },
  name: { ...font.heading, color: colors.ink },
  item: { ...font.small, color: colors.muted, marginTop: 4 },
  price: { ...font.title, color: colors.ink },
  pill: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  pillGood: { backgroundColor: colors.goodSoft },
  pillWarn: { backgroundColor: colors.warnSoft },
  pillText: { fontSize: 13, fontWeight: '700' },
  hook: { ...font.small, color: colors.ink, fontStyle: 'italic' },
  meta: { gap: 2, marginTop: 4 },
  metaText: { fontSize: 12, color: colors.muted },
});
