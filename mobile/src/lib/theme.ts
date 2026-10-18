// Design tokens. Cool grey base, one action color (ultramarine), charcoal for the
// chain baseline, green reserved for savings. Change colors here, not in screens.
export const colors = {
  bg: '#F4F5F7',
  surface: '#FFFFFF',
  ink: '#161A22',
  muted: '#667085',
  line: '#E1E4EA',

  primary: '#2F4BDB',
  primarySoft: '#E6EAFD',

  good: '#0B7A4B',
  goodSoft: '#DDF5E8',
  warn: '#8A5A00',
  warnSoft: '#FDF0D0',
  bad: '#B42318',

  chain: '#22252B',
  chainText: '#F2F3F5',
  chainMuted: '#A5ABB6',

  pinLocal: '#4B5565',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

export const radius = { sm: 8, md: 12, lg: 18, pill: 999 };

// Font scale: title / heading / body / small. Prices use the display size.
export const font = {
  display: { fontSize: 34, fontWeight: '700' as const, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.2 },
  heading: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  small: { fontSize: 13, fontWeight: '400' as const },
};
