import { router } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';
import Button from '../../components/Button';
import { getGeofenceMessage } from '../../data/mock';
import { colors, font, spacing } from '../../lib/theme';

// Placeholder for the draggable-pin screen. For now, one button previews the push message.
// Later: drag a pin next to a chain and call the same server endpoint the real geofence uses.
export default function SimulateScreen() {
  const onSimulate = async () => {
    const msg = await getGeofenceMessage();
    Alert.alert('Starbucks nearby', msg.message, [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'View shop',
        onPress: () => router.push({ pathname: '/shop/[id]', params: { id: msg.shop_id } }),
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Simulate walking past a chain</Text>
      <Text style={styles.muted}>
        This stands in for a real geofence, which is unreliable in a crowded hall. The draggable pin
        comes later. For now, preview the suggestion and tap through to the shop.
      </Text>
      <Button label="Simulate walking past Starbucks" onPress={onSimulate} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: spacing.lg, gap: 14, backgroundColor: colors.bg },
  title: { ...font.title, color: colors.ink },
  muted: { ...font.body, color: colors.muted },
});
