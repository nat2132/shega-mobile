// Notification triggers - business logic that creates notifications from data events
// These are called by hooks on app start, on data changes, and on a scheduled interval.
//
// Each notification now stores translation keys (titleKey, messageKey) inside `data`
// so the UI can resolve them at display time using the current language setting.
// The persisted `title` and `message` fields keep their English defaults as a
// graceful fallback for old records and for paths that bypass the resolver.

import {
  createNotification,
  AppNotification,
  CreateNotificationInput,
} from '@/database/notifications';
import {
  getLowStockItems,
  getExpiringItems,
  getDebtCustomers,
  getOverdueExpenses,
  getRecurringExpensesDueToday,
  getOnCreditItems,
  getItemsWithRecentPriceChanges,
  getItemsDueForSupplierCheck,
  updateItem,
  getItemById,
} from '@/database/db';

// ── Inventory triggers ──────────────────────────────────────────────

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

// ── Customer / Debt triggers ───────────────────────────────────────

export const checkOutstandingDebts = (): AppNotification[] => {
  try {
    const debts = getDebtCustomers();
    return debts.map((debt: any) =>
      createNotification({
        type: 'debt',
        category: 'customer',
        priority: 'high',
        title: 'Outstanding Customer Balance',
        message: `${debt.customerName} owes ${debt.oweAmount.toLocaleString()} Birr.`,
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

// ── Supplier / Credit triggers ──────────────────────────────────────

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

// ── Weekly supplier call triggers ───────────────────────────────────

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
      } catch (e) {}
    });
    return created;
  } catch (e) {
    console.error('checkSupplierPeriodicReview error:', e);
    return [];
  }
};

// ── Expense triggers ────────────────────────────────────────────────

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

// ── Sales / Activity triggers ───────────────────────────────────────

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
      ? `Sale of ${saleData.totalPrice.toLocaleString()} Birr to ${saleData.customerName} recorded.`
      : `Sale of ${saleData.totalPrice.toLocaleString()} Birr recorded.`,
    icon: 'cart',
    deepLink: `/sales/sales-details/${saleData.id}`,
    data: {
      ...saleData,
      totalPriceStr: saleData.totalPrice.toLocaleString(),
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
    message: `${expenseData.name} (${expenseData.amount.toLocaleString()} Birr) added.`,
    icon: 'wallet',
    deepLink: `/expense/expense-details/${expenseData.id}`,
    data: {
      ...expenseData,
      amountStr: expenseData.amount.toLocaleString(),
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
    message: `${payment.amount.toLocaleString()} Birr received from ${payment.customerName}.`,
    icon: 'check-circle',
    deepLink: `/sales/sales-details/${payment.id}`,
    data: {
      ...payment,
      amountStr: payment.amount.toLocaleString(),
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

// ── Master "run all" trigger used at app start / on refresh ────────

export const runAllNotificationChecks = (): AppNotification[] => {
  const all: AppNotification[] = [];
  all.push(...checkLowStock());
  all.push(...checkExpiringItems());
  all.push(...checkOutstandingDebts());
  all.push(...checkUnpaidSuppliers());
  all.push(...checkOverdueExpenses());
  all.push(...checkRecurringExpenses());
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
