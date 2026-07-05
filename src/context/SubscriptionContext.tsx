import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  getSubscription,
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
  approveSubscription,
  SubscriptionData,
} from '@/database/db';

export const PREMIUM_FEATURES = [
  'reports',
  'dashboard_overview',
  'pdf_download',
  'csv_import',
  'csv_export',
  'expense',
  'budget',
  'debt',
  'orders',
  'purchase_orders',
  'multi_warehouse',
  'ai_assistant',
  'health_score',
  'biometrics',
  'themes',
  'supplier_reminders',
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
  expense: {
    name: 'Expense Management',
    description: 'Track all business expenses and understand where your money goes.',
    benefits: ['Better financial control', 'Understand profits', 'Smarter spending'],
  },
  budget: {
    name: 'Budget Management',
    description: 'Create and manage budgets for your business.',
    benefits: ['Plan your spending', 'Stay on track', 'Reduce waste'],
  },
  debt: {
    name: 'Debt Management',
    description: 'Manage customer debts and payment tracking.',
    benefits: ['Track owed amounts', 'Automate reminders', 'Improve cash flow'],
  },
  orders: {
    name: 'Customer Orders',
    description: 'Manage customer orders from placement to fulfillment.',
    benefits: ['Streamline ordering', 'Track fulfillment', 'Better customer service'],
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
};

const BASIC_FEATURES = ['inventory', 'sales', 'contacts', 'adjustments'];

interface SubscriptionContextType {
  subscription: SubscriptionData | null;
  isLoading: boolean;
  trialDaysRemaining: number;
  isPremium: boolean;
  isTrial: boolean;
  refresh: () => Promise<void>;
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

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectPlan = useCallback(async (plan: string, durationMonths: number, price: number) => {
    const result = updateSubscriptionPlan(plan, durationMonths, price);
    if (result) await refresh();
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

  const refreshTrialDays = useCallback(async () => {
    setTrialDaysRemaining(getTrialDaysRemaining());
  }, []);

  const isPremium = subscription?.status === 'active' && subscription?.plan === 'premium';
  const isTrial = subscription?.status === 'trial';

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        isLoading,
        trialDaysRemaining,
        isPremium,
        isTrial,
        refresh,
        selectPlan,
        submitPayment,
        cancelCurrentSubscription,
        renewCurrentSubscription,
        isFeatureUnlocked,
        isBasicFeature,
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
