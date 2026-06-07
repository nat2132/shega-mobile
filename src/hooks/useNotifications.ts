import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { getLowStockItems, getDebtCustomers, getRecurringExpensesDueToday } from '@/database/db';

export const useNotifications = () => {
  const [notifCount, setNotifCount] = useState(0);
  const [dueExpenses, setDueExpenses] = useState<any[]>([]);

  const loadCounts = useCallback(async () => {
    try {
      const lowStock = await getLowStockItems();
      const debts = await getDebtCustomers();
      const dueExpensesList = getRecurringExpensesDueToday();
      setDueExpenses(dueExpensesList);
      setNotifCount(lowStock.length + debts.length + dueExpensesList.length);
    } catch (e) {
      console.error('Error fetching notification counts:', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCounts();
    }, [loadCounts])
  );

  return { notifCount, dueExpenses, refreshNotifications: loadCounts };
};