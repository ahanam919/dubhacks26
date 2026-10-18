import { KeyboardAvoidingView, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import MapPlaceholder from '../components/MapPlaceholder';
import SearchBar from '../components/SearchBar';
import { getMapShops } from '../data/mock';
import { useAsync } from '../lib/useAsync';
import { colors, radius } from '../lib/theme';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { data: shops } = useAsync(getMapShops, []);

  return (
    <View style={styles.screen}>
      <MapPlaceholder
        shops={shops ?? []}
        onPressShop={(shop) => router.push({ pathname: '/shop/[id]', params: { id: shop.id } })}
      />

      {/* Dev shortcut to the simulated-location screen. Remove before the final demo if you like. */}
      <Pressable
        style={[styles.dev, { top: insets.top + 8 }]}
        onPress={() => router.push('/dev/simulate')}
        accessibilityRole="button"
        accessibilityLabel="Open simulated location"
      >
        <Text style={styles.devText}>Simulate</Text>
      </Pressable>

      {/* Search bar sits at the bottom, as in the sketch, and rides above the keyboard. */}
      <KeyboardAvoidingView behavior="padding" style={styles.bottom}>
        <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 12 }}>
          <SearchBar
            onSubmit={(q) => router.push({ pathname: '/results', params: { q } })}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  dev: {
    position: 'absolute',
    right: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.line,
  },
  devText: { fontSize: 13, fontWeight: '600', color: colors.muted },
});
