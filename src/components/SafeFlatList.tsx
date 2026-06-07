// SafeFlatList — FlatList with production-ready defaults pre-configured.
//
// Why: most lists in this app were bare <FlatList> with no
// virtualization tuning, leading to slow first paint and janky scroll
// on long lists. This wrapper ships sane defaults so individual
// screens don't have to repeat the same 6 props.
//
// Defaults:
//  - initialNumToRender: 12 (small enough to mount fast, large enough
//    to fill a phone screen on first paint)
//  - maxToRenderPerBatch: 8 (smooth incremental rendering)
//  - windowSize: 7 (≈3.5 viewports of offscreen items)
//  - removeClippedSubviews: true (native memory savings)
//  - showsVerticalScrollIndicator: false (premium look)

import React, { forwardRef } from 'react';
import { FlatList, FlatListProps } from 'react-native';

export interface SafeFlatListProps<T> extends FlatListProps<T> {
  /** Override the initial render count (default 12). */
  initialCount?: number;
  /** Override max items rendered per incremental batch (default 8). */
  batchSize?: number;
  /** Override windowSize multiplier (default 7). */
  window?: number;
}

function SafeFlatListInner<T>(
  props: SafeFlatListProps<T>,
  ref: React.Ref<FlatList<T>>,
) {
  const {
    initialCount = 12,
    batchSize = 8,
    window = 7,
    initialNumToRender = initialCount,
    maxToRenderPerBatch = batchSize,
    windowSize = window,
    removeClippedSubviews = true,
    showsVerticalScrollIndicator = false,
    ...rest
  } = props;

  return (
    <FlatList<T>
      ref={ref}
      initialNumToRender={initialNumToRender}
      maxToRenderPerBatch={maxToRenderPerBatch}
      windowSize={windowSize}
      removeClippedSubviews={removeClippedSubviews}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      {...rest}
    />
  );
}

export const SafeFlatList = forwardRef(SafeFlatListInner) as <T>(
  props: SafeFlatListProps<T> & { ref?: React.Ref<FlatList<T>> },
) => React.ReactElement;
