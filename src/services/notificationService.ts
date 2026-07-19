// Notification triggers - business logic that creates notifications from data events
// These are called by hooks on app start, on data changes, and on a scheduled interval.
//
// Each notification now stores translation keys (titleKey, messageKey) inside `data`
// so the UI can resolve them at display time using the current language setting.
// The persisted `title` and `message` fields keep their English defaults as a
// graceful fallback for old records and for paths that bypass the resolver.

import { formatNumber } from '@/utils/formatNumber';
import {
  createNotification,
  hasActiveNotificationByGroupKey,
  AppNotification,
  CreateNotificationInput,
} from '@/database/notifications';
import {
  getLowStockItems,
  getExpiringItems,
  getDebtCustomers,
  getOverdueExpenses,
  getRecurringExpensesDueToday,
  getRecurringExpensesDueTomorrow,
  getOnCreditItems,
  getItemsWithRecentPriceChanges,
  getItemsDueForSupplierCheck,
  updateItem,
  getItemById,
  getBudgetDashboard,
  getMonthlyBudgetSummary,
  getBudgetWithCategoryProgress,
  getCurrentMonthBudget,
  getRecurringTemplates,
} from '@/database/db';

// â”€â”€ Inventory triggers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const checkLowStock = (): AppNotification[] => {
  try {
    const low = getLowStockItems();
    const created: AppNotification[] = [];
    low.forEach((item: any) => {
      const qty = Number(item.totalBaseQuantity) || 0;
      const groupKey = `low-stock-${item.id}`;
      const input: CreateNotificationInput = {
        type: 'low_stock',
        category: 'inventory',
        priority: qty === 0 ? 'critical' : 'high',
        title: qty === 0 ? 'Out of Stock' : 'Low Stock',
        message: qty === 0
          ? `${item.name} is out of stock.`
          : `${item.name} is running low. Only ${qty} ${item.baseUnit || 'units'} remaining.`,
        icon: 'package',
        deepLink: `/inventory/item-details/${item.id}`,
        data: {
          itemId: item.id,
          qty,
          baseUnit: item.baseUnit || 'units',
          name: item.name,
          titleKey: qty === 0 ? 'notif.title.out_of_stock' : 'notif.title.low_stock',
          messageKey: qty === 0
            ? 'notif.message.out_of_stock'
            : 'notif.message.low_stock',
        },
        groupKey,
        requiresAction: true,
      };
      const notif = createNotification(input);
      if (notif) created.push(notif);
    });
    return created;
  } catch (e) {
    console.error('checkLowStock error:', e);
    return [];
  }
};

export const checkExpiringItems = (): AppNotification[] => {
  try {
    const expiring = getExpiringItems(30);
    return expiring.map((item: any) =>
      createNotification({
        type: 'expiring',
        category: 'inventory',
        priority: 'normal',
        title: 'Item Expiring Soon',
        message: `${item.name} expires on ${item.expiryDate}.`,
        icon: 'calendar',
        deepLink: `/inventory/item-details/${item.id}`,
        data: {
          itemId: item.id,
          expiry: item.expiryDate,
          name: item.name,
          titleKey: 'notif.title.item_expiring',
          messageKey: 'notif.message.item_expiring',
        },
        groupKey: `expiring-${item.id}`,
      }),
    ).filter((n): n is AppNotification => n !== null);
  } catch (e) {
    console.error('checkExpiringItems error:', e);
    return [];
  }
};

// â”€â”€ Customer / Debt triggers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const checkOutstandingDebts = (): AppNotification[] => {
  try {
    const debts = getDebtCustomers();
    return debts.map((debt: any) =>
      createNotification({
        type: 'debt',
        category: 'customer',
        priority: 'high',
        title: 'Outstanding Customer Balance',
        message: `${debt.customerName} owes ${formatNumber(debt.oweAmount)} Birr.`,
        icon: 'handshake',
        deepLink: '/(tabs)/sales-hub',
        data: {
          customerName: debt.customerName,
          amount: debt.oweAmount,
          intent: 'collect_payments',
          titleKey: 'notif.title.outstanding_debt',
          messageKey: 'notif.message.outstanding_debt',
        },
        groupKey: `debt-${debt.customerName}`,
        requiresAction: true,
      }),
    ).filter((n): n is AppNotification => n !== null);
  } catch (e) {
    console.error('checkOutstandingDebts error:', e);
    return [];
  }
};

// â”€â”€ Supplier / Credit triggers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const checkUnpaidSuppliers = (): AppNotification[] => {
  try {
    const items = getOnCreditItems();
    return items.slice(0, 5).map((item: any) =>
      createNotification({
        type: 'supplier_credit',
        category: 'supplier',
        priority: 'normal',
        title: 'Unpaid Supplier Invoice',
        message: `You owe ${item.name} supplier.`,
        icon: 'building',
        deepLink: '/(tabs)/inventory',
        data: {
          itemId: item.id,
          name: item.name,
          intent: 'supplier_credit',
          titleKey: 'notif.title.unpaid_supplier',
          messageKey: 'notif.message.unpaid_supplier',
        },
        groupKey: `supplier-${item.id}`,
      }),
    ).filter((n): n is AppNotification => n !== null);
  } catch (e) {
    console.error('checkUnpaidSuppliers error:', e);
    return [];
  }
};

// â”€â”€ Weekly supplier call triggers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Surfaces a notification for every item flagged with supplierCallEnabled
// whose purchase price was adjusted in the last 7 days. The user is asked
// "should we call the supplier?" with quick actions wired in
// NotificationDetailSheet (Call / Remind later / Dismiss).
export const checkSupplierPriceChanges = (): AppNotification[] => {
  try {
    const items = getItemsWithRecentPriceChanges(7);
    const created: AppNotification[] = [];
    items.forEach((it: any) => {
      const direction = it.changeType === 'price_up' ? 'increased' : 'decreased';
      const oldVal = Number(it.oldValue) || 0;
      const newVal = Number(it.newValue) || 0;
      const delta = newVal - oldVal;
      const pct = oldVal > 0 ? ((delta / oldVal) * 100).toFixed(1) : '0';
      const sign = delta > 0 ? '+' : '';
      const phone = it.supplierPhone || '';
      const item = getItemById(it.itemId) as any;
      if (!item) return;
      const notif = createNotification({
        type: 'supplier_call_price_change',
        category: 'supplier',
        priority: 'high',
        title: `Call supplier about ${it.itemName}?`,
        message: `Price ${direction} by ${sign}${delta.toFixed(2)} (${sign}${pct}%) this week. Tap to call ${it.companyName || 'supplier'}.`,
        icon: 'truck',
        deepLink: `/inventory/item-details/${it.itemId}`,
        data: {
          itemId: it.itemId,
          itemName: it.itemName,
          supplierPhone: phone,
          supplierName: it.companyName || '',
          changeType: it.changeType,
          oldValue: oldVal,
          newValue: newVal,
          delta,
          pct,
          direction,
          sign,
          deltaStr: delta.toFixed(2),
          titleKey: 'notif.title.supplier_price_change',
          messageKey: 'notif.message.supplier_price_change',
        },
        groupKey: `supplier-call-${it.itemId}`,
        requiresAction: true,
      });
      if (notif) created.push(notif);
    });
    return created;
  } catch (e) {
    console.error('checkSupplierPriceChanges error:', e);
    return [];
  }
};

// Surfaces a notification for every supplierCallEnabled item that is
// simply due for its weekly check (no recent price change).
export const checkSupplierPeriodicReview = (): AppNotification[] => {
  try {
    const items = getItemsDueForSupplierCheck(7);
    const created: AppNotification[] = [];
    items.forEach((it: any) => {
      const notif = createNotification({
        type: 'supplier_call_review',
        category: 'supplier',
        priority: 'normal',
        title: 'Weekly supplier check',
        message: `It's been 7 days since the last call to ${it.companyName || 'your supplier'} for ${it.itemName}. Want to call them to confirm price and stock?`,
        icon: 'truck',
        deepLink: `/inventory/item-details/${it.itemId}`,
        data: {
          itemId: it.itemId,
          itemName: it.itemName,
          supplierPhone: it.supplierPhone || '',
          supplierName: it.companyName || '',
          titleKey: 'notif.title.weekly_supplier_check',
          messageKey: 'notif.message.weekly_supplier_check',
        },
        groupKey: `supplier-review-${it.itemId}`,
        requiresAction: false,
      });
      if (notif) created.push(notif);
      // Mark the item as checked now so we don't re-fire in 24h
      try {
        updateItem(it.itemId, { lastPriceCheckAt: new Date().toISOString() });
      } catch {}
    });
    return created;
  } catch (e) {
    console.error('checkSupplierPeriodicReview error:', e);
    return [];
  }
};

// â”€â”€ Expense triggers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const checkOverdueExpenses = (): AppNotification[] => {
  try {
    const overdue = getOverdueExpenses();
    return overdue.map((exp: any) =>
      createNotification({
        type: 'expense_overdue',
        category: 'expense',
        priority: 'high',
        title: 'Overdue Expense',
        message: `${exp.name} is ${exp.overdueDays || 0} days overdue.`,
        icon: 'wallet',
        deepLink: `/expense/expense-details/${exp.id}`,
        data: {
          expenseId: exp.id,
          name: exp.name,
          overdueDays: exp.overdueDays || 0,
          titleKey: 'notif.title.overdue_expense',
          messageKey: 'notif.message.overdue_expense',
        },
        groupKey: `overdue-${exp.id}`,
        requiresAction: true,
      }),
    ).filter((n): n is AppNotification => n !== null);
  } catch (e) {
    console.error('checkOverdueExpenses error:', e);
    return [];
  }
};

export const checkRecurringExpenses = (): AppNotification[] => {
  try {
    const due = getRecurringExpensesDueToday();
    return due.map((exp: any) =>
      createNotification({
        type: 'recurring_due',
        category: 'expense',
        priority: 'normal',
        title: 'Recurring Expense Due',
        message: `${exp.name} (${exp.frequency || 'Recurring'}) is due today.`,
        icon: 'calendar',
        deepLink: `/expense/expense-details/${exp.id}`,
        data: {
          expenseId: exp.id,
          name: exp.name,
          frequency: exp.frequency || 'Recurring',
          titleKey: 'notif.title.recurring_expense_due',
          messageKey: 'notif.message.recurring_expense_due',
        },
        groupKey: `recurring-${exp.id}`,
      }),
    ).filter((n): n is AppNotification => n !== null);
  } catch (e) {
    console.error('checkRecurringExpenses error:', e);
    return [];
  }
};

// â”€â”€ Sales / Activity triggers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const notifySaleCompleted = (saleData: {
  id: number;
  itemName: string;
  totalPrice: number;
  paymentStatus: string;
  customerName?: string;
}): AppNotification | null => {
  return createNotification({
    type: 'sale_completed',
    category: 'sales',
    priority: 'low',
    title: 'Sale Completed',
    message: saleData.customerName
      ? `Sale of ${formatNumber(saleData.totalPrice)} Birr to ${saleData.customerName} recorded.`
      : `Sale of ${formatNumber(saleData.totalPrice)} Birr recorded.`,
    icon: 'cart',
    deepLink: `/sales/sales-details/${saleData.id}`,
    data: {
      ...saleData,
      totalPriceStr: formatNumber(saleData.totalPrice),
      titleKey: 'notif.title.sale_completed',
      messageKey: saleData.customerName
        ? 'notif.message.sale_completed_with_customer'
        : 'notif.message.sale_completed',
    },
    groupKey: `sale-${saleData.id}`,
  });
};

export const notifyExpenseRecorded = (expenseData: {
  id: number;
  name: string;
  amount: number;
  category: string;
}): AppNotification | null => {
  return createNotification({
    type: 'expense_recorded',
    category: 'expense',
    priority: 'low',
    title: 'Expense Recorded',
    message: `${expenseData.name} (${formatNumber(expenseData.amount)} Birr) added.`,
    icon: 'wallet',
    deepLink: `/expense/expense-details/${expenseData.id}`,
    data: {
      ...expenseData,
      amountStr: formatNumber(expenseData.amount),
      titleKey: 'notif.title.expense_recorded',
      messageKey: 'notif.message.expense_recorded',
    },
    groupKey: `expense-${expenseData.id}`,
  });
};

export const notifyItemUpdated = (itemData: {
  id: number;
  name: string;
  change: string;
}): AppNotification | null => {
  return createNotification({
    type: 'item_updated',
    category: 'inventory',
    priority: 'low',
    title: 'Item Updated',
    message: `${itemData.name} was ${itemData.change}.`,
    icon: 'package',
    deepLink: `/inventory/item-details/${itemData.id}`,
    data: {
      ...itemData,
      titleKey: 'notif.title.item_updated',
      messageKey: 'notif.message.item_updated',
    },
    groupKey: `item-update-${itemData.id}-${Date.now()}`,
  });
};

export const notifyCustomerAdded = (customer: {
  id: number;
  fullName: string;
}): AppNotification | null => {
  return createNotification({
    type: 'customer_added',
    category: 'customer',
    priority: 'low',
    title: 'Customer Added',
    message: `${customer.fullName} has been added to your contacts.`,
    icon: 'handshake',
    deepLink: `/contacts/contact-details/${customer.id}`,
    data: {
      ...customer,
      titleKey: 'notif.title.customer_added',
      messageKey: 'notif.message.customer_added',
    },
    groupKey: `customer-${customer.id}`,
  });
};

export const notifyPaymentRecorded = (payment: {
  id: number;
  customerName: string;
  amount: number;
}): AppNotification | null => {
  return createNotification({
    type: 'payment_recorded',
    category: 'sales',
    priority: 'low',
    title: 'Payment Recorded',
    message: `${formatNumber(payment.amount)} Birr received from ${payment.customerName}.`,
    icon: 'check-circle',
    deepLink: `/sales/sales-details/${payment.id}`,
    data: {
      ...payment,
      amountStr: formatNumber(payment.amount),
      titleKey: 'notif.title.payment_recorded',
      messageKey: 'notif.message.payment_recorded',
    },
    groupKey: `payment-${payment.id}-${Date.now()}`,
  });
};

export const notifyBackupCompleted = (result: {
  success: boolean;
  filename?: string;
  error?: string;
}): AppNotification | null => {
  return createNotification({
    type: 'backup',
    category: 'system',
    priority: result.success ? 'low' : 'high',
    title: result.success ? 'Backup Completed' : 'Backup Failed',
    message: result.success
      ? `Backup ${result.filename ? `(${result.filename}) ` : ''}saved successfully.`
      : result.error || 'Backup could not be completed.',
    icon: result.success ? 'check-circle' : 'alert-triangle',
    data: {
      ...result,
      titleKey: result.success
        ? 'notif.title.backup_completed'
        : 'notif.title.backup_failed',
      messageKey: result.success
        ? (result.filename
            ? 'notif.message.backup_completed_with_filename'
            : 'notif.message.backup_completed')
        : 'notif.message.backup_failed',
    },
    groupKey: `backup-${Date.now()}`,
  });
};

export const notifyLicenseExpiring = (days: number): AppNotification | null => {
  return createNotification({
    type: 'license_expiring',
    category: 'security',
    priority: days <= 7 ? 'critical' : 'high',
    title: 'License Expiring',
    message: days <= 0
      ? 'Your license has expired. Please renew.'
      : `Your license expires in ${days} days.`,
    icon: 'shield',
    deepLink: '/(tabs)/settings',
    data: {
      intent: 'subscription',
      days,
      titleKey: 'notif.title.license_expiring',
      messageKey: days <= 0
        ? 'notif.message.license_expired'
        : 'notif.message.license_expiring',
    },
    groupKey: 'license',
    requiresAction: days <= 7,
  });
};

// â”€â”€ Budget Notification Triggers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const notifyBudgetCreated = (budgetData: {
  id: number;
  name: string;
  period: string;
  year: number;
  month?: number;
}): AppNotification | null => {
  return createNotification({
    type: 'budget_created',
    category: 'budget',
    priority: 'low',
    title: 'Budget Created',
    message: `${budgetData.name} budget has been created successfully.`,
    icon: 'trending-up',
    deepLink: '/(tabs)/budget',
    data: {
      budgetId: budgetData.id,
      name: budgetData.name,
      titleKey: 'notif.title.budget_created',
      messageKey: 'notif.message.budget_created',
    },
    groupKey: `budget-created-${budgetData.id}`,
  });
};

export const notifyBudgetCategoryExceeded = (data: {
  categoryName: string;
  budgetName: string;
  planned: number;
  spent: number;
  budgetId: number;
  categoryId: number;
  excess: number;
}): AppNotification | null => {
  return createNotification({
    type: 'budget_category_exceeded',
    category: 'budget',
    priority: 'critical',
    title: 'Budget Category Exceeded',
    message: `Your ${data.categoryName} budget (${data.budgetName}) has exceeded its limit by ${formatNumber(data.excess)} ETB.`,
    icon: 'alert-triangle',
    deepLink: '/(tabs)/budget',
    data: {
      budgetId: data.budgetId,
      categoryId: data.categoryId,
      categoryName: data.categoryName,
      name: data.categoryName,
      planned: data.planned,
      spent: data.spent,
      excess: data.excess,
      amountStr: formatNumber(data.excess),
      titleKey: 'notif.title.budget_exceeded',
      messageKey: 'notif.message.budget_exceeded',
    },
    groupKey: `budget-exceeded-${data.budgetId}-${data.categoryId}`,
    requiresAction: true,
  });
};

export const notifyBudgetApproachingLimit = (data: {
  categoryName: string;
  budgetName: string;
  percentUsed: number;
  budgetId: number;
  categoryId: number;
  spent: number;
  planned: number;
}): AppNotification | null => {
  const threshold = data.percentUsed >= 100 ? 100 : data.percentUsed >= 90 ? 90 : 80;
  const title = threshold >= 100
    ? 'Budget Limit Reached'
    : `Budget ${threshold}% Used`;
  const message = threshold >= 100
    ? `Your ${data.categoryName} budget (${data.budgetName}) has reached its limit.`
    : `Your ${data.categoryName} budget (${data.budgetName}) is ${data.percentUsed}% used.`;
  return createNotification({
    type: threshold >= 100 ? 'budget_limit_reached' : 'budget_approaching_limit',
    category: 'budget',
    priority: threshold >= 100 ? 'critical' : threshold >= 90 ? 'high' : 'normal',
    title,
    message,
    icon: threshold >= 100 ? 'alert-triangle' : 'percent',
    deepLink: '/(tabs)/budget',
    data: {
      budgetId: data.budgetId,
      categoryId: data.categoryId,
      categoryName: data.categoryName,
      name: data.categoryName,
      percentUsed: data.percentUsed,
      percent: data.percentUsed,
      spent: data.spent,
      planned: data.planned,
      threshold,
      titleKey: threshold >= 100 ? 'notif.title.budget_limit_reached' : 'notif.title.budget_percent_used',
      messageKey: threshold >= 100 ? 'notif.message.budget_limit_reached' : 'notif.message.budget_percent_used',
    },
    groupKey: `budget-limit-${data.budgetId}-${data.categoryId}-${threshold}`,
    requiresAction: threshold >= 90,
  });
};

export const checkBudgetThresholds = (): AppNotification[] => {
  try {
    const dashboard = getBudgetDashboard();
    if (!dashboard?.activeBudgets) return [];
    const created: AppNotification[] = [];
    for (const budget of dashboard.activeBudgets) {
      const progress = getBudgetWithCategoryProgress(budget.id);
      if (!progress?.categories) continue;
      for (const cat of progress.categories) {
        if (cat.plannedAmount <= 0) continue;
        const pct = cat.percentUsed || 0;
        if (pct >= 100) {
          const n = notifyBudgetApproachingLimit({
            categoryName: cat.category,
            budgetName: progress.name,
            percentUsed: pct,
            budgetId: budget.id,
            categoryId: cat.id,
            spent: cat.spent || 0,
            planned: cat.plannedAmount,
          });
          if (n) created.push(n);
        } else if (pct >= 90) {
          const n = notifyBudgetApproachingLimit({
            categoryName: cat.category,
            budgetName: progress.name,
            percentUsed: pct,
            budgetId: budget.id,
            categoryId: cat.id,
            spent: cat.spent || 0,
            planned: cat.plannedAmount,
          });
          if (n) created.push(n);
        } else if (pct >= 80) {
          const n = notifyBudgetApproachingLimit({
            categoryName: cat.category,
            budgetName: progress.name,
            percentUsed: pct,
            budgetId: budget.id,
            categoryId: cat.id,
            spent: cat.spent || 0,
            planned: cat.plannedAmount,
          });
          if (n) created.push(n);
        }
      }
    }
    return created;
  } catch (e) {
    console.error('checkBudgetThresholds error:', e);
    return [];
  }
};

export const checkEndingBudgets = (): AppNotification[] => {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const summary = getMonthlyBudgetSummary(currentYear, currentMonth);
    if (!summary?.hasBudget || !summary.budgetId) return [];
    const remaining = summary.remaining || 0;
    if (remaining > 0) return [];
    const daysLeft = new Date(currentYear, currentMonth, 0).getDate() - now.getDate();
    if (daysLeft > 3) return [];
    const n = createNotification({
      type: 'budget_ending',
      category: 'budget',
      priority: daysLeft <= 1 ? 'high' : 'normal',
      title: 'Budget Period Ending',
      message: `Your ${summary.budgetName || 'monthly'} budget ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.`,
      icon: 'clock',
      deepLink: '/(tabs)/budget',
      data: {
        budgetId: summary.budgetId,
        daysLeft,
        days: daysLeft,
        budgetName: summary.budgetName,
        name: summary.budgetName,
        remaining,
        titleKey: 'notif.title.budget_ending',
        messageKey: 'notif.message.budget_ending',
      },
      groupKey: `budget-ending-${summary.budgetId}-${currentYear}-${currentMonth}`,
    });
    return n ? [n] : [];
  } catch (e) {
    console.error('checkEndingBudgets error:', e);
    return [];
  }
};

export const checkNoActiveBudget = (): AppNotification[] => {
  try {
    const current = getCurrentMonthBudget();
    if (current) return [];
    const now = new Date();
    const groupKey = `no-budget-${now.getFullYear()}-${now.getMonth() + 1}`;
    if (hasActiveNotificationByGroupKey(groupKey)) return [];
    const monthName = now.toLocaleString('default', { month: 'long' });
    const n = createNotification({
      type: 'no_active_budget',
      category: 'budget',
      priority: 'high',
      title: 'No Active Budget',
      message: `No budget has been created for ${monthName} yet. Create one to track your spending.`,
      icon: 'megaphone',
      deepLink: '/(tabs)/budget',
      data: {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        monthName,
        titleKey: 'notif.title.no_active_budget',
        messageKey: 'notif.message.no_active_budget',
      },
      groupKey,
      requiresAction: true,
    });
    return n ? [n] : [];
  } catch (e) {
    console.error('checkNoActiveBudget error:', e);
    return [];
  }
};

export const checkInactiveBudgetCategories = (): AppNotification[] => {
  try {
    const now = new Date();
    const summary = getMonthlyBudgetSummary(now.getFullYear(), now.getMonth() + 1);
    if (!summary?.byCategory) return [];
    const created: AppNotification[] = [];
    for (const cat of summary.byCategory as any[]) {
      if (cat.planned > 0 && cat.spent === 0) {
        const n = createNotification({
          type: 'budget_no_spending',
          category: 'budget',
          priority: 'low',
          title: 'No Spending Yet',
          message: `Your ${cat.name} category has no spending this month.`,
          icon: 'info',
          deepLink: '/(tabs)/budget',
          data: {
            category: cat.name,
            name: cat.name,
            planned: cat.planned,
            budgetId: summary.budgetId,
            titleKey: 'notif.title.budget_no_spending',
            messageKey: 'notif.message.budget_no_spending',
          },
          groupKey: `no-spend-${cat.name}-${now.getFullYear()}-${now.getMonth() + 1}`,
        });
        if (n) created.push(n);
      }
    }
    return created;
  } catch (e) {
    console.error('checkInactiveBudgetCategories error:', e);
    return [];
  }
};

// â”€â”€ Expense Notification Triggers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const notifyExpenseEdited = (expenseData: {
  id: number;
  name: string;
  amount: number;
  category: string;
  oldAmount?: number;
}): AppNotification | null => {
  const amountChanged = expenseData.oldAmount !== undefined && expenseData.oldAmount !== expenseData.amount;
  return createNotification({
    type: 'expense_edited',
    category: 'expense',
    priority: 'low',
    title: 'Expense Updated',
    message: amountChanged
      ? `${expenseData.name} updated from ${formatNumber(expenseData.oldAmount || 0)} to ${formatNumber(expenseData.amount)} Birr.`
      : `${expenseData.name} has been updated.`,
    icon: 'receipt',
    deepLink: `/expense/expense-details/${expenseData.id}`,
    data: {
      expenseId: expenseData.id,
      name: expenseData.name,
      amount: expenseData.amount,
      category: expenseData.category,
      oldAmount: expenseData.oldAmount,
      titleKey: 'notif.title.expense_edited',
      messageKey: amountChanged ? 'notif.message.expense_edited_with_amount' : 'notif.message.expense_edited',
    },
    groupKey: `expense-edit-${expenseData.id}-${Date.now()}`,
  });
};

export const notifyExpenseDeleted = (expenseData: {
  name: string;
  amount: number;
  category: string;
}): AppNotification | null => {
  return createNotification({
    type: 'expense_deleted',
    category: 'expense',
    priority: 'low',
    title: 'Expense Deleted',
    message: `${expenseData.name} (${formatNumber(expenseData.amount)} Birr) has been removed.`,
    icon: 'wallet',
    data: {
      name: expenseData.name,
      amount: expenseData.amount,
      category: expenseData.category,
      amountStr: formatNumber(expenseData.amount),
      titleKey: 'notif.title.expense_deleted',
      messageKey: 'notif.message.expense_deleted',
    },
    groupKey: `expense-delete-${Date.now()}`,
  });
};

export const notifyLargeExpense = (expenseData: {
  id: number;
  name: string;
  amount: number;
  category: string;
  threshold: number;
}): AppNotification | null => {
  return createNotification({
    type: 'large_expense',
    category: 'expense',
    priority: 'high',
    title: 'Large Expense Recorded',
    message: `${expenseData.name} (${formatNumber(expenseData.amount)} Birr) exceeds your ${formatNumber(expenseData.threshold)} Birr large-expense threshold.`,
    icon: 'alert-triangle',
    deepLink: `/expense/expense-details/${expenseData.id}`,
    data: {
      expenseId: expenseData.id,
      name: expenseData.name,
      amount: expenseData.amount,
      category: expenseData.category,
      threshold: expenseData.threshold,
      titleKey: 'notif.title.large_expense',
      messageKey: 'notif.message.large_expense',
    },
    groupKey: `large-expense-${expenseData.id}`,
    requiresAction: false,
  });
};

export const notifyExpensePushedBudgetOverLimit = (data: {
  expenseId: number;
  expenseName: string;
  categoryName: string;
  budgetName: string;
  budgetId: number;
  excess: number;
}): AppNotification | null => {
  return createNotification({
    type: 'expense_budget_exceeded',
    category: 'expense',
    priority: 'critical',
    title: 'Budget Exceeded by Expense',
    message: `${data.expenseName} pushed the ${data.categoryName} budget (${data.budgetName}) over its limit by ${formatNumber(data.excess)} ETB.`,
    icon: 'alert-triangle',
    deepLink: '/(tabs)/budget',
    data: {
      expenseId: data.expenseId,
      expenseName: data.expenseName,
      categoryName: data.categoryName,
      budgetName: data.budgetName,
      budgetId: data.budgetId,
      excess: data.excess,
      titleKey: 'notif.title.expense_pushed_over_budget',
      messageKey: 'notif.message.expense_pushed_over_budget',
    },
    groupKey: `expense-budget-${data.expenseId}`,
    requiresAction: true,
  });
};

export const notifyExpenseOrphaned = (expenseData: {
  id: number;
  name: string;
  amount: number;
  category: string;
}): AppNotification | null => {
  return createNotification({
    type: 'expense_orphaned',
    category: 'expense',
    priority: 'normal',
    title: 'Unlinked Expense',
    message: `${expenseData.name} (${formatNumber(expenseData.amount)} Birr) could not be automatically linked to a budget. Please assign a budget category.`,
    icon: 'receipt',
    deepLink: `/expense/expense-details/${expenseData.id}`,
    data: {
      expenseId: expenseData.id,
      name: expenseData.name,
      amount: expenseData.amount,
      category: expenseData.category,
      titleKey: 'notif.title.expense_orphaned',
      messageKey: 'notif.message.expense_orphaned',
    },
    groupKey: `expense-orphan-${expenseData.id}`,
    requiresAction: true,
  });
};

// â”€â”€ Recurring Expense Triggers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const checkRecurringDueTomorrow = (): AppNotification[] => {
  try {
    const due = getRecurringExpensesDueTomorrow();
    return due.map((exp: any) =>
      createNotification({
        type: 'recurring_due_tomorrow',
        category: 'recurring',
        priority: 'normal',
        title: 'Recurring Expense Due Tomorrow',
        message: `${exp.name} (${exp.frequency || 'Recurring'}) is due tomorrow.`,
        icon: 'calendar',
        deepLink: `/expense/expense-details/${exp.id}`,
        data: {
          expenseId: exp.id,
          name: exp.name,
          frequency: exp.frequency || 'Recurring',
          amount: exp.amount,
          titleKey: 'notif.title.recurring_due_tomorrow',
          messageKey: 'notif.message.recurring_due_tomorrow',
        },
        groupKey: `recurring-tomorrow-${exp.id}`,
      }),
    ).filter((n): n is AppNotification => n !== null);
  } catch (e) {
    console.error('checkRecurringDueTomorrow error:', e);
    return [];
  }
};

export const notifyRecurringMarkedPaid = (data: {
  id: number;
  name: string;
  amount: number;
  nextBillingDate?: string;
}): AppNotification | null => {
  return createNotification({
    type: 'recurring_paid',
    category: 'recurring',
    priority: 'low',
    title: 'Recurring Expense Paid',
    message: `${data.name} (${formatNumber(data.amount)} Birr) has been marked as paid.`,
    icon: 'check-circle',
    deepLink: `/expense/expense-details/${data.id}`,
    data: {
      expenseId: data.id,
      name: data.name,
      amount: data.amount,
      nextBillingDate: data.nextBillingDate,
      titleKey: 'notif.title.recurring_paid',
      messageKey: 'notif.message.recurring_paid',
    },
    groupKey: `recurring-paid-${data.id}`,
  });
};

export const notifyRecurringSkipped = (data: {
  id: number;
  name: string;
  amount: number;
}): AppNotification | null => {
  return createNotification({
    type: 'recurring_skipped',
    category: 'recurring',
    priority: 'low',
    title: 'Recurring Expense Skipped',
    message: `${data.name} (${formatNumber(data.amount)} Birr) has been skipped.`,
    icon: 'repeat',
    deepLink: `/expense/expense-details/${data.id}`,
    data: {
      expenseId: data.id,
      name: data.name,
      amount: data.amount,
      titleKey: 'notif.title.recurring_skipped',
      messageKey: 'notif.message.recurring_skipped',
    },
    groupKey: `recurring-skip-${data.id}`,
  });
};

export const notifyRecurringTemplateExpired = (data: {
  id: number;
  name: string;
  endDate: string;
}): AppNotification | null => {
  return createNotification({
    type: 'recurring_template_expired',
    category: 'recurring',
    priority: 'normal',
    title: 'Recurring Template Expired',
    message: `The recurring template "${data.name}" has expired (ended ${data.endDate}).`,
    icon: 'clock',
    data: {
      templateId: data.id,
      name: data.name,
      endDate: data.endDate,
      titleKey: 'notif.title.recurring_template_expired',
      messageKey: 'notif.message.recurring_template_expired',
    },
    groupKey: `recurring-expired-${data.id}`,
    requiresAction: false,
  });
};

export const checkExpiredTemplates = (): AppNotification[] => {
  try {
    const templates = getRecurringTemplates(true);
    const now = new Date().toISOString().split('T')[0];
    const created: AppNotification[] = [];
    for (const t of templates as any[]) {
      if (t.endDate && t.endDate <= now) {
        const n = notifyRecurringTemplateExpired({
          id: t.id,
          name: t.name,
          endDate: t.endDate,
        });
        if (n) created.push(n);
      }
    }
    return created;
  } catch (e) {
    console.error('checkExpiredTemplates error:', e);
    return [];
  }
};

// â”€â”€ Reminder Triggers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const notifyWeeklySpendingSummary = (data: {
  totalSpent: number;
  totalBudget: number;
  budgetCount: number;
  topCategory: string;
  topCategoryAmount: number;
}): AppNotification | null => {
  return createNotification({
    type: 'weekly_summary',
    category: 'reminder',
    priority: 'low',
    title: 'Weekly Spending Summary',
    message: `You spent ${formatNumber(data.totalSpent)} ETB this week across ${data.budgetCount} budget${data.budgetCount !== 1 ? 's' : ''}. Top category: ${data.topCategory} (${formatNumber(data.topCategoryAmount)} ETB).`,
    icon: 'receipt',
    deepLink: '/(tabs)/expense',
    data: {
      totalSpent: data.totalSpent,
      totalBudget: data.totalBudget,
      budgetCount: data.budgetCount,
      topCategory: data.topCategory,
      topCategoryAmount: data.topCategoryAmount,
      titleKey: 'notif.title.weekly_summary',
      messageKey: 'notif.message.weekly_summary',
    },
    groupKey: `weekly-summary-${Date.now()}`,
  });
};

export const notifyMonthlySpendingSummary = (data: {
  year: number;
  month: number;
  totalSpent: number;
  totalBudget: number;
  percentUsed: number;
  budgetCount: number;
  topCategory: string;
  topCategoryAmount: number;
}): AppNotification | null => {
  return createNotification({
    type: 'monthly_summary',
    category: 'reminder',
    priority: 'low',
    title: 'Monthly Spending Summary',
    message: `${data.month}/${data.year}: Spent ${formatNumber(data.totalSpent)} ETB of ${formatNumber(data.totalBudget)} ETB (${data.percentUsed}%) across ${data.budgetCount} budget${data.budgetCount !== 1 ? 's' : ''}.`,
    icon: 'receipt',
    deepLink: '/(tabs)/budget',
    data: {
      year: data.year,
      month: data.month,
      totalSpent: data.totalSpent,
      totalBudget: data.totalBudget,
      percentUsed: data.percentUsed,
      budgetCount: data.budgetCount,
      topCategory: data.topCategory,
      topCategoryAmount: data.topCategoryAmount,
      titleKey: 'notif.title.monthly_summary',
      messageKey: 'notif.message.monthly_summary',
    },
    groupKey: `monthly-summary-${data.year}-${data.month}`,
  });
};

export const notifyBudgetReviewReminder = (data: {
  year: number;
  month: number;
  budgetName: string;
  remaining: number;
  percentUsed: number;
}): AppNotification | null => {
  return createNotification({
    type: 'budget_review_reminder',
    category: 'reminder',
    priority: 'normal',
    title: 'Budget Review Reminder',
    message: `Review your "${data.budgetName}" budget for ${data.month}/${data.year}. You have ${formatNumber(data.remaining)} ETB remaining (${data.percentUsed}% used).`,
    icon: 'bell',
    deepLink: '/(tabs)/budget',
    data: {
      year: data.year,
      month: data.month,
      budgetName: data.budgetName,
      name: data.budgetName,
      remaining: data.remaining,
      percentUsed: data.percentUsed,
      titleKey: 'notif.title.budget_review_reminder',
      messageKey: 'notif.message.budget_review_reminder',
    },
    groupKey: `budget-review-${data.year}-${data.month}`,
    requiresAction: false,
  });
};

// â”€â”€ Master "run all" trigger used at app start / on refresh â”€â”€â”€â”€â”€â”€â”€â”€

export const runAllNotificationChecks = (): AppNotification[] => {
  const all: AppNotification[] = [];
  all.push(...checkLowStock());
  all.push(...checkExpiringItems());
  all.push(...checkOutstandingDebts());
  all.push(...checkUnpaidSuppliers());
  all.push(...checkOverdueExpenses());
  all.push(...checkRecurringExpenses());
  all.push(...checkRecurringDueTomorrow());
  all.push(...checkExpiredTemplates());
  all.push(...checkBudgetThresholds());
  all.push(...checkEndingBudgets());
  all.push(...checkNoActiveBudget());
  all.push(...checkInactiveBudgetCategories());
  all.push(...checkSupplierPriceChanges());
  all.push(...checkSupplierPeriodicReview());
  return all;
};

export const getDashboardAlertSummary = () => {
  const low = getLowStockItems();
  const outOfStock = low.filter((i: any) => Number(i.totalBaseQuantity) === 0);
  const lowStock = low.filter((i: any) => Number(i.totalBaseQuantity) > 0);
  const debts = getDebtCustomers();
  const supplierCredit = getOnCreditItems();
  const overdue = getOverdueExpenses();
  const recurring = getRecurringExpensesDueToday();
  const expiring = getExpiringItems(30);
  const supplierPriceChanges = getItemsWithRecentPriceChanges(7);
  const supplierReviewDue = getItemsDueForSupplierCheck(7);

  const totalAlerts =
    outOfStock.length + lowStock.length + debts.length + supplierCredit.length +
    overdue.length + recurring.length + expiring.length +
    supplierPriceChanges.length + supplierReviewDue.length;

  return {
    totalAlerts,
    outOfStock: outOfStock.length,
    lowStock: lowStock.length,
    debts: debts.length,
    supplierCredit: supplierCredit.length,
    overdue: overdue.length,
    recurring: recurring.length,
    expiring: expiring.length,
    supplierPriceChanges: supplierPriceChanges.length,
    supplierReviewDue: supplierReviewDue.length,
  };
};