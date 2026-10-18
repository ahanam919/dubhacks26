import { MenuItem, PriceComparison, Shop } from '../types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Prices are stored in cents. Convert only when displaying.
export function formatPrice(cents: number | null): string {
  if (cents == null) return 'Price not listed';
  return `$${(cents / 100).toFixed(2)}`;
}

// delta_cents = local - chain, so negative means the local shop is cheaper.
export function savingsLabel(c: PriceComparison | null): string | null {
  if (!c) return null;
  const abs = formatPrice(Math.abs(c.delta_cents));
  if (c.delta_cents < 0) return `Saves ${abs}`;
  if (c.delta_cents > 0) return `${abs} more`;
  return 'Same price';
}

// Only show a hook that has been through the verifier.
export function visibleHook(shop: Shop): string | null {
  return shop.hook && shop.hook_verified_at ? shop.hook : null;
}

// For full timestamps (shown in the phone's local time).
function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

// For date-only strings like '2026-10-01'. Parsed by hand to avoid a timezone shift.
export function formatDateOnly(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

// One label for the "last confirmed" line on every item.
export function confirmedLabel(item: MenuItem): string {
  if (!item.last_checked_at) return 'Not confirmed';
  const when = shortDate(item.last_checked_at);
  if (item.status === 'stale') return `Stale, last checked ${when}`;
  if (item.status === 'verified') return `Confirmed ${when}`;
  return `Checked ${when}, not yet verified`;
}
