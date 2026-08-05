import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '@/context/SettingsContext';

export interface AssistantInsight {
  id: string;
  type: 'alert' | 'opportunity' | 'info' | 'summary';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  icon: string;
  action?: string;
  value?: string;
}

export function useBusinessAssistant(): {
  insights: AssistantInsight[];
  loading: boolean;
  refresh: () => void;
} {
  const { t } = useSettings();

  const [insights, setInsights] = useState<AssistantInsight[]>([]);
  const [loading, setLoading] = useState(true);

  const generateInsights = useCallback(() => {
    try {
      const db = require('@/database/db');
      const result: AssistantInsight[] = [];

      const lowStockItems = db.getLowStockItems();
      if (lowStockItems?.length > 0) {
        const names = lowStockItems.slice(0, 3).map((i: any) => i.name).join(', ');
        result.push({
          id: 'low-stock',
          type: 'alert',
          priority: 'high',
          title: t('assistant.low_stock_title', { count: String(lowStockItems.length) }),
          description: lowStockItems.length <= 3
            ? t('assistant.low_stock_desc_few', { names })
            : t('assistant.low_stock_desc_many', { names, count: String(lowStockItems.length - 3) }),
          icon: 'alert-triangle',
          action: t('assistant.action_restock'),
        });
      }

      const topSelling = db.getTopSellingItems(5);
      if (topSelling?.length > 0) {
        result.push({
          id: 'top-selling',
          type: 'opportunity',
          priority: 'medium',
          title: t('assistant.best_selling_title'),
          description: topSelling.slice(0, 3).map((i: any) =>
            t('assistant.best_selling_item', { name: i.name, qty: String(i.totalQty || i.quantity || 0) })
          ).join(', '),
          icon: 'trending-up',
          value: t('assistant.best_selling_value', { name: topSelling[0]?.name || '' }),
        });
      }

      const slowMoving = db.getSlowMovingItems(5);
      if (slowMoving?.length > 0) {
        result.push({
          id: 'slow-moving',
          type: 'alert',
          priority: 'medium',
          title: t('assistant.slow_moving_title', { count: String(slowMoving.length) }),
          description: t('assistant.slow_moving_desc'),
          icon: 'clock',
          action: t('assistant.action_review_items'),
        });
      }

      const budgetAlerts = db.getBudgetAlerts(80);
      if (budgetAlerts?.length > 0) {
        const exceeded = budgetAlerts.filter((b: any) => b.isExceeded);
        const nearLimit = budgetAlerts.filter((b: any) => !b.isExceeded);
        if (exceeded.length > 0) {
          const names = exceeded.slice(0, 3).map((b: any) => b.category || b.name).join(', ');
          result.push({
            id: 'budget-overrun',
            type: 'alert',
            priority: 'high',
            title: t('assistant.budget_alert_title', { count: String(exceeded.length) }),
            description: exceeded.length <= 3
              ? t('assistant.budget_alert_desc_few', { names })
              : t('assistant.budget_alert_desc_many', { names, count: String(exceeded.length - 3) }),
            icon: 'alert-triangle',
            action: t('assistant.action_view_budgets'),
          });
        }
        if (nearLimit.length > 0) {
          const names = nearLimit.slice(0, 3).map((b: any) => b.category || b.name).join(', ');
          result.push({
            id: 'budget-near-limit',
            type: 'info',
            priority: 'low',
            title: t('assistant.budget_near_title', { count: String(nearLimit.length) }),
            description: nearLimit.length <= 3
              ? t('assistant.budget_near_desc_few', { names })
              : t('assistant.budget_near_desc_many', { names, count: String(nearLimit.length - 3) }),
            icon: 'bar-chart',
            action: t('assistant.action_view_budgets'),
          });
        }
      }

      const orderSummary = db.getOrderSummary();
      if (orderSummary && orderSummary.active > 0) {
        result.push({
          id: 'order-pending',
          type: 'alert',
          priority: 'high',
          title: t('assistant.order_pending_title', { count: String(orderSummary.active) }),
          description: t('assistant.order_pending_desc', { count: String(orderSummary.active) }),
          icon: 'shopping-bag',
          action: t('assistant.action_view_orders'),
        });
      }

      const supplierList = db.getSupplierList();
      const supplierDebtList = (supplierList || []).filter((s: any) => s.hasDebt);
      if (supplierDebtList.length > 0) {
        const totalOwed = supplierDebtList.reduce((sum: number, s: any) => sum + (s.outstanding || 0), 0);
        result.push({
          id: 'supplier-debt',
          type: 'alert',
          priority: 'medium',
          title: t('assistant.supplier_debt_title', { count: String(supplierDebtList.length) }),
          description: t('assistant.supplier_debt_desc', { amount: totalOwed.toLocaleString() }),
          icon: 'truck',
          action: t('assistant.action_view_suppliers'),
          value: t('common.etb') + ' ' + totalOwed.toLocaleString(),
        });
      } else if (supplierList && supplierList.length > 0) {
        result.push({
          id: 'supplier-summary',
          type: 'info',
          priority: 'low',
          title: t('assistant.supplier_summary_title', { count: String(supplierList.length) }),
          description: t('assistant.supplier_summary_desc'),
          icon: 'truck',
          action: t('assistant.action_view_suppliers'),
        });
      }

      const stats = db.getDashboardStats();
      const todayRev = stats?.today?.revenue || 0;
      const yesterdayRev = stats?.yesterday?.revenue || 0;
      if (todayRev > 0 || yesterdayRev > 0) {
        const pct = yesterdayRev > 0 ? ((todayRev - yesterdayRev) / yesterdayRev) * 100 : 0;
        result.push({
          id: 'daily-summary',
          type: 'summary',
          priority: 'low',
          title: t('assistant.daily_summary_title'),
          description: yesterdayRev > 0
            ? t('assistant.daily_summary_desc', { rev: todayRev.toLocaleString(), pct: pct.toFixed(1) })
            : t('assistant.daily_summary_first', { rev: todayRev.toLocaleString() }),
          icon: 'bar-chart',
          value: t('common.etb') + ' ' + todayRev.toLocaleString(),
        });
      }

      const topItems = db.getTopHighestValueItems(5);
      if (topItems?.length > 0) {
        result.push({
          id: 'highest-profit',
          type: 'opportunity',
          priority: 'medium',
          title: t('assistant.highest_value_title'),
          description: topItems.slice(0, 3).map((i: any) =>
            t('assistant.highest_value_item', {
              name: i.name,
              value: ((i.totalBaseQuantity || 0) * (i.baseSellingPrice || 0)).toLocaleString(),
            })
          ).join(', '),
          icon: 'dollar-sign',
          action: t('assistant.action_view_inventory'),
        });
      }

      const expenseStats = db.getExpenseComparisonStats();
      if (expenseStats) {
        const diff = (expenseStats.thisMonthLoss || 0) - (expenseStats.lastMonthLoss || 0);
        if (diff > 0) {
          result.push({
            id: 'expense-increase',
            type: 'alert',
            priority: 'medium',
            title: t('assistant.expense_increase_title'),
            description: t('assistant.expense_increase_desc', { diff: diff.toLocaleString() }),
            icon: 'trending-down',
            action: t('assistant.action_review_expenses'),
          });
        }
      }

      const debtSummary = db.getDebtSummary();
      if (debtSummary?.debtorCount > 0) {
        result.push({
          id: 'top-customers',
          type: 'info',
          priority: 'low',
          title: t('assistant.debt_customers_title', { count: String(debtSummary.debtorCount) }),
          description: t('assistant.debt_customers_desc', {
            amount: (debtSummary.totalOwed || 0).toLocaleString(),
            overdue: String(debtSummary.overdueCount || 0),
          }),
          icon: 'users',
          action: t('assistant.action_view_customers'),
          value: t('common.etb') + ' ' + (debtSummary.totalOwed || 0).toLocaleString(),
        });
      }

      const adjMetrics = db.getAdjustmentDashboardMetrics();
      if (adjMetrics?.damagedItems > 0) {
        result.push({
          id: 'damage-report',
          type: 'alert',
          priority: 'low',
          title: t('assistant.damaged_title', { count: String(adjMetrics.damagedItems) }),
          description: t('assistant.damaged_desc', { count: String(adjMetrics.damagedItems) }),
          icon: 'alert-triangle',
        });
      }

      const onCredit = db.getOnCreditItems();
      if (onCredit?.length > 0) {
        result.push({
          id: 'credit-items',
          type: 'info',
          priority: 'medium',
          title: t('assistant.credit_items_title', { count: String(onCredit.length) }),
          description: t('assistant.credit_items_desc', { count: String(onCredit.length) }),
          icon: 'credit-card',
          action: t('assistant.action_view_credit'),
        });
      }

      if (result.length === 0) {
        result.push({
          id: 'all-clear',
          type: 'summary',
          priority: 'low',
          title: t('assistant.all_clear_title'),
          description: t('assistant.all_clear_desc'),
          icon: 'check-circle',
        });
      }

      result.sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.priority] - order[b.priority];
      });

      setInsights(result);
    } catch (e) {
      console.warn('Assistant insight generation failed:', e);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { generateInsights(); }, [generateInsights]);

  return { insights, loading, refresh: generateInsights };
}
