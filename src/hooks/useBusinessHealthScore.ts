import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '@/context/SettingsContext';

export interface HealthFactor {
  key: string;
  label: string;
  score: number;
  weight: number;
  status: 'good' | 'warning' | 'critical';
}

export interface HealthScoreResult {
  score: number;
  rating: 'excellent' | 'good' | 'fair' | 'needs_attention';
  factors: HealthFactor[];
  recommendations: string[];
}

const FACTOR_KEYS = [
  'sales', 'margin', 'growth', 'expense',
  'inventory', 'budget', 'customers', 'adjustments',
] as const;

export function useBusinessHealthScore(enabled = true): {
  health: HealthScoreResult | null;
  loading: boolean;
  refresh: () => void;
} {
  const { t } = useSettings();
  const [health, setHealth] = useState<HealthScoreResult | null>(null);
  const [loading, setLoading] = useState(true);

  const calculate = useCallback(() => {
    if (!enabled) {
      setHealth(null);
      setLoading(false);
      return;
    }
    try {
      const db = require('@/database/db');
      const stats = db.getDashboardStats();
      const inventoryStats = db.getInventoryStats();
      const budgetDashboard = db.getBudgetDashboard();
      const debtSummary = db.getDebtSummary();
      const adjMetrics = db.getAdjustmentDashboardMetrics();
      const lowStock = db.getLowStockItems();

      const today = stats?.today || {};
      const yesterday = stats?.yesterday || {};

      const ins = inventoryStats || {};
      const lowStockCount = ins.lowStockCount || lowStock?.length || 0;
      const totalItems = (ins.totalItems || ins.totalValue ? (ins.totalItems || 1) : 1);
      const outOfStockRatio = ins.outOfStockCount ? ins.outOfStockCount / Math.max(totalItems, 1) : 0;
      const lowStockRatio = Math.min(lowStockCount / Math.max(totalItems, 1), 1);

      const revenueToday = today.revenue || 0;
      const revenueYesterday = yesterday.revenue || 0;
      const gpToday = today.grossProfit || 0;
      const gpMargin = revenueToday > 0 ? (gpToday / revenueToday) * 100 : 0;
      const expensesToday = today.expenses || 0;
      const expenseRatio = revenueToday > 0 ? (expensesToday / revenueToday) : 0;
      const revGrowth = revenueYesterday > 0 ? ((revenueToday - revenueYesterday) / revenueYesterday) * 100 : 0;
      const bd = budgetDashboard || {};
      const budgetRatio = (bd.totalPlanned || 0) > 0 ? ((bd.totalSpent || 0) / bd.totalPlanned) : 0;
      const debtorCount = debtSummary?.debtorCount || 0;
      const adjData = adjMetrics || {};
      const damageCount = adjData.damagedItems || 0;
      const invHealthScore = Math.max(100 - ((lowStockRatio + outOfStockRatio) * 100), 0);

      const rawScores: Record<string, { score: number; status: 'good' | 'warning' | 'critical' }> = {
        sales: {
          score: Math.round(Math.min((revenueToday / Math.max(revenueYesterday || revenueToday * 0.5, 1)) * 50, 100)),
          status: revenueYesterday > 0 && revenueToday < revenueYesterday * 0.5 ? 'critical' : revenueToday < revenueYesterday ? 'warning' : 'good',
        },
        margin: {
          score: Math.round(Math.min((gpMargin / 40) * 100, 100)),
          status: gpMargin < 10 ? 'critical' : gpMargin < 25 ? 'warning' : 'good',
        },
        growth: {
          score: Math.round(Math.min(Math.max(((revGrowth + 50) / 100) * 100, 0), 100)),
          status: revGrowth < -20 ? 'critical' : revGrowth < 0 ? 'warning' : 'good',
        },
        expense: {
          score: Math.round(Math.max(100 - (expenseRatio * 100), 0)),
          status: expenseRatio > 0.7 ? 'critical' : expenseRatio > 0.4 ? 'warning' : 'good',
        },
        inventory: {
          score: Math.round(invHealthScore),
          status: lowStockRatio > 0.3 ? 'critical' : lowStockRatio > 0.1 ? 'warning' : 'good',
        },
        budget: {
          score: Math.round(Math.max(100 - (budgetRatio * 50), 0)),
          status: budgetRatio > 1.0 ? 'critical' : budgetRatio > 0.8 ? 'warning' : 'good',
        },
        customers: {
          score: Math.round(Math.max(100 - (debtorCount * 5), debtorCount > 0 ? 30 : 100)),
          status: debtorCount > 10 ? 'critical' : debtorCount > 3 ? 'warning' : 'good',
        },
        adjustments: {
          score: Math.round(Math.max(100 - (damageCount * 10), 0)),
          status: damageCount > 5 ? 'critical' : damageCount > 2 ? 'warning' : 'good',
        },
      };

      const WEIGHTS: Record<string, number> = {
        sales: 20, margin: 15, growth: 15, expense: 10,
        inventory: 15, budget: 10, customers: 10, adjustments: 5,
      };

      const factors: HealthFactor[] = FACTOR_KEYS.map((key) => ({
        key,
        label: t(`health.factor_${key}`),
        weight: WEIGHTS[key],
        ...rawScores[key],
      }));

      let totalScore = 0;
      let totalWeight = 0;
      for (const f of factors) {
        totalScore += f.score * f.weight;
        totalWeight += f.weight;
      }
      const finalScore = Math.round(totalWeight > 0 ? totalScore / totalWeight : 0);

      let rating: HealthScoreResult['rating'] = 'needs_attention';
      if (finalScore >= 80) rating = 'excellent';
      else if (finalScore >= 60) rating = 'good';
      else if (finalScore >= 40) rating = 'fair';

      const recommendations: string[] = [];
      for (const f of factors) {
        if (f.status === 'critical') {
          recommendations.push(t(`health.rec_${f.key}_critical`));
        } else if (f.status === 'warning') {
          recommendations.push(t(`health.rec_${f.key}_warning`));
        }
      }
      if (recommendations.length === 0) {
        recommendations.push(t('health.rec_all_clear'));
      }

      setHealth({ score: finalScore, rating, factors, recommendations });
    } catch (e) {
      console.warn('Health score calculation failed:', e);
    } finally {
      setLoading(false);
    }
  }, [t, enabled]);

  useEffect(() => { calculate(); }, [calculate]);

  return { health, loading, refresh: calculate };
}
