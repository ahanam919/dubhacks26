import { StyleSheet, Text, View } from 'react-native';
import { ChainReference } from '../types';
import { colors, radius, font } from '../lib/theme';
import { formatDateOnly, formatPrice } from '../lib/format';

type Props = { chain: ChainReference; conceptName: string | null };

// Thin horizontal reference bar shown at the top of comparison views.
export default function ChainColumn({ chain, conceptName }: Props) {
  return (
    <View style={styles.bar}>
      <View style={styles.left}>
        <Text style={styles.chain}>{chain.chain_name}</Text>
        <Text style={styles.item}>{conceptName ?? 'Featured item'} · {chain.size}</Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.price}>{formatPrice(chain.approx_price_cents)}</Text>
        <Text style={styles.note}>Reference as of {formatDateOnly(chain.as_of_date)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.chain,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  left: { gap: 2 },
  right: { alignItems: 'flex-end', gap: 2 },
  chain: { ...font.heading, color: colors.chainText },
  item: { ...font.small, color: colors.chainMuted },
  price: { ...font.heading, color: colors.chainText },
  note: { fontSize: 11, color: colors.chainMuted },
});
