import { StyleSheet, Text, View } from 'react-native';
import { ChainReference } from '../types';
import { colors, radius, font } from '../lib/theme';
import { formatDateOnly, formatPrice } from '../lib/format';

type Props = { chain: ChainReference; conceptName: string | null };

// The baseline the local shops are compared against. Dark on purpose so it reads as "the reference".
export default function ChainColumn({ chain, conceptName }: Props) {
  return (
    <View style={styles.box}>
      <Text style={styles.chain}>{chain.chain_name}</Text>
      <Text style={styles.item}>{conceptName ?? 'Featured item'}</Text>
      <Text style={styles.size}>{chain.size}</Text>
      <Text style={styles.price}>{formatPrice(chain.approx_price_cents)}</Text>
      <Text style={styles.note}>Reference price as of {formatDateOnly(chain.as_of_date)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.chain,
    borderRadius: radius.lg,
    padding: 14,
    gap: 4,
  },
  chain: { ...font.heading, color: colors.chainText },
  item: { ...font.small, color: colors.chainMuted },
  size: { ...font.small, color: colors.chainMuted },
  price: { ...font.title, color: colors.chainText, marginTop: 10 },
  note: { fontSize: 12, color: colors.chainMuted, marginTop: 10 },
});
