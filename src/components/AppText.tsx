// AppText — the only Text component the app should use.
//
// Why a wrapper, not just the RN Text?
// ────────────────────────────────────
// 1. **Predictable typography.** Every text node in the app picks a
//    `variant` token (body, title, caption, …) instead of a raw
//    `fontSize`. The variant is the *single source of truth* for
//    font size; `style.fontSize` is stripped on the way in so any
//    hardcoded `fontSize: <num>` left in screens is inert.
// 2. **Sane defaults for long translations.** Amharic and Tigrinya
//    translations routinely expand 30–60%. We default to
//    `ellipsizeMode="tail"` and `flexShrink: 1` + `flexWrap: 'wrap'`,
//    so a card title that suddenly grows 2× wraps to a second line
//    rather than overflowing horizontally.
// 3. **Themed colour by default.** `color={colors.text}` is the
//    right colour 95% of the time, so we set it automatically and
//    let callers override with `style={{ color: ... }}`.
// 4. **Language-aware scaling.** Ge'ez scripts render ~5% larger at
//    the same nominal pixel size; AppText applies a tiny readability
//    factor through `resolveFontStyle` (am/ti: 1.05×, en/om: 1.0×).
// 5. **Accessibility capped.** `maxFontSizeMultiplier={1.3}` keeps
//    system font-size settings from breaking the grid.
// 6. **Stable identity.** The component is `React.memo`'d so a
//    re-render of a list item's parent doesn't re-render every
//    text node.

import React, { useMemo } from 'react';
import {
  StyleProp,
  StyleSheet,
  Text as RNText,
  TextProps as RNTextProps,
  TextStyle,
} from 'react-native';
import { useSettings } from '@/context/SettingsContext';
import {
  FontSizeVariant,
  Weight,
  resolveFontStyle,
  MAX_FONT_MULTIPLIER,
} from '@/constants/typography';

export interface AppTextProps extends Omit<RNTextProps, 'style' | 'numberOfLines'> {
  /** Typography variant token. Default: `'body'`. */
  variant?: FontSizeVariant;
  /** Font weight token. Default: `'regular'`. */
  weight?: Weight;
  /** Text color. Defaults to `colors.text` from the active theme. */
  color?: string;
  /**
   * Maximum number of lines before truncating. Default: `undefined`
   * (no truncation). Recommended: 1 for buttons, 2 for list-item
   * titles, 3 for card body text, undefined for hero copy.
   */
  numberOfLines?: number;
  /**
   * Ellipsize mode. Default: `'tail'`. We default to 'tail' rather
   * than 'head'/'middle' because Ge'ez-script translations are
   * commonly truncated at the *end* — important details appear at
   * the start of the string.
   */
  ellipsizeMode?: RNTextProps['ellipsizeMode'];
  /**
   * Override the resolved style. Useful for color overrides, letter
   * spacing tweaks, or text-transform. The `style` prop is merged
   * AFTER the variant token so callers can override individual
   * properties.
   */
  style?: StyleProp<TextStyle>;
  /**
   * Disable language-aware scaling. Used by numeric strings and
   * times that should remain visually identical across languages.
   */
  ignoreLanguageScale?: boolean;
  /**
   * Adjust line height ratio (default 1). Pass 1.4 for body text,
   * 1.2 for display. The value is applied as
   * `lineHeight = fontSize * lineHeightMultiplier`.
   */
  lineHeightMultiplier?: number;
  /**
   * Override the cap on the system font-scale multiplier. Default
   * uses `MAX_FONT_MULTIPLIER` from the typography module. Set
   * `null` to disable the cap entirely.
   */
  maxFontSizeMultiplier?: number | null;
  /**
   * Translate text uppercase/lowercase/title-case declaratively.
   * React Native's `TextStyle.textTransform`. Default: 'none'.
   */
  transform?: TextStyle['textTransform'];
  /**
   * Override text alignment. Default: undefined (inherits from parent).
   */
  align?: TextStyle['textAlign'];
  /**
   * Force flexShrink + flexWrap on the underlying Text. Defaults to
   * `true`. Set to `false` only when the parent has guaranteed
   * width (e.g. a fixed-size icon column).
   */
  shrink?: boolean;
  /**
   * Override the resolved font family. Use cases:
   * - `string` → use that specific font family
   * - `null` → use the system default font (SF Pro on iOS; no override on Android)
   * - `undefined` (default) → use the variant's resolved font family (Inter)
   */
  fontFamily?: string | null;
}

export const AppText: React.FC<AppTextProps> = React.memo(({
  variant = 'body',
  weight = 'regular',
  color,
  numberOfLines,
  ellipsizeMode = 'tail',
  style,
  ignoreLanguageScale = false,
  lineHeightMultiplier,
  maxFontSizeMultiplier = MAX_FONT_MULTIPLIER,
  transform,
  align,
  shrink = true,
  fontFamily: fontFamilyProp,
  children,
  allowFontScaling,
  ...rest
}) => {
  const { language, colors } = useSettings();

  // Resolve variant + weight to a TextStyle fragment. Memoised so
  // re-renders caused by *unrelated* state changes (e.g. theme
  // colour flip, language change) don't reallocate the style object
  // unless the inputs change.
  const variantStyle = useMemo(
    () => resolveFontStyle(variant, weight, language, { ignoreLanguage: ignoreLanguageScale }),
    [variant, weight, language, ignoreLanguageScale],
  );

  const resolvedFontFamily = fontFamilyProp === null
    ? undefined
    : (fontFamilyProp ?? variantStyle.fontFamily);

  const computedStyle: TextStyle = {
    ...variantStyle,
    color: color ?? colors.text,
    fontFamily: resolvedFontFamily,
    textAlign: align,
    textTransform: transform,
    flexShrink: shrink ? 1 : undefined,
    flexWrap: shrink ? 'wrap' : undefined,
  };

  // Apply optional line-height override. The variant already sets a
  // sensible line height; callers rarely need to override.
  if (lineHeightMultiplier && computedStyle.fontSize) {
    computedStyle.lineHeight = Math.round(computedStyle.fontSize * lineHeightMultiplier);
  }

  // React Native's `maxFontSizeMultiplier` is `undefined` by
  // default (no cap). We pass the cap as a number, or `null` if
  // the caller disabled it.
  const resolvedMaxMultiplier =
    maxFontSizeMultiplier === null ? null : maxFontSizeMultiplier;

  // Caller-supplied `style.fontSize` is intentionally ignored: the
  // variant is the single source of truth. This lets us strip the
  // hundreds of `fontSize: <num>` literals from screens without
  // changing any behaviour. Other style props (color, fontFamily,
  // lineHeight, letterSpacing, …) are still respected.
  const flattenedStyle = style ? StyleSheet.flatten(style) : null;
  const { fontSize: _ignoredFontSize, ...passthroughStyle } = (flattenedStyle ?? {}) as TextStyle;

  return (
    <RNText
      numberOfLines={numberOfLines}
      ellipsizeMode={ellipsizeMode}
      style={[computedStyle, passthroughStyle]}
      allowFontScaling={allowFontScaling}
      maxFontSizeMultiplier={resolvedMaxMultiplier}
      {...rest}
    >
      {children}
    </RNText>
  );
});

AppText.displayName = 'AppText';

export default AppText;
