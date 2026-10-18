import { KeyboardAvoidingView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import MapPlaceholder from '../components/MapPlaceholder';
import SearchBar from '../components/SearchBar';
import { getMapShops } from '../data/mock';
import { useAsync } from '../lib/useAsync';
import { colors } from '../lib/theme';

// Search and browse: the map placeholder with the search bar. Opened from the
// "Simulate" button on the home map (src/app/index.tsx).
export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { data: shops } = useAsync(getMapShops, []);

  return (
    <View style={styles.screen}>
      <MapPlaceholder
        shops={shops ?? []}
        onPressShop={(shop) => router.push({ pathname: '/shop/[id]', params: { id: shop.id } })}
      />

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
});
