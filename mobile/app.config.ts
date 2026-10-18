// Adds settings that must not live in app.json: the Google Maps key comes from
// mobile/.env (ignored by Git), never from a committed file.
// Everything else stays in app.json, which Expo passes in as `config`.
import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'mobile',
  slug: config.slug ?? 'mobile',
  android: {
    ...config.android,
    // Needed for development builds. The Google Maps key must allow this package name.
    package: config.android?.package ?? 'com.localswap.mobile',
    config: {
      ...config.android?.config,
      googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY },
    },
  },
});
