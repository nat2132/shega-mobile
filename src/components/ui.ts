// Barrel export for the multilingual-safe text + layout primitives.
//
// Why a barrel?
// ──────────────
// Each screen ends up importing 4–6 primitives (AppText, AppButton,
// AppCard, AppListItem, AppRow). Centralising them in a single
// import makes refactors painless:
//
//   import { AppText, AppButton, AppCard, AppListItem, AppRow } from '@/components/ui';
//
// instead of:
//
//   import { AppText } from '@/components/AppText';
//   import { AppButton } from '@/components/AppButton';
//   import { AppCard } from '@/components/AppCard';
//   import { AppListItem } from '@/components/AppListItem';
//   import { AppRow } from '@/components/AppRow';
//
// Adding a new primitive (e.g. AppChip, AppBadge) is then a one-line
// addition to this file rather than touching every consumer.

export { AppText } from './AppText';
export type { AppTextProps } from './AppText';

export { AppButton } from './AppButton';
export type { AppButtonProps, AppButtonVariant } from './AppButton';

export { AppCard } from './AppCard';
export type { AppCardProps } from './AppCard';

export { AppListItem } from './AppListItem';
export type { AppListItemProps } from './AppListItem';

export { AppRow } from './AppRow';
export type { AppRowProps } from './AppRow';

export { AppNumber } from './AppNumber';
export type { AppNumberProps, NumberSize } from './AppNumber';
