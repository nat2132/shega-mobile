import { Dimensions } from 'react-native';
import { createGlassTokens } from '@/utils/createGlassTokens';
import { LightTheme} from '@/constants/theme';

const { width: W, height: H } = Dimensions.get('window');

export const DIMENSIONS = { W, H };

export const SPRING = {
  gentle: { damping: 22, stiffness: 120 },
  snappy: { damping: 16, stiffness: 200 },
  bouncy: { damping: 9, stiffness: 100 },
  soft: { damping: 18, stiffness: 150 },
  smooth: { damping: 20, stiffness: 90 },
  crisp: { damping: 24, stiffness: 250 },
};

export const TIMING = {
  fast: 400,
  medium: 700,
  slow: 1200,
  intro: 6000,
  stagger: 120,
  staggerFast: 60,
  staggerSlow: 200,
};

function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function getAccent(colors: typeof LightTheme) {
  if (colors.tint === '#ffffff' || colors.tint === '#000000') return '#0052ff';
  return colors.tint;
}

export function getAccentRgba(colors: typeof LightTheme, alpha: number) {
  const accent = getAccent(colors);
  const { r, g, b } = hexToRgb(accent);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function getGlass(colors: typeof LightTheme) {
  const G = createGlassTokens(colors);
  const bgRgb = hexToRgb(colors.background);
  const lum = 0.299 * bgRgb.r + 0.587 * bgRgb.g + 0.114 * bgRgb.b;
  const dark = lum < 128;
  const g = dark ? '255,255,255' : '0,0,0';
  const accent = getAccent(colors);
  const aRgb = hexToRgb(accent);

  return {
    ...G,
    accent,
    isDark: dark,
    g,
    accentGlass: `rgba(${aRgb.r},${aRgb.g},${aRgb.b},${dark ? 0.10 : 0.08})`,
    accentGlow: `rgba(${aRgb.r},${aRgb.g},${aRgb.b},0.00)`,
    accentGlowStrong: `rgba(${aRgb.r},${aRgb.g},${aRgb.b},0.00)`,
    glassCard: colors.card,
    glassCardMedium: colors.surface,
    glassStrong: colors.surface,
    glassBorder: colors.border,
    glassBorderLight: `rgba(${g},${dark ? 0.08 : 0.06})`,
    glassBorderStrong: `rgba(${g},${dark ? 0.12 : 0.10})`,
    textGlass: colors.textSecondary,
    textGlassMedium: colors.textSecondary,
    textGlassStrong: colors.text,
    textGlassFaint: `rgba(${g},${dark ? 0.20 : 0.30})`,
    textGlassVeryFaint: `rgba(${g},${dark ? 0.10 : 0.15})`,
    buttonFg: dark ? '#000000' : '#FFFFFF',
    progressTrack: `rgba(${g},${dark ? 0.10 : 0.10})`,
    progressFill: colors.tint,
    lineAccent: `rgba(${aRgb.r},${aRgb.g},${aRgb.b},0.10)`,
    barInactive: `rgba(${g},${dark ? 0.08 : 0.08})`,
    barAccent: colors.tint,
    statCardBg: colors.card,
    statCardBorder: colors.border,
  };
}

export type GlassTokens = ReturnType<typeof getGlass>;
