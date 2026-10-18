import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from '../../components/Button';
import { getResultById } from '../../data/mock';
import { confirmedLabel, formatPrice, savingsLabel } from '../../lib/format';
import { colors, font, radius, spacing } from '../../lib/theme';
import { useAsync } from '../../lib/useAsync';

function goBackOrHome() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function ConfirmScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: result, loading } = useAsync(() => getResultById(id), [id]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!result) {
    return (
      <View style={styles.center}>
        <Text style={styles.heading}>Shop not found</Text>
        <Button label="Not now" variant="secondary" onPress={goBackOrHome} />
      </View>
    );
  }

  const { shop, item, comparison } = result;

  // Only tier 1 (Square connected) shops can take an order.
  if (shop.order_tier !== 1) {
    return (
      <View style={styles.center}>
        <Text style={styles.heading}>Ordering isn't available here yet</Text>
        <Text style={styles.muted}>{shop.name} doesn't take orders through the app.</Text>
        <Button label="Go back" variant="secondary" onPress={goBackOrHome} />
      </View>
    );
  }

  const onConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      // TODO (Part 3): replace this fake delay with POST /swap/confirm { proposal_id }.
      // The backend calls Square CreateOrder and returns { order_id, status }.
      await new Promise((resolve) => setTimeout(resolve, 700));
      router.replace({
        pathname: '/order/status',
        params: { id: shop.id, orderId: 'mock-order-1' },
      });
    } catch {
      setError("Couldn't place the order. Check your connection and try again.");
      setSubmitting(false);
    }
  };

  const savings = savingsLabel(comparison);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {shop.is_demo && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              Sandbox shop. This is a test order and no real money moves.
            </Text>
          </View>
        )}

        <Text style={styles.title}>Pick up at {shop.name}</Text>

        <View style={styles.panel}>
          <Text style={styles.heading}>{item.name}</Text>
          <Text style={styles.price}>{formatPrice(item.price_cents)}</Text>
          {savings && <Text style={styles.savings}>{savings} than the chain</Text>}
        </View>

        <View style={styles.panel}>
          <Text style={styles.body}>{result.distance_min} min walk</Text>
          <Text style={[styles.body, { color: result.open_now ? colors.good : colors.bad }]}>
            {result.open_now ? 'Open now' : 'Closed right now'}
          </Text>
          {/* Only state a ready time if the shop provided one. */}
          <Text style={styles.body}>
            {shop.prep_minutes ? `Ready in about ${shop.prep_minutes} min` : 'Ready time not provided'}
          </Text>
          <Text style={styles.muted}>{confirmedLabel(item)}</Text>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
        <Button label="Not now" variant="secondary" onPress={goBackOrHome} disabled={submitting} />
        <Button
          label={error ? 'Try again' : 'Confirm'}
          onPress={onConfirm}
          loading={submitting}
          disabled={!result.open_now}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: 12 },
  content: { padding: spacing.lg, gap: 12 },
  notice: { backgroundColor: colors.warnSoft, borderRadius: radius.md, padding: 12 },
  noticeText: { ...font.small, color: colors.warn },
  title: { ...font.title, color: colors.ink },
  heading: { ...font.heading, color: colors.ink },
  body: { ...font.body, color: colors.ink },
  muted: { ...font.small, color: colors.muted },
  price: { ...font.display, color: colors.ink },
  savings: { ...font.heading, color: colors.good },
  error: { ...font.body, color: colors.bad },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.line,
  },
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
