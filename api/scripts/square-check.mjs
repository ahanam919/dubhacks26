// Verifies the Square sandbox token and that SQUARE_LOCATION_ID belongs to it.
// Run from api/: npm run square:check
import dotenv from 'dotenv';
dotenv.config({ path: new URL('../../.env', import.meta.url) });

const required = ['SQUARE_ACCESS_TOKEN', 'SQUARE_LOCATION_ID', 'SQUARE_VERSION'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error('Missing env vars:', missing.join(', '));
  process.exit(1);
}
if (process.env.SQUARE_ENV !== 'sandbox') {
  console.error('SQUARE_ENV must be exactly "sandbox". Refusing to run.');
  process.exit(1);
}

const res = await fetch('https://connect.squareupsandbox.com/v2/locations', {
  headers: {
    'Square-Version': process.env.SQUARE_VERSION,
    Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
  signal: AbortSignal.timeout(10000),
});

const json = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error('Square returned HTTP', res.status);
  console.error(json?.errors?.map((e) => `${e.code}: ${e.detail}`).join('\n') || '(no error body)');
  process.exit(1);
}

const locations = json.locations ?? [];
console.log(`Token is valid. ${locations.length} location(s) on this account:`);
for (const l of locations) {
  console.log(`  ${l.id}  ${l.name}  status=${l.status}  currency=${l.currency}`);
}

const match = locations.find((l) => l.id === process.env.SQUARE_LOCATION_ID);
if (!match) {
  console.error("\nSQUARE_LOCATION_ID is NOT one of this token's locations.");
  console.error('The token and the location ID belong to different Square accounts. Use an ID from the list above.');
  process.exit(1);
}
console.log(`\nOK: SQUARE_LOCATION_ID matches "${match.name}".`);
