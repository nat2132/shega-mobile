import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  checkAndExpireSubscription,
  updateSubscriptionPlan,
  verifySubscriptionPayment,
  insertSubscriptionPayment,
  cancelSubscription,
  renewSubscription,
  getTrialDaysRemaining,
  isPremiumFeatureUnlocked,
  getSubscriptionPayments,
  getSubscriptionRenewals,
  getSubscriptionAuditLog,
  applyServerSubscriptionStatus,
  SubscriptionData,
} from '@/database/db';
import { fetchSubscriptionStatus, isRateLimited } from '@/services/api';

export const PREMIUM_FEATURES = [
  'reports',
  'dashboard_overview',
  'pdf_download',
  'csv_import',
  'csv_export',
  'debt',
  'purchase_orders',
  'multi_warehouse',
  'ai_assistant',
  'health_score',
  'biometrics',
  'themes',
  'supplier_reminders',
  'supplier_management',
] as const;

export type PremiumFeature = typeof PREMIUM_FEATURES[number];

export const FEATURE_LABELS: Record<PremiumFeature, { name: string; description: string; benefits: string[] }> = {
  reports: {
    name: 'Reports',
    description: 'Generate detailed business reports and analytics.',
    benefits: ['Track business performance', 'Make data-driven decisions', 'Identify growth opportunities'],
  },
  dashboard_overview: {
    name: 'Dashboard Overview',
    description: 'Get a complete overview of your business at a glance.',
    benefits: ['Real-time business insights', 'Visual performance metrics', 'Quick decision making'],
  },
  pdf_download: {
    name: 'PDF Receipt Downloads',
    description: 'Download and share professional PDF receipts.',
    benefits: ['Professional receipts', 'Easy record keeping', 'Share with customers'],
  },
  csv_import: {
    name: 'CSV Import',
    description: 'Import inventory and sales data from CSV files.',
    benefits: ['Bulk data import', 'Save time on data entry', 'Migrate from other tools'],
  },
  csv_export: {
    name: 'CSV Export',
    description: 'Export your business data to CSV format.',
    benefits: ['Data portability', 'Backup your records', 'Analyze in spreadsheets'],
  },
  debt: {
    name: 'Debt Management',
    description: 'Manage customer debts and payment tracking.',
    benefits: ['Track owed amounts', 'Automate reminders', 'Improve cash flow'],
  },
  purchase_orders: {
    name: 'Purchase Orders',
    description: 'Create and manage purchase orders for suppliers.',
    benefits: ['Simplify procurement', 'Track supplier orders', 'Manage inventory'],
  },
  multi_warehouse: {
    name: 'Multi Warehouse',
    description: 'Manage inventory across multiple warehouse locations.',
    benefits: ['Track all locations', 'Optimize stock distribution', 'Full inventory visibility'],
  },
  ai_assistant: {
    name: 'AI Business Assistant',
    description: 'Get intelligent insights and recommendations for your business.',
    benefits: ['Smart recommendations', 'Business insights', 'Save time'],
  },
  health_score: {
    name: 'Business Health Score',
    description: 'Monitor your business health with a comprehensive score.',
    benefits: ['Overall business view', 'Identify risks early', 'Track improvement'],
  },
  biometrics: {
    name: 'Biometrics',
    description: 'Secure the app with fingerprint or face unlock.',
    benefits: ['Fast access', 'Enhanced security', 'Modern convenience'],
  },
  themes: {
    name: 'Themes',
    description: 'Customize the app appearance with premium themes.',
    benefits: ['Personalized experience', 'Professional look', 'Visual appeal'],
  },
  supplier_reminders: {
    name: 'Supplier Credit Reminders',
    description: 'Get reminders for supplier credit payments.',
    benefits: ['Never miss a payment', 'Maintain good relationships', 'Avoid late fees'],
  },
  supplier_management: {
    name: 'Supplier Management',
    description: 'Full supplier management including orders, payments, and purchase tracking.',
    benefits: ['Track supplier orders', 'Manage supplier payments', 'View purchase history'],
  },
};

const BASIC_FEATURES = ['inventory', 'sales', 'contacts', 'adjustments'];

interface SubscriptionContextType {
  subscription: SubscriptionData | null;
  isLoading: boolean;
  trialDaysRemaining: number;
  isPremium: boolean;
  isTrial: boolean;
  isExpired: boolean;
  isReadOnly: boolean;
  isExpiringSoon: boolean;
  daysUntilExpiry: number;
  refresh: () => Promise<void>;
  syncWithServer: () => Promise<void>;
  selectPlan: (plan: string, durationMonths: number, price: number) => Promise<boolean>;
  submitPayment: (data: {
    transactionId: string;
    businessName: string;
    phoneNumber: string;
    planName: string;
    amount: number;
    paymentDate: string;
    notes?: string;
  }) => Promise<boolean>;
  cancelCurrentSubscription: () => Promise<boolean>;
  renewCurrentSubscription: (durationMonths: number, price: number) => Promise<boolean>;
  isFeatureUnlocked: (feature: string) => boolean;
  isBasicFeature: (feature: string) => boolean;
  isFeatureLocked: (feature: string) => boolean;
  refreshTrialDays: () => Promise<void>;
  payments: any[];
  renewals: any[];
  auditLog: any[];
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(0);
  const [payments, setPayments] = useState<any[]>([]);
  const [renewals, setRenewals] = useState<any[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);

   const refresh = useCallback(async () => {
    try {
      const sub = checkAndExpireSubscription();
      setSubscription(sub);
      setTrialDaysRemaining(getTrialDaysRemaining());
      setPayments(getSubscriptionPayments());
      setRenewals(getSubscriptionRenewals());
      setAuditLog(getSubscriptionAuditLog());
    } catch (error) {
      console.error('Refresh subscription error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Best-effort reconciliation with the backend. The local DB is the source of
  // truth (offline-first), but the backend mirrors its canonical status
  // (trial / pending_payment / payment_rejected / active / expired / none) once
  // a payment is approved or rejected so the premium gate flips immediately.
  // Failures (no network, 401, 429) are swallowed so the app keeps working
  // offline using local state.
  const syncWithServer = useCallback(async () => {
    try {
      const serverStatus = await fetchSubscriptionStatus();
      applyServerSubscriptionStatus({
        status: serverStatus.status,
        plan: serverStatus.plan || null,
        planName: serverStatus.plan_name || null,
        expiresAt: serverStatus.expires_at || null,
      });
      await refresh();
    } catch (error: any) {
      // Swallow offline / 401 / 429: keep relying on the local cache. We do
      // surface a transient 429 hint to the UI via state so callers can back off.
      if (isRateLimited(error)) {
        console.warn('[Subscription] sync throttled; backing off.');
      }
    }
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectPlan = useCallback(async (plan: string, durationMonths: number, price: number) => {
    const result = updateSubscriptionPlan(plan, durationMonths, price);
    if (result) await refresh();
    else console.error('selectPlan failed: invalid plan/price combination');
    return result;
  }, [refresh]);

  const submitPayment = useCallback(async (data: {
    transactionId: string;
    businessName: string;
    phoneNumber: string;
    planName: string;
    amount: number;
    paymentDate: string;
    notes?: string;
  }) => {
    const result = insertSubscriptionPayment(data);
    if (result) {
      verifySubscriptionPayment();
      await refresh();
    }
    return result;
  }, [refresh]);

  const cancelCurrentSubscription = useCallback(async () => {
    const result = cancelSubscription();
    if (result) await refresh();
    return result;
  }, [refresh]);

  const renewCurrentSubscription = useCallback(async (durationMonths: number, price: number) => {
    const result = renewSubscription(durationMonths, price);
    if (result) await refresh();
    return result;
  }, [refresh]);

  const isFeatureUnlocked = useCallback((feature: string) => {
    return isPremiumFeatureUnlocked(feature);
  }, []);

  const isBasicFeature = useCallback((feature: string) => {
    return BASIC_FEATURES.includes(feature);
  }, []);

  // Access is not tiered: the plans differ by EDITION (Mobile / Desktop /
  // Mobile + Desktop), not by capability, so an active or trial subscription
  // unlocks every feature. Only the not-yet-paid states lock anything.
  const LOCKED_STATUSES = ['expired', 'cancelled', 'rejected', 'pending_verification', 'pending_payment', 'payment_rejected'];

  const isFeatureLocked = useCallback((feature: string) => {
    if (!PREMIUM_FEATURES.includes(feature as any)) return false;
    if (!subscription) return true;
    return LOCKED_STATUSES.includes(subscription.status || '');
  }, [subscription]);

  const refreshTrialDays = useCallback(async () => {
    setTrialDaysRemaining(getTrialDaysRemaining());
  }, []);

  const isTrial = subscription?.status === 'trial';
  // View-only: waiting on approval, rejected, cancelled, or lapsed. Sales and
  // edit actions stay locked until the subscription is restored.
  const isReadOnly = LOCKED_STATUSES.includes(subscription?.status || '');
  const isPremium = !isReadOnly && (subscription?.status === 'active' || isTrial);
  const isExpired = subscription?.status === 'expired';

  const daysUntilExpiry = (() => {
    if (!subscription?.expiresAt) return 0;
    const expiry = new Date(subscription.expiresAt);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  })();

  const isExpiringSoon = daysUntilExpiry <= 7 && daysUntilExpiry > 0 && subscription?.status === 'active';

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        isLoading,
        trialDaysRemaining,
        isPremium,
        isTrial,
        isExpired,
        isReadOnly,
        isExpiringSoon,
        daysUntilExpiry,
        refresh,
        syncWithServer,
        selectPlan,
        submitPayment,
        cancelCurrentSubscription,
        renewCurrentSubscription,
        isFeatureUnlocked,
        isBasicFeature,
        isFeatureLocked,
        refreshTrialDays,
        payments,
        renewals,
        auditLog,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
};
