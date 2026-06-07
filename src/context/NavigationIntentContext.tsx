// Cross-screen navigation intent system.
// Notifications, deep links, and any other entry point can publish a
// "navigation intent" — e.g. "open collect-payments for customer X" or
// "open subscription page" — and the relevant screen consumes the intent
// on focus and acts on it. This avoids spawning a separate route for
// every deep link and keeps the user inside the in-app flows they
// already know.

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

export type NavigationIntent =
  | { kind: 'collect_payments'; customerName?: string; at: number }
  | { kind: 'subscription'; at: number };

interface NavigationIntentContextProps {
  /** Set (or replace) the current pending intent. */
  publishIntent: (intent: NavigationIntent) => void;
  /** Current intent value (re-renders consumer when it changes). */
  intent: NavigationIntent | null;
  /** Read the current intent (does not clear it). */
  getIntent: () => NavigationIntent | null;
  /** Read and clear the current intent. */
  consumeIntent: () => NavigationIntent | null;
  /** Clear the current intent. */
  clearIntent: () => void;
}

const NavigationIntentContext = createContext<NavigationIntentContextProps | undefined>(undefined);

export const NavigationIntentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [intent, setIntent] = useState<NavigationIntent | null>(null);
  // Mirror state into a ref so consumer helpers below can be STABLE
  // across renders. Otherwise `consumeIntent` would change identity on
  // every publish, causing consumers' useEffect/useCallback/useFocusEffect
  // to re-register mid-navigation and miss the focus event.
  const intentRef = useRef<NavigationIntent | null>(null);

  const publishIntent = useCallback((next: NavigationIntent) => {
    intentRef.current = next;
    setIntent(next);
  }, []);

  const getIntent = useCallback(() => intentRef.current, []);

  const consumeIntent = useCallback(() => {
    const next = intentRef.current;
    if (next) {
      intentRef.current = null;
      setIntent(null);
    }
    return next;
  }, []);

  const clearIntent = useCallback(() => {
    intentRef.current = null;
    setIntent(null);
  }, []);

  const value = useMemo(
    () => ({ publishIntent, getIntent, consumeIntent, clearIntent, intent }),
    [publishIntent, getIntent, consumeIntent, clearIntent, intent],
  );

  return (
    <NavigationIntentContext.Provider value={value}>
      {children}
    </NavigationIntentContext.Provider>
  );
};

export const useNavigationIntent = (): NavigationIntentContextProps => {
  const ctx = useContext(NavigationIntentContext);
  if (!ctx) {
    throw new Error('useNavigationIntent must be used inside <NavigationIntentProvider>');
  }
  return ctx;
};
