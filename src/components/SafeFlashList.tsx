// SafeFlashList — wrapper around @shopify/flash-list with sane
// defaults. Use this for screens expected to render hundreds or
// thousands of items (contacts, sales records, inventory,
// notifications, reminders, etc).
//
// FlashList is significantly faster than FlatList on long lists
// because it recycles views like RecyclerView. The trade-off is that
// item heights must be predictable — callers should pass
// `estimatedItemSize` so FlashList can size the scrollbar correctly
// during the first paint.

import React, { forwardRef } from 'react';
import { FlashList, FlashListProps, FlashListRef } from '@shopify/flash-list';

export interface SafeFlashListProps<T> extends Omit<FlashListProps<T>, 'ref'> {
  // no extra props today; kept as a stable extension point.
}

function SafeFlashListInner<T>(
  props: SafeFlashListProps<T>,
  ref: React.Ref<FlashListRef<T>>,
) {
  return <FlashList<T> ref={ref} {...props} />;
}

export const SafeFlashList = forwardRef(SafeFlashListInner) as <T>(
  props: SafeFlashListProps<T> & { ref?: React.Ref<FlashListRef<T>> },
) => React.ReactElement;
