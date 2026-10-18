import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getFeaturedChain, getResultById } from '../../data/mock';
import { formatDateOnly, formatPrice, visibleHook } from '../../lib/format';
import { colors, font, radius, spacing } from '../../lib/theme';
import { useAsync } from '../../lib/useAsync';

function Row({ label, chain, local }: { label: string; chain: string; local: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.cells}>
        <Text style={[styles.cell, styles.cellChain]}>{chain}</Text>
        <Text style={[styles.cell, styles.cellLocal]}>{local}</Text>
      </View>
    </View>
  );
}

export default function CompareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading } = useAsync(
    async () => ({ result: await getResultById(id), chain: await getFeaturedChain() }),
    [id]
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!data?.result) {
    return (
      <View style={styles.center}>
        <Text style={styles.heading}>Shop not found</Text>
        <Text style={styles.muted}>Go back and pick another shop to compare.</Text>
      </View>
    );
  }

  const { result, chain } = data;
  const { shop, item, comparison, distance_min, open_now } = result;
  const delta = comparison?.delta_cents ?? null;

  // The headline is computed from data, never typed in.
  let headline: string;
  let tone: string = colors.muted;
  if (delta == null) {
    headline = "Price not listed, so we can't compare";
  } else if (delta < 0) {
    headline = `You save ${formatPrice(-delta)}`;
    tone = colors.good;
  } else if (delta > 0) {
    headline = `${formatPrice(delta)} more than the chain`;
    tone = colors.warn;
  } else {
    headline = 'Same price as the chain';
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.headline, { color: tone }]}>{headline}</Text>
      <Text style={styles.muted}>
        Chain price is a reference from {formatDateOnly(chain.as_of_date)}. Local price shown with its last check.
      </Text>

      <View style={styles.headRow}>
        <View style={styles.spacer} />
        <View style={styles.cells}>
          <Text style={[styles.cell, styles.head]}>{chain.chain_name}</Text>
          <Text style={[styles.cell, styles.head]} numberOfLines={2}>
            {shop.name}
          </Text>
        </View>
      </View>

      <View style={styles.table}>
        <Row label="Item" chain={`${chain.size}`} local={item.name} />
        <Row label="Price" chain={formatPrice(chain.approx_price_cents)} local={formatPrice(item.price_cents)} />
        <Row label="Walk" chain="Not compared" local={`${distance_min} min`} />
        <Row label="Open" chain="Not compared" local={open_now ? 'Open now' : 'Closed'} />
        <Row label="Why go" chain="Not compared" local={visibleHook(shop) ?? 'No verified note yet'} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: 8 },
  content: { padding: spacing.lg, gap: 12 },
  headline: { ...font.display },
  heading: { ...font.title, color: colors.ink },
  muted: { ...font.small, color: colors.muted },
  spacer: { width: 60 },
  headRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 8 },
  table: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowLabel: { width: 60, ...font.small, color: colors.muted },
  cells: { flex: 1, flexDirection: 'row', gap: 8 },
  cell: { flex: 1, ...font.body },
  cellChain: { color: colors.muted },
  cellLocal: { color: colors.ink, fontWeight: '600' },
  head: { ...font.heading, color: colors.ink },
});
