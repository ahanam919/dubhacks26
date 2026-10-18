import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius } from '../lib/theme';

type Props = {
  initialValue?: string;
  onSubmit: (query: string) => void;
  placeholder?: string;
};

// A plain controlled text input. It is not connected to anything: submitting only
// calls onSubmit with the trimmed text (empty or whitespace-only does nothing).
export default function SearchBar({
  initialValue = '',
  onSubmit,
  placeholder = 'Search a place or craving (try "PSL")',
}: Props) {
  const [value, setValue] = useState(initialValue);

  const submit = () => {
    const q = value.trim();
    if (q.length > 0) onSubmit(q);
  };

  return (
    <View style={styles.wrap}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        returnKeyType="search"
        onSubmitEditing={submit}
        autoCorrect={false}
        autoCapitalize="none"
        accessibilityLabel="Search"
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => setValue('')}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <Text style={styles.clear}>×</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    height: 50,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  input: { flex: 1, fontSize: 16, color: colors.ink },
  clear: { fontSize: 24, color: colors.muted, paddingLeft: 8 },
});
