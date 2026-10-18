import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getFeaturedChain, getResultById } from '../../data/mock';
import { formatDateOnly, formatPrice, visibleHook } from '../../lib/format';
import { colors, font, radius, spacing } from '../../lib/theme';
import { useAsync } from '../../lib/useAsync';

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

  // Headline: the saved comparison when there is one. Without one but with both
  // prices, just state the two prices side by side (no "you save" claim, since the
  // sizes may differ). With no local price, no headline at all.
  let headline: string | null = null;
  let tone: string = colors.muted;
  if (delta == null) {
    if (item.price_cents != null) {
      headline = `${formatPrice(item.price_cents)} here vs ${formatPrice(chain.approx_price_cents)} at ${chain.chain_name}`;
    }
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
      {headline && <Text style={[styles.headline, { color: tone }]}>{headline}</Text>}

      <View style={styles.referenceBar}>
        <View style={styles.refLeft}>
          <Text style={styles.chainName}>{chain.chain_name}</Text>
          <Text style={styles.refMeta}>{chain.size} · Reference as of {formatDateOnly(chain.as_of_date)}</Text>
        </View>
        <View style={styles.refRight}>
          <Text style={styles.refPrice}>{formatPrice(chain.approx_price_cents)}</Text>
        </View>
      </View>

      <View style={styles.localCard}>
        <View style={styles.localHeader}>
          <Text style={styles.localName}>{shop.name}</Text>
          <Text style={styles.localItem}>{item.name}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Price</Text>
            <Text style={styles.rowValue}>{formatPrice(item.price_cents)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Walk</Text>
            <Text style={styles.rowValue}>{distance_min} min</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Open</Text>
            <Text style={[styles.rowValue, !open_now && styles.closed]}>{open_now ? 'Open now' : 'Closed'}</Text>
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={styles.rowLabel}>Why go</Text>
            <Text style={styles.rowValue}>{visibleHook(shop) ?? 'No verified note yet'}</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: 8 },
  content: { padding: spacing.lg, gap: spacing.md },

  headline: { ...font.display },
  heading: { ...font.title, color: colors.ink },
  muted: { ...font.small, color: colors.muted },

  referenceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.chain,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  refLeft: { gap: 2 },
  refRight: { alignItems: 'flex-end' },
  chainName: { ...font.heading, color: colors.chainText },
  refMeta: { fontSize: 12, color: colors.chainMuted },
  refPrice: { ...font.title, color: colors.chainText },

  localCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  localHeader: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 2,
  },
  localName: { ...font.heading, color: colors.ink },
  localItem: { ...font.small, color: colors.muted },

  table: { paddingHorizontal: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowLabel: { ...font.small, color: colors.muted },
  rowValue: { ...font.body, color: colors.ink, fontWeight: '600', maxWidth: '70%', textAlign: 'right' },
  closed: { color: colors.warn },
});
