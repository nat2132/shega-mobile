// useChartData — a small hook that gates a chart's render state
// (loading / empty / ready / error) and sanitises the input data so we
// never feed NaN, undefined, or out-of-range values to the real
// chart components.
//
// Why this exists:
// - Some callers (sales.tsx, expense.tsx) start with `[]` for chart
//   data. With react-native-gifted-charts, an empty array shows an
//   empty frame that briefly flashes zeros; a non-empty array of
//   stale/default values can show "fake" bars.
// - We need a single, consistent loading-state contract across all
//   charts in the app so the skeleton loader and the real chart swap
//   in a single render pass (no flicker).
//
// States:
//   'loading' — initial mount or refresh, no data yet
//   'empty'   — data was loaded and is empty (real "no data" state)
//   'ready'   — data is valid and can be rendered
//   'error'   — input data failed validation (NaN, all-zeros when
//               non-zero expected, etc.)
//
// Usage:
//   const { state, sanitized } = useChartData(values, { minPoints: 1 });
//   if (state !== 'ready') return <BarChartSkeleton ... />;
//   return <BarChart data={sanitized} ... />;

import { useEffect, useMemo, useState } from 'react';

export type ChartState = 'loading' | 'empty' | 'ready' | 'error';

export interface ChartDataPoint {
  value: number;
  label?: string;
  [key: string]: any;
}

export interface UseChartDataOptions<T> {
  /** Force the loading state to persist until this flag flips true. */
  ready?: boolean;
  /** Minimum number of points required to be considered "ready". */
  minPoints?: number;
  /**
   * Optional custom validator. Return false to mark the data as
   * invalid (`error` state).
   */
  validate?: (data: T[]) => boolean;
  /**
   * Sanitize each data point. Defaults to clamping `value` to a safe
   * numeric range and removing NaN.
   */
  sanitize?: (point: T) => T;
}

const defaultSanitize = <T extends ChartDataPoint>(p: T): T => {
  if (!p || typeof p !== 'object') return p;
  const v = Number(p.value);
  const safeValue = Number.isFinite(v) && !Number.isNaN(v) ? Math.max(0, v) : 0;
  return { ...p, value: safeValue };
};

export function useChartData<T extends ChartDataPoint>(
  data: T[] | null | undefined,
  options: UseChartDataOptions<T> = {},
): { state: ChartState; sanitized: T[] } {
  const {
    ready,
    minPoints = 1,
    validate,
    sanitize = defaultSanitize,
  } = options;

  // If the caller passes an explicit `ready` flag, prefer it.
  const [internalReady, setInternalReady] = useState(false);
  useEffect(() => {
    if (ready === undefined) {
      // Without a ready flag, the chart is only considered "ready"
      // after the first render that includes non-undefined data.
      // We don't actually need to set this — it's a no-op marker
      // for future extension (e.g., delayed-load animations).
      setInternalReady(true);
    }
  }, [ready]);

  const isExternallyReady = ready !== undefined ? ready : true;

  return useMemo(() => {
    if (!isExternallyReady) {
      return { state: 'loading' as ChartState, sanitized: [] as T[] };
    }
    if (data == null) {
      return { state: 'loading' as ChartState, sanitized: [] as T[] };
    }
    if (!Array.isArray(data) || data.length === 0) {
      return { state: 'empty' as ChartState, sanitized: [] as T[] };
    }
    const sanitized = data.map(sanitize);
    if (sanitized.length < minPoints) {
      return { state: 'empty' as ChartState, sanitized };
    }
    if (validate && !validate(sanitized)) {
      return { state: 'error' as ChartState, sanitized };
    }
    return { state: 'ready' as ChartState, sanitized };
  }, [data, isExternallyReady, minPoints, validate, sanitize, internalReady]);
}
