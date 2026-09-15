import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const ATTEMPTS_KEY = 'auth_pin_attempts';
const LOCKOUT_KEY = 'auth_lockout_until';
const LOCKOUT_COUNT_KEY = 'auth_lockout_count';
const SESSION_KEY = 'auth_session_active';
const MAX_ATTEMPTS = 5;
// Escalating cool-down: 1 min → 2 min → 5 min (capped), so brute-forcing the
// PIN gets progressively more expensive.
const LOCKOUT_STEPS_MS = [60_000, 120_000, 300_000];
const INACTIVITY_TIMEOUT_MS = 300_000;

interface AuthContextType {
  isAuthenticated: boolean;
  isLocked: boolean;
  lockoutRemaining: number;
  attemptsRemaining: number;
  authenticate: () => void;
  recordFailedAttempt: () => Promise<number>;
  resetAttempts: () => Promise<void>;
  lockoutEndTime: () => Promise<number>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState(MAX_ATTEMPTS);
  const lastActivityRef = useRef(Date.now());
  const appStateRef = useRef<AppStateStatus>('active');
  const lockoutTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearLockoutTimer = useCallback(() => {
    if (lockoutTimerRef.current) {
      clearInterval(lockoutTimerRef.current);
      lockoutTimerRef.current = null;
    }
  }, []);

  const startLockoutCountdown = useCallback(async () => {
    let lockoutCount = 0;
    try {
      lockoutCount = parseInt((await SecureStore.getItemAsync(LOCKOUT_COUNT_KEY)) ?? '0', 10) || 0;
    } catch { /* default 0 */ }
    const step = Math.min(lockoutCount, LOCKOUT_STEPS_MS.length - 1);
    const duration = LOCKOUT_STEPS_MS[step];
    await SecureStore.setItemAsync(LOCKOUT_COUNT_KEY, String(Math.min(lockoutCount + 1, LOCKOUT_STEPS_MS.length)));
    const lockoutUntil = Date.now() + duration;
    await SecureStore.setItemAsync(LOCKOUT_KEY, String(lockoutUntil));
    setIsLocked(true);
    setLockoutRemaining(duration / 1000);

    clearLockoutTimer();
    lockoutTimerRef.current = setInterval(async () => {
      const remaining = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
      setLockoutRemaining(remaining);
      if (remaining <= 0) {
        clearLockoutTimer();
        setIsLocked(false);
        setLockoutRemaining(0);
        setAttemptsRemaining(MAX_ATTEMPTS);
        await SecureStore.setItemAsync(ATTEMPTS_KEY, '0');
        await SecureStore.deleteItemAsync(LOCKOUT_KEY);
      }
    }, 1000);
  }, [clearLockoutTimer]);

  const successfulAuth = useCallback(async () => {
    // A successful sign-in clears the escalation counter.
    try { await SecureStore.deleteItemAsync(LOCKOUT_COUNT_KEY); } catch { /* ignore */ }
  }, []);

  const checkLockoutOnMount = useCallback(async () => {
    const lockoutUntil = await SecureStore.getItemAsync(LOCKOUT_KEY);
    if (lockoutUntil) {
      const remaining = parseInt(lockoutUntil, 10) - Date.now();
      if (remaining > 0) {
        startLockoutCountdown();
      } else {
        await SecureStore.deleteItemAsync(LOCKOUT_KEY);
      }
    }
    const attempts = await SecureStore.getItemAsync(ATTEMPTS_KEY);
    if (attempts) {
      setAttemptsRemaining(MAX_ATTEMPTS - parseInt(attempts, 10));
    }
  }, [startLockoutCountdown]);

  useEffect(() => {
    checkLockoutOnMount();

    const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (prevState === 'active' && nextState.match(/inactive|background/)) {
        lastActivityRef.current = Date.now();
      }

      if (nextState === 'active') {
        const elapsed = Date.now() - lastActivityRef.current;
        if (prevState.match(/inactive|background/) && elapsed >= INACTIVITY_TIMEOUT_MS && isAuthenticated) {
          setIsAuthenticated(false);
        }
      }
    });

    return () => {
      subscription.remove();
      clearLockoutTimer();
    };
  }, [isAuthenticated, checkLockoutOnMount, clearLockoutTimer]);

  const authenticate = useCallback(() => {
    setIsAuthenticated(true);
    lastActivityRef.current = Date.now();
    void successfulAuth();
  }, [successfulAuth]);

  const recordFailedAttempt = useCallback(async (): Promise<number> => {
    const attemptsStr = await SecureStore.getItemAsync(ATTEMPTS_KEY);
    const attempts = (attemptsStr ? parseInt(attemptsStr, 10) : 0) + 1;
    await SecureStore.setItemAsync(ATTEMPTS_KEY, String(attempts));
    const remaining = MAX_ATTEMPTS - attempts;
    setAttemptsRemaining(Math.max(0, remaining));

    if (attempts >= MAX_ATTEMPTS) {
      await startLockoutCountdown();
    }

    return attempts;
  }, [startLockoutCountdown]);

  const resetAttempts = useCallback(async () => {
    await SecureStore.setItemAsync(ATTEMPTS_KEY, '0');
    setAttemptsRemaining(MAX_ATTEMPTS);
  }, []);

  const lockoutEndTime = useCallback(async (): Promise<number> => {
    const lockoutUntil = await SecureStore.getItemAsync(LOCKOUT_KEY);
    return lockoutUntil ? parseInt(lockoutUntil, 10) : 0;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLocked,
        lockoutRemaining,
        attemptsRemaining,
        authenticate,
        recordFailedAttempt,
        resetAttempts,
        lockoutEndTime,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
