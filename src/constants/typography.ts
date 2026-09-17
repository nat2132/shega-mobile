// Typography system for the multilingual shega-mobile app.
//
// Goals
// ─────
// 1. **One source of truth** for every font size, line height, letter
//    spacing and font family. No more scattered `fontSize: 14` literals
//    in screens.
// 2. **Clamp to a min/max range** so font scaling (accessibility
//    setting on iOS, system font size on Android) can never break the
//    layout. We use React Native's `maxFontSizeMultiplier` instead of
//    mutating fontSize — the OS handles the rest.
// 3. **Per-language readability scaling.** Ge'ez-script languages
//    (Amharic, Tigrinya) render slightly larger at the same nominal
//    pixel size than Latin scripts. We bake a per-language factor into
//    the resolved font size; the variant lookup is still 1.0x
//    baseline, so existing screens feel unchanged for English.
// 4. **Token-based variants.** `variant="body"`, `variant="title"`,
//    etc. — used by `<AppText />` — never reference raw pixel values.
//
// All size tokens were chosen to fit the *longest* expected
// translation (Amharic / Tigrinya strings are routinely 30–60%
// longer than English) within the existing layout grids. The variant
// scale is intentionally compact (9 sizes) so contributors can pick
// the right level without bikeshedding.

import { PixelRatio, TextStyle } from 'react-native';
import { Fonts } from './theme';
export type FontSizeVariant =
  | 'micro'        // 10 — overline, badges, fine print
  | 'caption'      // 12 — small labels
  | 'body-sm'      // 13 — secondary text
  | 'body'         // 14 — primary text
  | 'body-lg'      // 15 — emphasised body
  | 'label'        // 14 — input labels, field labels (matches body)
  | 'subtitle'     // 16 — section subtitles
  | 'title-sm'     // 16 — card titles, list item titles
  | 'title'        // 18 — screen sub-headings
  | 'heading'      // 20 — modal/section headings
  | 'heading-lg'   // 24 — KPI numbers, hero values
  | 'display'      // 28 — screen titles
  | 'display-lg'   // 32 — hero titles
  | 'hero';        // 40 — onboarding / marketing

type Weight = 'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold' | 'black';

export type { Weight };

export interface FontToken {
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
  fontFamily: string;
  fontWeight: TextStyle['fontWeight'];
}

// Baseline token table. `lineHeight` is chosen as 1.4× the font
// size, with a few overrides for display sizes (tighter ratio) and
// micro/caption (looser ratio for Ge'ez script ascenders).
const TOKENS: Record<FontSizeVariant, Record<Weight, FontToken>> = {
  micro: {
    regular:    { fontSize: 10, lineHeight: 14, fontFamily: Fonts.regular,   fontWeight: '400' },
    medium:     { fontSize: 10, lineHeight: 14, fontFamily: Fonts.medium,    fontWeight: '500' },
    semibold:   { fontSize: 10, lineHeight: 14, fontFamily: Fonts.semibold,  fontWeight: '600' },
    bold:       { fontSize: 10, lineHeight: 14, fontFamily: Fonts.bold,      fontWeight: '700' },
    extrabold:  { fontSize: 10, lineHeight: 14, fontFamily: Fonts.extrabold, fontWeight: '800' },
    black:      { fontSize: 10, lineHeight: 14, fontFamily: Fonts.black,     fontWeight: '900' },
  },
  caption: {
    regular:    { fontSize: 12, lineHeight: 16, fontFamily: Fonts.regular,   fontWeight: '400' },
    medium:     { fontSize: 12, lineHeight: 16, fontFamily: Fonts.medium,    fontWeight: '500' },
    semibold:   { fontSize: 12, lineHeight: 16, fontFamily: Fonts.semibold,  fontWeight: '600' },
    bold:       { fontSize: 12, lineHeight: 16, fontFamily: Fonts.bold,      fontWeight: '700' },
    extrabold:  { fontSize: 12, lineHeight: 16, fontFamily: Fonts.extrabold, fontWeight: '800' },
    black:      { fontSize: 12, lineHeight: 16, fontFamily: Fonts.black,     fontWeight: '900' },
  },
  'body-sm': {
    regular:    { fontSize: 13, lineHeight: 18, fontFamily: Fonts.regular,   fontWeight: '400' },
    medium:     { fontSize: 13, lineHeight: 18, fontFamily: Fonts.medium,    fontWeight: '500' },
    semibold:   { fontSize: 13, lineHeight: 18, fontFamily: Fonts.semibold,  fontWeight: '600' },
    bold:       { fontSize: 13, lineHeight: 18, fontFamily: Fonts.bold,      fontWeight: '700' },
    extrabold:  { fontSize: 13, lineHeight: 18, fontFamily: Fonts.extrabold, fontWeight: '800' },
    black:      { fontSize: 13, lineHeight: 18, fontFamily: Fonts.black,     fontWeight: '900' },
  },
  body: {
    regular:    { fontSize: 14, lineHeight: 20, fontFamily: Fonts.regular,   fontWeight: '400' },
    medium:     { fontSize: 14, lineHeight: 20, fontFamily: Fonts.medium,    fontWeight: '500' },
    semibold:   { fontSize: 14, lineHeight: 20, fontFamily: Fonts.semibold,  fontWeight: '600' },
    bold:       { fontSize: 14, lineHeight: 20, fontFamily: Fonts.bold,      fontWeight: '700' },
    extrabold:  { fontSize: 14, lineHeight: 20, fontFamily: Fonts.extrabold, fontWeight: '800' },
    black:      { fontSize: 14, lineHeight: 20, fontFamily: Fonts.black,     fontWeight: '900' },
  },
  'body-lg': {
    regular:    { fontSize: 15, lineHeight: 22, fontFamily: Fonts.regular,   fontWeight: '400' },
    medium:     { fontSize: 15, lineHeight: 22, fontFamily: Fonts.medium,    fontWeight: '500' },
    semibold:   { fontSize: 15, lineHeight: 22, fontFamily: Fonts.semibold,  fontWeight: '600' },
    bold:       { fontSize: 15, lineHeight: 22, fontFamily: Fonts.bold,      fontWeight: '700' },
    extrabold:  { fontSize: 15, lineHeight: 22, fontFamily: Fonts.extrabold, fontWeight: '800' },
    black:      { fontSize: 15, lineHeight: 22, fontFamily: Fonts.black,     fontWeight: '900' },
  },
  label: {
    regular:    { fontSize: 14, lineHeight: 20, fontFamily: Fonts.regular,   fontWeight: '400' },
    medium:     { fontSize: 14, lineHeight: 20, fontFamily: Fonts.medium,    fontWeight: '500' },
    semibold:   { fontSize: 14, lineHeight: 20, fontFamily: Fonts.semibold,  fontWeight: '600' },
    bold:       { fontSize: 14, lineHeight: 20, fontFamily: Fonts.bold,      fontWeight: '700' },
    extrabold:  { fontSize: 14, lineHeight: 20, fontFamily: Fonts.extrabold, fontWeight: '800' },
    black:      { fontSize: 14, lineHeight: 20, fontFamily: Fonts.black,     fontWeight: '900' },
  },
  subtitle: {
    regular:    { fontSize: 16, lineHeight: 24, fontFamily: Fonts.regular,   fontWeight: '400' },
    medium:     { fontSize: 16, lineHeight: 24, fontFamily: Fonts.medium,    fontWeight: '500' },
    semibold:   { fontSize: 16, lineHeight: 24, fontFamily: Fonts.semibold,  fontWeight: '600' },
    bold:       { fontSize: 16, lineHeight: 24, fontFamily: Fonts.bold,      fontWeight: '700' },
    extrabold:  { fontSize: 16, lineHeight: 24, fontFamily: Fonts.extrabold, fontWeight: '800' },
    black:      { fontSize: 16, lineHeight: 24, fontFamily: Fonts.black,     fontWeight: '900' },
  },
  'title-sm': {
    regular:    { fontSize: 16, lineHeight: 22, fontFamily: Fonts.regular,   fontWeight: '400' },
    medium:     { fontSize: 16, lineHeight: 22, fontFamily: Fonts.medium,    fontWeight: '500' },
    semibold:   { fontSize: 16, lineHeight: 22, fontFamily: Fonts.semibold,  fontWeight: '600' },
    bold:       { fontSize: 16, lineHeight: 22, fontFamily: Fonts.bold,      fontWeight: '700' },
    extrabold:  { fontSize: 16, lineHeight: 22, fontFamily: Fonts.extrabold, fontWeight: '800' },
    black:      { fontSize: 16, lineHeight: 22, fontFamily: Fonts.black,     fontWeight: '900' },
  },
  title: {
    regular:    { fontSize: 18, lineHeight: 24, fontFamily: Fonts.regular,   fontWeight: '400' },
    medium:     { fontSize: 18, lineHeight: 24, fontFamily: Fonts.medium,    fontWeight: '500' },
    semibold:   { fontSize: 18, lineHeight: 24, fontFamily: Fonts.semibold,  fontWeight: '600' },
    bold:       { fontSize: 18, lineHeight: 24, fontFamily: Fonts.bold,      fontWeight: '700' },
    extrabold:  { fontSize: 18, lineHeight: 24, fontFamily: Fonts.extrabold, fontWeight: '800' },
    black:      { fontSize: 18, lineHeight: 24, fontFamily: Fonts.black,     fontWeight: '900' },
  },
  heading: {
    regular:    { fontSize: 20, lineHeight: 26, fontFamily: Fonts.regular,   fontWeight: '400' },
    medium:     { fontSize: 20, lineHeight: 26, fontFamily: Fonts.medium,    fontWeight: '500' },
    semibold:   { fontSize: 20, lineHeight: 26, fontFamily: Fonts.semibold,  fontWeight: '600', letterSpacing: -0.2 },
    bold:       { fontSize: 20, lineHeight: 26, fontFamily: Fonts.bold,      fontWeight: '700', letterSpacing: -0.2 },
    extrabold:  { fontSize: 20, lineHeight: 26, fontFamily: Fonts.extrabold, fontWeight: '800', letterSpacing: -0.2 },
    black:      { fontSize: 20, lineHeight: 26, fontFamily: Fonts.black,     fontWeight: '900', letterSpacing: -0.2 },
  },
  'heading-lg': {
    regular:    { fontSize: 24, lineHeight: 28, fontFamily: Fonts.regular,   fontWeight: '400' },
    medium:     { fontSize: 24, lineHeight: 28, fontFamily: Fonts.medium,    fontWeight: '500' },
    semibold:   { fontSize: 24, lineHeight: 28, fontFamily: Fonts.semibold,  fontWeight: '600', letterSpacing: -0.3 },
    bold:       { fontSize: 24, lineHeight: 28, fontFamily: Fonts.bold,      fontWeight: '700', letterSpacing: -0.3 },
    extrabold:  { fontSize: 24, lineHeight: 28, fontFamily: Fonts.extrabold, fontWeight: '800', letterSpacing: -0.3 },
    black:      { fontSize: 24, lineHeight: 28, fontFamily: Fonts.black,     fontWeight: '900', letterSpacing: -0.3 },
  },
  display: {
    regular:    { fontSize: 28, lineHeight: 31, fontFamily: Fonts.regular,   fontWeight: '400' },
    medium:     { fontSize: 28, lineHeight: 31, fontFamily: Fonts.medium,    fontWeight: '500' },
    semibold:   { fontSize: 28, lineHeight: 31, fontFamily: Fonts.semibold,  fontWeight: '600', letterSpacing: -0.5 },
    bold:       { fontSize: 28, lineHeight: 31, fontFamily: Fonts.bold,      fontWeight: '700', letterSpacing: -0.5 },
    extrabold:  { fontSize: 28, lineHeight: 31, fontFamily: Fonts.extrabold, fontWeight: '800', letterSpacing: -0.5 },
    black:      { fontSize: 28, lineHeight: 31, fontFamily: Fonts.black,     fontWeight: '900', letterSpacing: -0.5 },
  },
  'display-lg': {
    regular:    { fontSize: 32, lineHeight: 35, fontFamily: Fonts.regular,   fontWeight: '400' },
    medium:     { fontSize: 32, lineHeight: 35, fontFamily: Fonts.medium,    fontWeight: '500' },
    semibold:   { fontSize: 32, lineHeight: 35, fontFamily: Fonts.semibold,  fontWeight: '600', letterSpacing: -0.6 },
    bold:       { fontSize: 32, lineHeight: 35, fontFamily: Fonts.bold,      fontWeight: '700', letterSpacing: -0.6 },
    extrabold:  { fontSize: 32, lineHeight: 35, fontFamily: Fonts.extrabold, fontWeight: '800', letterSpacing: -0.6 },
    black:      { fontSize: 32, lineHeight: 35, fontFamily: Fonts.black,     fontWeight: '900', letterSpacing: -0.6 },
  },
  hero: {
    regular:    { fontSize: 40, lineHeight: 43, fontFamily: Fonts.regular,   fontWeight: '400' },
    medium:     { fontSize: 40, lineHeight: 43, fontFamily: Fonts.medium,    fontWeight: '500' },
    semibold:   { fontSize: 40, lineHeight: 43, fontFamily: Fonts.semibold,  fontWeight: '600', letterSpacing: -0.8 },
    bold:       { fontSize: 40, lineHeight: 43, fontFamily: Fonts.bold,      fontWeight: '700', letterSpacing: -0.8 },
    extrabold:  { fontSize: 40, lineHeight: 43, fontFamily: Fonts.extrabold, fontWeight: '800', letterSpacing: -0.8 },
    black:      { fontSize: 40, lineHeight: 43, fontFamily: Fonts.black,     fontWeight: '900', letterSpacing: -0.8 },
  },
};

/**
 * Look up the base font token for a variant + weight. AppText calls
 * this internally — you generally shouldn't need to import it.
 */
export const getFontToken = (
  variant: FontSizeVariant = 'body',
  weight: Weight = 'regular',
): FontToken => {
  const row = TOKENS[variant] ?? TOKENS.body;
  return row[weight] ?? row.regular;
};

/**
 * Per-language readability factor. Ge'ez scripts (Amharic, Tigrinya)
 * have wider glyphs at the same nominal pixel size, so we apply a
 * tiny bump (1.05×) to keep the visual weight consistent with Latin
 * scripts. Oromo uses Latin script so it gets the baseline factor.
 *
 * The factor is intentionally small: the layout fixes (flex,
 * flexWrap, no fixed widths) are what protect us from translation
 * length, not font shrinking.
 */
const LANGUAGE_FACTORS: Record<string, number> = {
  en: 1.0,
  om: 1.0,
  am: 1.05,
  ti: 1.05,
};

export const getLanguageFontFactor = (language?: string): number => {
  if (!language) return 1.0;
  return LANGUAGE_FACTORS[language] ?? 1.0;
};

/**
 * Clamp a font size to a [min, max] range, optionally scaled by a
 * language factor. The default clamp window is the original size
 * ±20% — that is wide enough to allow Ge'ez readability scaling but
 * narrow enough to prevent runaway layout breakage if a caller passes
 * an absurd value.
 */
export interface ClampOptions {
  min?: number;
  max?: number;
  language?: string;
  /** Disable the per-language readability factor (e.g. for numeric values). */
  ignoreLanguage?: boolean;
}

export const clampFontSize = (
  size: number,
  options: ClampOptions = {},
): number => {
  if (!Number.isFinite(size) || size <= 0) return 12;
  const factor = options.ignoreLanguage
    ? 1.0
    : getLanguageFontFactor(options.language);
  const scaled = size * factor;
  // Default clamp window: ±20% around the requested size.
  const min = options.min ?? Math.max(8, Math.round(size * 0.8));
  const max = options.max ?? Math.round(size * 1.2);
  return Math.max(min, Math.min(max, scaled));
};

/**
 * Resolve a font token through the clamp + language pipeline.
 * Returns a TextStyle fragment ready to spread into a Text component.
 */
export const resolveFontStyle = (
  variant: FontSizeVariant,
  weight: Weight,
  language?: string,
  options: ClampOptions = {},
): TextStyle => {
  const token = getFontToken(variant, weight);
  const fontSize = clampFontSize(token.fontSize, { ...options, language });
  // Scale lineHeight proportionally so the line-height ratio is
  // preserved when the font size changes due to language scaling.
  const ratio = token.lineHeight / token.fontSize;
  const lineHeight = Math.round(fontSize * ratio);
  return {
    fontSize,
    lineHeight,
    fontFamily: token.fontFamily,
    fontWeight: token.fontWeight,
    letterSpacing: token.letterSpacing,
  };
};

/**
 * Maximum font-size multiplier. We cap at 1.3× so users with large
 * system text settings still see the layout intact. 1.0 would defeat
 * the purpose; 2.0+ breaks grids.
 */
export const MAX_FONT_MULTIPLIER = 1.3;
export const MIN_FONT_MULTIPLIER = 0.9;

/**
 * Convert a `useWindowDimensions().fontScale` (or the deprecated
 * `PixelRatio.getFontScale()`) into our clamped value. This is
 * applied through React Native's `maxFontSizeMultiplier` prop on
 * `<AppText>` to keep things stable.
 */
export const getClampedFontScale = (): number => {
  const raw = PixelRatio.getFontScale?.() ?? 1.0;
  return Math.max(MIN_FONT_MULTIPLIER, Math.min(MAX_FONT_MULTIPLIER, raw));
};
