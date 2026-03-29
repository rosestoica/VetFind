/**
 * VetFinder — paletă de brand (inspirată layout curat / contrast puternic, ex. Agendrix)
 *
 * Culori din paletă:
 * - fundal pagină alb / panouri crem foarte deschis (surface.cream) · #096e77 teal · #5b7d7e gri-sidef
 * - #a57269 rose praf (erori / destructive) · #20c571 verde accent
 * - #6b6ef7 periwinkle (info / link-uri secundare) · #40251f maro închis
 * - #2a969d turcoaz · #33343c text închis
 */

/** Teal principal — #096e77 + derivații spre #2a969d */
export const primary = {
  main: '#096e77',
  light: '#2a969d',
  lighter: '#4db3b8',
  lightest: '#b8dfe2',
  dark: '#075a62',
  50: '#eef7f8',
  100: '#d4ecee',
  200: '#a8d9dd',
  300: '#6eb9c0',
  400: '#2a969d',
  500: '#1f858c',
  600: '#096e77',
  700: '#085e66',
  800: '#064e55',
  900: '#043c42',
} as const;

/** Neutrale: doar text / iconițe; fundaluri → colors.surface (alb / crem / border) */
export const neutral = {
  50: '#ffffff',
  100: '#d8d4d0',
  200: '#c5c1bd',
  300: '#a9a5a1',
  400: '#8c8884',
  500: '#5b7d7e',
  600: '#4d6a6b',
  700: '#3f5657',
  800: '#40251f',
  900: '#33343c',
} as const;

/** Accent verde proaspăt — #20c571 (CTA, evidențieri, succes) */
export const accent = {
  main: '#20c571',
  light: '#4ade95',
  lighter: '#86efbd',
  lightest: '#d1fae5',
  dark: '#17a85d',
  50: '#ecfdf5',
  100: '#d1fae5',
  200: '#a7f3d0',
  300: '#6ee7b7',
  400: '#34d399',
  500: '#20c571',
  600: '#17a85d',
  700: '#15804a',
  800: '#166534',
  900: '#14532d',
} as const;

export const success = {
  main: '#20c571',
  light: '#4ade95',
  dark: '#17a85d',
  50: '#ecfdf5',
  100: '#d1fae5',
  200: '#a7f3d0',
  300: '#6ee7b7',
  400: '#34d399',
  500: '#20c571',
  600: '#17a85d',
  700: '#15804a',
  800: '#166534',
  900: '#14532d',
} as const;

/** Rose praf — #a57269 (erori, anulări, butoane „rose”) */
export const error = {
  main: '#a57269',
  light: '#c49a94',
  dark: '#8a5e56',
  50: '#faf6f5',
  100: '#f0e6e4',
  200: '#e4cfcb',
  300: '#d4b0a9',
  400: '#c49a94',
  500: '#a57269',
  600: '#8a5e56',
  700: '#744e47',
  800: '#5f403a',
  900: '#4a322e',
} as const;

export const warning = {
  main: '#c27803',
  light: '#eab308',
  dark: '#a16207',
  50: '#fffbeb',
  100: '#fef3c7',
  200: '#fde68a',
  300: '#fcd34d',
  400: '#fbbf24',
  500: '#f59e0b',
  600: '#d97706',
  700: '#b45309',
  800: '#92400e',
  900: '#78350f',
} as const;

/** Info / link-uri secundare — #6b6ef7 */
export const info = {
  main: '#6b6ef7',
  light: '#8b8ff9',
  dark: '#4f54e5',
  50: '#f5f5ff',
  100: '#ebebfe',
  200: '#d6d7fd',
  300: '#b4b6fb',
  400: '#8b8ff9',
  500: '#6b6ef7',
  600: '#4f54e5',
  700: '#4347d0',
  800: '#383b9e',
  900: '#2f327d',
} as const;

export const common = {
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent' as const,
} as const;

export const alpha = {
  primarySoft: 'rgba(9, 110, 119, 0.14)',
  primaryMuted: 'rgba(9, 110, 119, 0.1)',
  accentSoft: 'rgba(32, 197, 113, 0.14)',
  accentMuted: 'rgba(32, 197, 113, 0.1)',
} as const;

export const colors = {
  primary,
  neutral,
  accent,
  success,
  error,
  warning,
  info,
  alpha,
  ...common,

  gray: neutral,
  text: {
    primary: neutral[900],
    secondary: neutral[600],
  },
  surface: {
    /** Fundal principal ecrane / app */
    card: common.white,
    background: common.white,
    /** Crem aproape alb — carduri, câmpuri, panouri (fără gri-bej neutru) */
    cream: '#faf9f6',
    /** Linii / borduri subtile, calde */
    border: '#ebe8e4',
    muted: '#faf9f6',
    /** Fundal discret pentru comutatoare/segmente (fără gri neutru) */
    segmentTrack: '#e8e5e0',
  },
} as const;
