import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import ChainColumn from '../components/ChainColumn';
import RankChips from '../components/RankChips';
import SearchBar from '../components/SearchBar';
import ShopCard from '../components/ShopCard';
import { search } from '../data/mock';
import { rankResults } from '../lib/rank';
import { useAsync } from '../lib/useAsync';
import { colors, spacing, font } from '../lib/theme';
import { RankFactor } from '../types';

export default function ResultsScreen() {
  const insets = useSafeAreaInsets();
  const { q } = useLocalSearchParams<{ q: string }>();
  const query = q ?? '';

  // Sort state lives here, so it survives opening and closing the shop modal.
  const [factor, setFactor] = useState<RankFactor>('price');
  const { data, loading, error } = useAsync(() => search(query), [query]);

  const ranked = useMemo(() => (data ? rankResults(data.results, factor) : []), [data, factor]);

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <SearchBar
          initialValue={query}
          onSubmit={(next) => router.setParams({ q: next })}
        />
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {!loading && error && (
        <View style={styles.center}>
          <Text style={styles.message}>Couldn't load results. {error}</Text>
        </View>
      )}

      {!loading && !error && data && (
        <View style={styles.columns}>
          <ChainColumn chain={data.chain} conceptName={data.concept?.name ?? null} />
          <RankChips value={factor} onChange={setFactor} />
          <FlatList
            data={ranked}
            keyExtractor={(r) => r.shop.id}
            renderItem={({ item }) => (
              <ShopCard
                result={item}
                onPress={() =>
                  router.push({ pathname: '/shop/[id]', params: { id: item.shop.id } })
                }
              />
            )}
            contentContainerStyle={{ gap: 10, paddingBottom: insets.bottom + 16 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={styles.message}>
                No local shops found for "{query}". Try a different craving.
              </Text>
            }
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  top: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  columns: { flex: 1, paddingHorizontal: spacing.lg, gap: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  message: { ...font.body, color: colors.muted, textAlign: 'center' },
});
