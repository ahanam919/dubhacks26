import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from '../../components/Button';
import { getResultById } from '../../data/mock';
import { directionsUrl, openUrl } from '../../lib/actions';
import { getOrder, OrderStatus } from '../../lib/api';
import { colors, font, radius, spacing } from '../../lib/theme';
import { useAsync } from '../../lib/useAsync';

const STEPS = ['Placed', 'Accepted', 'Ready for pickup'];

function stepIndex(status: OrderStatus): number {
  if (status === 'ready') return 2;
  if (status === 'accepted') return 1;
  return 0;
}

export default function StatusScreen() {
  const insets = useSafeAreaInsets();
  const { id, orderId } = useLocalSearchParams<{ id: string; orderId?: string }>();
  const { data: result } = useAsync(() => getResultById(id), [id]);

  const [status, setStatus] = useState<OrderStatus>('placed');
  const [simulated, setSimulated] = useState(false);
  const [pollError, setPollError] = useState(false);

  // Poll the backend every 3 seconds until the order is ready or cancelled.
  useEffect(() => {
    if (!orderId) return;
    let stopped = false;

    const tick = async () => {
      try {
        const res = await getOrder(orderId);
        if (stopped) return;
        setStatus(res.status);
        setSimulated(Boolean(res.simulated));
        setPollError(false);
        if (res.status === 'ready' || res.status === 'cancelled') {
          stopped = true;
          clearInterval(timer);
        }
      } catch {
        if (!stopped) setPollError(true); // keep trying; the connection may come back
      }
    };

    const timer = setInterval(tick, 3000);
    tick();

    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [orderId]);

  const current = stepIndex(status);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{result ? result.shop.name : 'Your order'}</Text>
        <Text style={styles.muted}>
          {simulated
            ? 'Sandbox order. Status updates are simulated.'
            : 'Sandbox order. Status comes from the shop’s Square account.'}
        </Text>

        {!orderId && <Text style={styles.error}>No order to show. Go back and try again.</Text>}

        {status === 'cancelled' ? (
          <View style={styles.panel}>
            <Text style={styles.heading}>This order was canceled</Text>
            <Text style={styles.muted}>Nothing was charged. You can go back and try another shop.</Text>
          </View>
        ) : (
          <View style={styles.panel}>
            {STEPS.map((label, i) => {
              const done = i <= current;
              return (
                <View key={label} style={styles.stepRow}>
                  <View style={[styles.dot, done && styles.dotDone]} />
                  <Text style={[styles.stepText, done && styles.stepTextDone]}>{label}</Text>
                </View>
              );
            })}
          </View>
        )}

        {pollError && (
          <Text style={styles.muted}>Having trouble refreshing the status. Still trying.</Text>
        )}
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
  heading: { ...font.heading, color: colors.ink },
  muted: { ...font.small, color: colors.muted },
  error: { ...font.body, color: colors.bad },
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
