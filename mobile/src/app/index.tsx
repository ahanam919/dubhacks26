import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import GeofenceMap from '../components/GeofenceMap';
import { API_URL } from '../lib/config';
import { colors, radius } from '../lib/theme';

// Home: the real Google map with chains and local shops from the API, plus the
// drag-the-pin geofence check. "Simulate" opens search and browse (explore.tsx).
export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <GeofenceMap apiBaseUrl={API_URL} />

      <Pressable
        style={[styles.button, { top: insets.top + 8 }]}
        onPress={() => router.push('/explore')}
        accessibilityRole="button"
        accessibilityLabel="Open search and browse"
      >
        <Text style={styles.buttonText}>Simulate</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  button: {
    position: 'absolute',
    right: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.line,
  },
  buttonText: { fontSize: 14, fontWeight: '600', color: colors.primary },
});
