// ─── Quiet Design System ─────────────────────────────────────────────────────
// Single source of truth for all visual tokens across the app.
// Every colour, spacing, and typography value lives here.

export type { ThemeColors } from './colors'
export type ThemeMode = 'paper' | 'eclipse'

export const Colors = {
  // ── Brand ──────────────────────────────────────────────────────────────────
  gold:       '#C9A96E',
  goldDim:    '#8a6e42',
  goldFaint:  '#1a1308',
  goldBorder: '#2e2a24',

  // ── Backgrounds ────────────────────────────────────────────────────────────
  ink:        '#0A0A0B',   // deepest background
  ink2:       '#111113',   // surface level 2
  ink3:       '#1A1A1D',   // surface level 3 (cards)
  ink4:       '#1e1e22',   // dividers
  ink5:       '#2A2A2E',   // borders

  // ── Text ───────────────────────────────────────────────────────────────────
  chalk:      '#E8E4DC',   // primary text
  cream:      '#C4BFB4',   // secondary text
  mist:       '#8A8A8E',   // tertiary text
  smoke:      '#5A5A5E',   // disabled / hint text

  // ── Semantic ───────────────────────────────────────────────────────────────
  green:      '#4ade80',   // positive / online
  greenDark:  '#1D9E75',   // success states
  red:        '#f87171',   // negative / error
  redDark:    '#A32D2D',
  amber:      '#EF9F27',   // warning
  blue:       '#60a5fa',   // info
  purple:     '#a78bfa',   // accent

  // ── Avatars (deterministic by address) ────────────────────────────────────
  avatars: [
    { bg: '#1a1308', fg: '#C9A96E' },
    { bg: '#0f1a2e', fg: '#60a5fa' },
    { bg: '#0f2a1a', fg: '#4ade80' },
    { bg: '#1e0f2e', fg: '#a78bfa' },
    { bg: '#2a0f0f', fg: '#f87171' },
    { bg: '#1a1a0e', fg: '#EF9F27' },
  ],

  // ── Transparent ────────────────────────────────────────────────────────────
  transparent: 'transparent',
  overlay:     'rgba(0, 0, 0, 0.7)',
} as const

export const Typography = {
  // Font families
  serif:  'Georgia',    // brand moments (logo, large titles)
  mono:   'Courier New', // wallet addresses, numbers, code
  sans:   'System',     // body text (platform default)

  // Sizes (sp — scale-independent pixels for RN)
  size: {
    xs:   10,
    sm:   11,
    base: 13,
    md:   15,
    lg:   18,
    xl:   22,
    '2xl': 28,
    '3xl': 34,
    '4xl': 48,
  },

  // Weights
  weight: {
    regular: '400' as const,
    medium:  '500' as const,
    bold:    '700' as const,
  },

  // Line heights
  leading: {
    tight:  1.2,
    normal: 1.5,
    loose:  1.7,
  },

  // Letter spacing
  tracking: {
    tight:   -0.5,
    normal:   0,
    wide:     0.5,
    wider:    1.0,
    widest:   2.0,
  },
} as const

export const Spacing = {
  '0':   0,
  '1':   4,
  '2':   8,
  '3':   12,
  '4':   16,
  '5':   20,
  '6':   24,
  '8':   32,
  '10':  40,
  '12':  48,
  '16':  64,
  '20':  80,
} as const

export const Radius = {
  none: 0,
  sm:   4,
  md:   8,
  lg:   12,
  xl:   16,
  full: 9999,
} as const

export const BorderWidth = {
  hairline: 0.5,
  thin:     1,
  medium:   1.5,
  thick:    2,
} as const

// ── Shadow (used sparingly — only for focus rings) ────────────────────────────
export const Shadow = {
  gold: {
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
} as const

// ── Common style patterns ─────────────────────────────────────────────────────
export const CommonStyles = {
  screenContainer: {
    flex: 1,
    backgroundColor: Colors.ink,
  },
  card: {
    backgroundColor: Colors.ink3,
    borderRadius: Radius.lg,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.ink5,
    padding: Spacing['4'],
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  monoText: {
    fontFamily: Typography.mono,
    fontSize: Typography.size.sm,
    color: Colors.chalk,
  },
  addressText: {
    fontFamily: Typography.mono,
    fontSize: Typography.size.sm,
    color: Colors.gold,
  },
  goldButton: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.lg,
    paddingVertical: Spacing['4'] - 2,
    paddingHorizontal: Spacing['6'],
    alignItems: 'center' as const,
  },
  ghostButton: {
    backgroundColor: Colors.transparent,
    borderRadius: Radius.lg,
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.ink5,
    paddingVertical: Spacing['4'] - 2,
    paddingHorizontal: Spacing['6'],
    alignItems: 'center' as const,
  },
  divider: {
    height: BorderWidth.hairline,
    backgroundColor: Colors.ink4,
  },
  encBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: Spacing['2'],
    paddingHorizontal: Spacing['4'],
    backgroundColor: Colors.ink2,
    borderBottomWidth: BorderWidth.hairline,
    borderBottomColor: Colors.ink4,
    gap: Spacing['2'],
  },
} as const
