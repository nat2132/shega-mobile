/**
 * Auto-refresh a screen whenever sync delivers new data.  The supplied loader
 * is re-invoked (debounced to the next tick) every time `bumpDataVersion()`
 * fires — whether from an HTTP pull, a WS delta, or a peer device pushing
 * through this node's mobile sync server.
 *
 * Usage:
 *
 *     useDataChangedRefresh(loadData);
 *
 * Works identically to the desktop renderer hook; just swapped for the
 * mobile/dataVersion singleton.
 */
import { useEffect, useRef } from 'react';
import { subscribeDataChanged } from '@/services/dataVersion';

export function useDataChangedRefresh(loadData: () => void | Promise<void>): void {
  const ref = useRef(loadData);
  ref.current = loadData;

  useEffect(() => {
    const unsub = subscribeDataChanged(() => {
      try { ref.current(); } catch {}
    });
    return () => { unsub(); };
  }, []);
}
