# Multilingual Typography System

This document explains the typography system that keeps the app layout-safe
across English, Amharic, Oromo, and Tigrinya translations.

## The problem

Amharic and Tigrinya translations routinely expand 30–60% beyond the English
source. Hard-coded `fontSize: 14` literals, fixed-width card containers, and
single-line text nodes all break under that pressure. The fix is structural,
not cosmetic: the layout adapts to the text, not the other way around.

## The five primitives

All text and most containers in the app come from one of these five
primitives. They live in `src/components/`:

| Component     | Use it for                                                       |
| ------------- | ---------------------------------------------------------------- |
| `<AppText>`   | Every text node. Never use raw `<Text>` or `<RNText>`.           |
| `<AppCard>`   | Themed card/container with token-driven padding/gap/radius.     |
| `<AppButton>` | Button with label, variant, loading, and disabled states.        |
| `<AppListItem>` | Row in a list: icon, title, subtitle, right value/badge.       |
| `<AppRow>`    | Label/value pair (e.g. "Total: 1,200 ETB").                      |

Import them all from the barrel:

```ts
import { AppText, AppCard, AppButton, AppListItem, AppRow } from '@/components/ui';
```

## The typography token system

`src/constants/typography.ts` defines a single source of truth for every
font size in the app. The token table has 14 variants, each with 5 weights,
each with a font family and line height:

| Variant      | px | Common use                                      |
| ------------ | -- | ----------------------------------------------- |
| `micro`      | 10 | Overline, badges, fine print                    |
| `caption`    | 12 | Small labels, tab labels, helper text           |
| `body-sm`    | 13 | Secondary text                                  |
| `body`       | 14 | Primary text (default)                          |
| `body-lg`    | 15 | Emphasised body                                 |
| `label`      | 14 | Input labels, field labels                      |
| `subtitle`   | 16 | Section subtitles                               |
| `title-sm`   | 16 | Card titles, list-item titles                   |
| `title`      | 18 | Screen sub-headings                             |
| `heading`    | 20 | Modal/section headings                          |
| `heading-lg` | 24 | KPI numbers, hero values                        |
| `display`    | 28 | Screen titles                                   |
| `display-lg` | 32 | Hero titles                                     |
| `hero`       | 40 | Onboarding / marketing                          |

### Language-aware scaling

The token table is the *baseline*. `resolveFontStyle` applies:

* **Per-language readability factor** — Amharic (`am`) and Tigrinya (`ti`)
  get a tiny 1.05× bump because Ge'ez glyphs render slightly wider than
  Latin. English (`en`) and Oromo (`om`) get 1.0×.
* **Line-height scaled proportionally** — the variant's line-height ratio
  is preserved when the font size is bumped.
* **`maxFontSizeMultiplier={1.3}`** — caps the OS's system text-scale
  setting so users with large accessibility text still see the layout
  intact.

`AppText` enforces all of this. You just pick a `variant`.

## How to use AppText

```tsx
import { AppText } from '@/components/ui';

// 1. The bare minimum — uses `body` variant and `colors.text` colour.
<AppText>Hello</AppText>

// 2. Pick a variant and weight.
<AppText variant="title" weight="bold">Page title</AppText>

// 3. Set a colour override.
<AppText color="#FF3B30">Overdue</AppText>

// 4. Set a max number of lines + ellipsize mode. Defaults are sane.
<AppText numberOfLines={2} ellipsizeMode="tail">Long label…</AppText>

// 5. Set an explicit text-transform, alignment, or shrink behaviour.
<AppText transform="uppercase" align="right" shrink={false}>Tag</AppText>

// 6. Override the system font-scale cap for numeric values.
<AppText variant="display" ignoreLanguageScale>1,234,567</AppText>
```

### The "style.fontSize is ignored" rule

`AppText` strips `fontSize` from the caller-supplied `style` object. The
variant is the single source of truth. This is what lets us delete hundreds
of `fontSize: 14` literals from screens without changing behaviour — they
become inert.

If you really need a non-token font size, use `<RNText>` directly and add a
comment explaining why.

### `shrink` is `true` by default

Long Amharic/Tigrinya strings will wrap to a second line automatically.
Set `shrink={false}` only for icon-sized text or for numeric strings inside
a row that already has a fixed slot.

## How to use AppListItem

`<AppListItem>` is the most common structural refactor target. Replace any
row that looks like:

```tsx
<TouchableOpacity style={styles.row}>
  <View style={styles.icon}><Icon /></View>
  <View style={{ flex: 1 }}>
    <Text style={styles.title}>{name}</Text>
    <Text style={styles.sub}>{subtitle}</Text>
  </View>
  <Text style={styles.right}>{amount}</Text>
</TouchableOpacity>
```

with:

```tsx
<AppListItem
  left={<View style={styles.icon}><Icon /></View>}
  title={name}
  subtitle={subtitle}
  rightText={amount}
  titleMaxLines={2}
  subtitleMaxLines={1}
  rightMaxLines={1}
  onPress={onPress}
  padding={Spacing.md}
  style={{ borderRadius: BorderRadius.lg }}
/>
```

The primitive handles:

* Fixed-size leading icon column (so a long title doesn't push the icon).
* `flex: 1, minWidth: 0` middle column (so a long title wraps).
* `maxWidth: '45%'` trailing column (so a long amount ellipsizes).
* `minHeight: 56` (so a wrapped 2-line title grows the row, not the grid).
* `flexWrap: 'wrap'` on every `AppText` inside.
* `borderBottomWidth: StyleSheet.hairlineWidth` by default (set `noBorder` to disable).

## How to use AppRow

For `label: value` pairs:

```tsx
<AppRow label="Subtotal" value="1,200 ETB" />
<AppRow label="Discount" value="10%" valueColor="#34C759" />
<AppRow label="Notes" value="Long Amharic string" valueVariant="body-sm" valueMaxLines={3} />
```

`AppRow` uses flex distribution: the label has `flex: 1, minWidth: 0` and
the value has `maxWidth: 60%` with `ellipsizeMode: 'tail'`. Long Amharic
labels wrap to multiple lines, and long values ellipsize at the tail
(important because Ge'ez details are at the start of the string).

## How to use AppButton

```tsx
<AppButton label="Add Product" onPress={onAdd} variant="primary" />
<AppButton label="Cancel" onPress={onCancel} variant="ghost" />
<AppButton label="Record Sale" onPress={onSave} loading={saving} disabled={!valid} />
```

The button label is a single `<AppText variant="label" weight="bold"
numberOfLines={2}>`. The button has `minHeight: 44` (HIG) and `flexWrap:
'wrap'` on the content row. Long labels wrap to a second line; the button
grows vertically but never clips.

## How to use AppCard

```tsx
<AppCard padding={Spacing.md} gap={Spacing.md} background={colors.card}>
  <AppText variant="title">Card title</AppText>
  <AppText>Body copy</AppText>
</AppCard>
```

`AppCard` is a thin wrapper that:

* Uses theme tokens for padding/gap/radius/background/border.
* Has no fixed height — it grows with content.
* Has `flexWrap: 'wrap'` on children by default.
* Lets you compose `AppRow`/`AppListItem` inside.

## Patterns to apply when adding new screens

1. **Use `<AppText variant="…" weight="…">`** — never a raw `<Text>`.
2. **Set `numberOfLines` on every label** — at least 2 for titles, 1 for
   numeric values, 3 for empty-state messages.
3. **Use `flex: 1` instead of `width: <num>`** in 2-column grids. The
   `width: width * 0.42` pattern is a layout-breaking anti-pattern.
4. **Prefer `AppListItem` for any row** that has an icon, title, and value.
5. **Prefer `AppRow` for `label: value` pairs** that sit inside a card.
6. **Never set `height: <num>` on a container that holds text.** Use
   `minHeight` instead, or no height at all.
7. **Always pass `shrink={false}` on numeric values inside a row.** Numbers
   shouldn't wrap.
8. **Use `tintColor`/`transform`/`align` props on `<AppText>`** for
   uppercase, alignment, and colour overrides — never reach for raw styles.

## Performance

* `<AppText>` is `React.memo`'d. A re-render of the parent that doesn't
  change `variant`/`weight`/`language`/`color` is a no-op.
* `variantStyle` is memoised per instance.
* `AppListItem` is `React.memo`'d with a `Pressable` for native press
  feedback (no extra `TouchableOpacity` wrapper).
* `AppRow` is `React.memo`'d.
* Lists still use `FlatList`/`FlashList` for 1k+ items — the primitives
  compose with virtualisation naturally.

## Migration tools

Three scripts in `scripts/`:

* `migrate-apptext.ps1` — replaces raw `<Text>` with `<AppText>` (run once).
* `fix-migration-imports.js` — repairs import statements after migration.
* `dedup-aptext-imports.js` — removes `AppText` imports from files that
  define `AppText` locally.
* `strip-fontsize.js` — strips static `fontSize: <num>` literals from
  `StyleSheet.create({...})` blocks (now safe because `AppText` ignores
  them). Idempotent.

Run:

```powershell
# One-time migration:
powershell scripts/migrate-apptext.ps1
node scripts/fix-migration-imports.js
node scripts/dedup-aptext-imports.js

# Clean up static fontSize literals:
node scripts/strip-fontsize.js
```

## Future work

* **More screens** — every screen in `src/screens/**` benefits from
  `AppListItem`/`AppRow`/`AppCard`. The list is long; prioritise based on
  the screens the user uses most (Dashboard, Sales, Inventory, Settings).
* **Charts** — axis labels and tooltips need `numberOfLines` and
  `ellipsizeMode: 'tail'` support on the chart library we're using.
  `react-native-gifted-charts` supports `xAxisLabelsHeight` and
  `xAxisLabelTextStyle.numberOfLines`.
* **Forms** — input fields are not part of this system yet, but they
  should accept `AppText` for labels and helper text.
* **PDF exports** — `pdf-utils.ts` uses its own font system; consider
  sharing the typography tokens.
