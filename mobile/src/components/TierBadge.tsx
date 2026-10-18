import { StyleSheet, Text, View } from 'react-native';
import { OrderTier } from '../types';
import { colors, radius } from '../lib/theme';

// Tier 1 = order here (Square connected), 2 = order link, 3 = public info only.
const STYLES: Record<OrderTier, { label: string; bg: string; fg: string; border: string }> = {
  1: { label: 'Order here', bg: colors.primary, fg: '#FFFFFF', border: colors.primary },
  2: { label: 'Order link', bg: colors.surface, fg: colors.primary, border: colors.primary },
  3: { label: 'Info only', bg: colors.bg, fg: colors.muted, border: colors.line },
};

export default function TierBadge({ tier }: { tier: OrderTier }) {
  const s = STYLES[tier];
  return (
    <View style={[styles.badge, { backgroundColor: s.bg, borderColor: s.border }]}>
      <Text style={[styles.text, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  text: { fontSize: 12, fontWeight: '600' },
});
