import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, font } from '../lib/theme';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
};

export default function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
}: Props) {
  const isPrimary = variant === 'primary';
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        inactive && styles.inactive,
        pressed && !inactive && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#FFFFFF' : colors.primary} />
      ) : (
        <Text style={[styles.label, isPrimary ? styles.labelPrimary : styles.labelSecondary]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  primary: { backgroundColor: colors.primary },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  inactive: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  label: { ...font.heading },
  labelPrimary: { color: '#FFFFFF' },
  labelSecondary: { color: colors.primary },
});
