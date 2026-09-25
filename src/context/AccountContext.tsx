import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  AccountUser,
  loginUser,
  registerUser,
  getStoredToken,
  getStoredUser,
  setStoredToken,
  setStoredRefreshToken,
  setStoredUser,
  clearAuthStorage,
  fetchSubscriptionStatus,
  fetchLicenseStatus,
  SubscriptionStatusInfo,
  LicenseStatusInfo,
} from '@/services/api';
import { applyServerSubscriptionStatus } from '@/database/db';
import { assertInternetConnection, isOfflineError } from '@/services/connectivity';

interface AccountContextState {
  isLoading: boolean;
  isLoggedIn: boolean;
  user: AccountUser | null;
  subscription: SubscriptionStatusInfo | null;
  license: LicenseStatusInfo | null;
  isSubscriptionActive: boolean;
  isLicenseValid: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (payload: { name: string; email: string; business_name: string; password: string }) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

const AccountContext = createContext<AccountContextState | undefined>(undefined);

export const AccountProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AccountUser | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionStatusInfo | null>(null);
  const [license, setLicense] = useState<LicenseStatusInfo | null>(null);

  const isLoggedIn = !!user;

  const refreshStatus = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setLicense(null);
      return;
    }
    try {
      const sub = await fetchSubscriptionStatus();
      setSubscription(sub);
      // Mirror the backend's canonical status (trial/pending_payment/
      // payment_rejected/active/expired) into the local subscription row so
      // the premium/read-only gates match the source of truth immediately.
      applyServerSubscriptionStatus({
        status: sub.status,
        plan: sub.plan || null,
        planName: sub.plan_name || null,
        expiresAt: sub.expires_at || null,
      });
    } catch (e) {
      console.error('[Account] Failed to fetch subscription status', e);
      setSubscription(null);
    }
    try {
      const lic = await fetchLicenseStatus();
      setLicense(lic);
    } catch (e) {
      console.error('[Account] Failed to fetch license status', e);
      setLicense(null);
    }
  }, [user]);

  useEffect(() => {
    (async () => {
      try {
        const token = await getStoredToken();
        const storedUser = await getStoredUser<AccountUser>();
        if (token && storedUser) {
          setUser(storedUser);
        }
      } catch (e) {
        console.error('[Account] Restore session failed', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (user) {
      refreshStatus();
    }
  }, [user, refreshStatus]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    // Fail fast with a clear connection message instead of a generic auth
    // error before any network request is fired.
    await assertInternetConnection();
    try {
      const res = await loginUser({ email, password });
      const token = res.access || res.token;
      if (!token) {
        console.warn('[Account] Login response missing token');
        return false;
      }
      await setStoredToken(token);
      await setStoredRefreshToken(res.refresh || null);
      if (res.user) {
        await setStoredUser(res.user);
        setUser(res.user);
      }
      return true;
    } catch (e) {
      console.error('[Account] Login error', e);
      if (isOfflineError(e)) throw e;
      return false;
    }
  }, []);

  const register = useCallback(async (payload: {
    name: string;
    email: string;
    business_name: string;
    password: string;
  }): Promise<boolean> => {
    await assertInternetConnection();
    try {
      const res = await registerUser(payload);
      const token = res.token || res.access;
      const loggedUser: AccountUser = res.user || {
        id: res.id ?? 0,
        name: res.name ?? payload.name,
        email: res.email ?? payload.email,
        business_name: res.business_name ?? payload.business_name,
      };
      if (token) {
        await setStoredToken(token);
        await setStoredRefreshToken(res.refresh || null);
      }
      await setStoredUser(loggedUser);
      setUser(loggedUser);
      return true;
    } catch (e) {
      console.error('[Account] Register error', e);
      if (isOfflineError(e)) throw e;
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    await clearAuthStorage();
    setUser(null);
    setSubscription(null);
    setLicense(null);
  }, []);

  const isSubscriptionActive =
    !!subscription && (subscription.status === 'active' || subscription.status === 'pending');

  const isLicenseValid = !!license?.valid;

  return (
    <AccountContext.Provider
      value={{
        isLoading,
        isLoggedIn,
        user,
        subscription,
        license,
        isSubscriptionActive,
        isLicenseValid,
        login,
        register,
        logout,
        refreshStatus,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
};

export const useAccount = () => {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount must be used within an AccountProvider');
  return ctx;
};