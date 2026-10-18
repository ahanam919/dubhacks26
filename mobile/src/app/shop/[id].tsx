import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Button from '../../components/Button';
import TierBadge from '../../components/TierBadge';
import { getResultById } from '../../data/mock';
import { directionsUrl, openUrl, primaryActionFor } from '../../lib/actions';
import { confirmedLabel, formatPrice, savingsLabel, visibleHook } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { colors, radius, spacing, font } from '../../lib/theme';

export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: result, loading } = useAsync(() => getResultById(id), [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // Bad or missing id: friendly message, never a crash.
  if (!result) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Shop not found</Text>
        <Text style={styles.muted}>This shop may have been removed. Close this card and try another.</Text>
      </View>
    );
  }

  const { shop, item, comparison, distance_min, open_now } = result;
  const action = primaryActionFor(shop);
  const savings = savingsLabel(comparison);
  const cheaper = comparison != null && comparison.delta_cents < 0;
  const hook = visibleHook(shop);

  const onPrimary = () => {
    if (action.kind === 'order') {
      router.push({ pathname: '/order/confirm', params: { id: shop.id } });
    } else if (action.kind === 'link') {
      if (shop.website_url) openUrl(shop.website_url);
      else Alert.alert('No ordering link yet', 'This shop has not shared an ordering page.');
    } else {
      openUrl(directionsUrl(shop));
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* No photo area until real photos are wired up. When they are, show the
            photographer's name from photos[n].attributions with each photo (Google requires it). */}
        <Text style={styles.title}>{shop.name}</Text>
        <TierBadge tier={shop.order_tier} />
        {shop.address && <Text style={styles.muted}>{shop.address}</Text>}
        {shop.rating != null && <Text style={styles.muted}>Rated {shop.rating.toFixed(1)} out of 5</Text>}

        <View style={styles.panel}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.price}>{formatPrice(item.price_cents)}</Text>
          {savings && (
            <Text style={[styles.savings, { color: cheaper ? colors.good : colors.warn }]}>
              {savings} than the chain
            </Text>
          )}
          <Text style={styles.muted}>{confirmedLabel(item)}</Text>
        </View>

        {hook && (
          <View style={styles.panel}>
            <Text style={styles.heading}>Why go</Text>
            <Text style={styles.body}>{hook}</Text>
          </View>
        )}

        <View style={styles.panel}>
          <Text style={styles.body}>{distance_min} min walk</Text>
          <Text style={[styles.body, { color: open_now ? colors.good : colors.bad }]}>
            {open_now ? 'Open now' : 'Closed right now'}
          </Text>
          {shop.is_demo && (
            <Text style={styles.muted}>Sandbox shop for the demo. Orders are test orders.</Text>
          )}
        </View>
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
        <Button
          label="Compare to chain"
          variant="secondary"
          onPress={() => router.push({ pathname: '/compare/[id]', params: { id: shop.id } })}
        />
        <Button label={action.label} onPress={onPrimary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: 8 },
  content: { padding: spacing.lg, gap: 10 },
  title: { ...font.title, color: colors.ink },
  heading: { ...font.heading, color: colors.ink },
  body: { ...font.body, color: colors.ink },
  muted: { ...font.small, color: colors.muted },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.line,
  },
  itemName: { ...font.heading, color: colors.ink },
  price: { ...font.display, color: colors.ink },
  savings: { ...font.heading },
  bar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
});
