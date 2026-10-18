import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from '../../components/Button';
import { getResultById } from '../../data/mock';
import { directionsUrl, openUrl } from '../../lib/actions';
import { colors, font, radius, spacing } from '../../lib/theme';
import { useAsync } from '../../lib/useAsync';

const STEPS = ['Placed', 'Accepted', 'Ready for pickup'];

export default function StatusScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string; orderId?: string }>();
  const { data: result } = useAsync(() => getResultById(id), [id]);
  const [step, setStep] = useState(0);

  // SIMULATED status. Replace with polling GET /order/:id every few seconds.
  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 4000);
    const t2 = setTimeout(() => setStep(2), 9000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{result ? result.shop.name : 'Your order'}</Text>
        <Text style={styles.muted}>Sandbox order with simulated status updates.</Text>

        <View style={styles.panel}>
          {STEPS.map((label, i) => {
            const done = i <= step;
            return (
              <View key={label} style={styles.stepRow}>
                <View style={[styles.dot, done && styles.dotDone]} />
                <Text style={[styles.stepText, done && styles.stepTextDone]}>{label}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
        <Button label="Back to map" variant="secondary" onPress={() => router.replace('/')} />
        {result && (
          <Button label="Directions" onPress={() => openUrl(directionsUrl(result.shop))} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: 12 },
  title: { ...font.title, color: colors.ink },
  muted: { ...font.small, color: colors.muted },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    gap: 16,
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: 8,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.line },
  dotDone: { backgroundColor: colors.primary },
  stepText: { ...font.body, color: colors.muted },
  stepTextDone: { color: colors.ink, fontWeight: '600' },
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
