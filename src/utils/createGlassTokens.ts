import { LightTheme } from '@/constants/theme';

function isDarkBg(c: typeof LightTheme): boolean {
  const bg = c.background.toLowerCase();
  return bg === '#000000' || bg === '#0b0b0b' || bg === '#0d1b2a' || bg === '#0d1f12' ||
         bg === '#1a1614' || bg === '#121820' || bg === '#1c1510' || bg === '#111111' ||
         bg === '#0f0f0f' || bg === '#0a0a0a';
}

function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function createGlassTokens(colors: typeof LightTheme) {
  const dark = isDarkBg(colors);

  const accent = colors.tint === '#000000' || colors.tint === '#ffffff' ? colors.primary : colors.tint;

  return {
    bg: colors.background,
    bgCard: colors.card,
    bgCardHover: colors.surface,
    bgCardStrong: colors.surface,
    border: colors.border,
    borderLight: dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
    borderAccent: rgba(accent, 0.20),
    fg: colors.text,
    fgSecondary: colors.textSecondary,
    muted: colors.textSecondary,
    mutedLight: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    glow: 'transparent',
    glowStrong: 'transparent',
    accentGlass: rgba(accent, 0.10),
    accentGlassStrong: rgba(accent, 0.18),
    accent,
    reflection: 'transparent',
    gradientStart: 'transparent',
    gradientEnd: 'transparent',
    surface: colors.surface,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,

    primary: colors.primary,
    secondary: colors.secondary,
    background: colors.background,
    surfaceColor: colors.surface,
    cardColor: colors.card,
    textColor: colors.text,
    textSecondaryColor: colors.textSecondary,
    borderColor: colors.border,
    tint: colors.tint,

    chartLine: dark ? 'rgba(255,255,255,0.90)' : 'rgba(0,0,0,0.85)',
    chartGrid: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    chartLabel: dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.40)',
    chartBg: colors.card,

    inputBg: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    inputBorder: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
    inputFocusedBorder: accent,
    placeholderColor: dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',

    overlayBg: dark ? 'rgba(0,0,0,0.70)' : 'rgba(0,0,0,0.50)',

    // Flat surface tokens (replaces Liquid Glass)
    blurTint: (dark ? 'dark' : 'light') as 'dark' | 'light',
    surfaceFill: colors.surface,
    surfaceFillStrong: colors.card,
    rimTop: 'transparent',
    rimBottom: 'transparent',
    rimLeft: 'transparent',
    rimRight: 'transparent',
    highlight: 'transparent',
    highlightStrong: 'transparent',
    shadowColor: '#000000',
    shadowOuter: dark ? 0.15 : 0.06,
    shadowInner: 0,
    borderSubtle: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    borderGlass: colors.border,
    borderGlassStrong: dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.10)',
    glassTint: rgba(accent, 0.06),
    glassTintStrong: rgba(accent, 0.12),
    specularPeak: 'transparent',
    ambientGlow: 'transparent',
    depthShadow: dark ? 'rgba(0,0,0,0.30)' : 'rgba(0,0,0,0.10)',
    refractEdge: 'transparent',
  };
}
