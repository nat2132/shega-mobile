import { formatDate, parseLocalDate } from '@/utils/date-utils';

export interface SearchResult {
  id: string;
  type: 'item' | 'sale' | 'expense' | 'adjustment' | 'budget' | 'category' | 'warehouse' | 'contact' | 'draft';
  title: string;
  subtitle: string;
  route?: string;
  data?: any;
}

type TranslateFn = (key: string, params?: Record<string, string>) => string;
type SearchFn = (query: string, t: TranslateFn, calendarType: string, language: string) => SearchResult[];

const fmtDate = (value: string | null | undefined, calendarType: string, language: string): string => {
  if (!value) return '';
  const d = parseLocalDate(value);
  return d ? formatDate(d, calendarType as any, language) : '';
};

export function searchAll(query: string, t?: TranslateFn, calendarType: string = 'gregorian', language: string = 'en'): SearchResult[] {
  if (!query.trim() || query.length < 1) return [];
  const q = query.toLowerCase().trim();
  const translate = t || ((key: string) => key);

  const searchers: SearchFn[] = [
    searchItems,
    searchSales,
    searchExpenses,
    searchAdjustments,
    searchBudgets,
    searchContacts,
    searchWarehouses,
    searchCategories,
  ];

  const results: SearchResult[] = [];
  const seen = new Set<string>();

  for (const fn of searchers) {
    for (const r of fn(q, translate, calendarType, language)) {
      const key = `${r.type}:${r.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push(r);
      }
    }
  }

  return results;
}

function searchItems(q: string, t: TranslateFn): SearchResult[] {
  const { getItems } = require('@/database/db');
  const items = getItems();
  return items
    .filter((i: any) =>
      i.name?.toLowerCase().includes(q) ||
      i.companyName?.toLowerCase().includes(q) ||
      i.categoryName?.toLowerCase().includes(q)
    )
    .slice(0, 10)
    .map((i: any) => ({
      id: `item-${i.id}`,
      type: 'item' as const,
      title: i.name,
      subtitle: `${i.categoryName || t('search.uncategorized')} • ${i.totalBaseQuantity || 0} ${i.baseUnit || t('search.pcs')}`,
      route: 'inventory',
      data: i,
    }));
}

function searchSales(q: string, t: TranslateFn, calendarType: string, language: string): SearchResult[] {
  const { getFilteredSales } = require('@/database/db');
  const sales = getFilteredSales({ search: q, sortBy: 'createdAt DESC', limit: 10 });
  return (sales || []).slice(0, 10).map((s: any) => ({
    id: `sale-${s.id}`,
    type: 'sale' as const,
    title: s.itemName || `${t('search.sale_id')} #${s.id}`,
    subtitle: `${t('common.etb')} ${s.totalPrice || 0} • ${s.paymentStatus || t('search.paid')} • ${fmtDate(s.createdAt, calendarType, language)}`,
    route: 'sales',
    data: s,
  }));
}

function searchExpenses(q: string, t: TranslateFn, calendarType: string, language: string): SearchResult[] {
  const { getFilteredExpenses } = require('@/database/db');
  const expenses = getFilteredExpenses({ search: q, sortBy: 'date DESC', limit: 10 });
  return (expenses || []).slice(0, 10).map((e: any) => ({
    id: `expense-${e.id}`,
    type: 'expense' as const,
    title: e.name || `${t('search.expense_id')} #${e.id}`,
    subtitle: `${t('common.etb')} ${e.amount || 0} • ${e.category || ''} • ${fmtDate(e.date, calendarType, language)}`,
    route: 'expense',
    data: e,
  }));
}

function searchAdjustments(q: string, t: TranslateFn, calendarType: string, language: string): SearchResult[] {
  const { getFilteredAdjustments } = require('@/database/db');
  const adjustments = getFilteredAdjustments({ search: q, limit: 10 });
  return (adjustments || []).slice(0, 10).map((a: any) => {
    const typeLabel = a.type === 'damaged' ? t('search.damaged') : a.type === 'price_up' ? t('search.price_up') : t('search.price_down');
    return {
      id: `adj-${a.id}`,
      type: 'adjustment' as const,
      title: `${typeLabel} - ${a.itemName || ''}`,
      subtitle: `${a.reason || ''} • ${fmtDate(a.date, calendarType, language)}`,
      route: 'adjustments',
      data: a,
    };
  });
}

function searchBudgets(q: string, t: TranslateFn): SearchResult[] {
  const { getBudgets } = require('@/database/db');
  const budgets = getBudgets();
  return (budgets || [])
    .filter((b: any) =>
      b.name?.toLowerCase().includes(q) ||
      b.type?.toLowerCase().includes(q)
    )
    .slice(0, 5)
    .map((b: any) => ({
      id: `budget-${b.id}`,
      type: 'budget' as const,
      title: b.name,
      subtitle: `${b.type || t('search.business')} • ${b.period || t('search.monthly')} • ${t('common.etb')} ${b.totalPlanned || 0}`,
      route: 'budget',
      data: b,
    }));
}

function searchContacts(q: string, t: TranslateFn): SearchResult[] {
  const { searchContacts } = require('@/database/db');
  const contacts = searchContacts(q);
  return (contacts || []).slice(0, 10).map((c: any) => ({
    id: `contact-${c.id}`,
    type: 'contact' as const,
    title: c.fullName,
    subtitle: `${c.category || ''} • ${c.phone || ''}`,
    route: 'contacts',
    data: c,
  }));
}

function searchWarehouses(q: string, t: TranslateFn): SearchResult[] {
  const { getWarehouses } = require('@/database/db');
  const warehouses = getWarehouses();
  return (warehouses || [])
    .filter((w: any) =>
      w.name?.toLowerCase().includes(q) ||
      w.location?.toLowerCase().includes(q)
    )
    .slice(0, 5)
    .map((w: any) => ({
      id: `wh-${w.id}`,
      type: 'warehouse' as const,
      title: w.name,
      subtitle: w.location || t('search.no_location'),
      route: 'settings',
      data: w,
    }));
}

function searchCategories(q: string, t: TranslateFn): SearchResult[] {
  const { getCategories } = require('@/database/db');
  const categories = getCategories();
  return (categories || [])
    .filter((c: any) => c.name?.toLowerCase().includes(q))
    .slice(0, 5)
    .map((c: any) => ({
      id: `cat-${c.id}`,
      type: 'category' as const,
      title: c.name,
      subtitle: c.icon || '',
      route: 'inventory',
      data: c,
    }));
}
