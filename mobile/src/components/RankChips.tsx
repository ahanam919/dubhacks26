import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RankFactor } from '../types';
import { colors, radius } from '../lib/theme';

const OPTIONS: { value: RankFactor; label: string }[] = [
  { value: 'price', label: 'Price' },
  { value: 'distance', label: 'Distance' },
  { value: 'openNow', label: 'Open now' },
];

type Props = { value: RankFactor; onChange: (factor: RankFactor) => void };

export default function RankChips({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {OPTIONS.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.text, selected && styles.textSelected]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  text: { fontSize: 13, fontWeight: '600', color: colors.muted },
  textSelected: { color: '#FFFFFF' },
});
