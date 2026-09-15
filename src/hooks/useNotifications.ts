import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { getLowStockItems, getDebtCustomers } from '@/database/db';

export const useNotifications = () => {
  const [notifCount, setNotifCount] = useState(0);

  const loadCounts = useCallback(async () => {
    try {
      const lowStock = await getLowStockItems();
      const debts = await getDebtCustomers();
      setNotifCount(lowStock.length + debts.length);
    } catch (e) {
      console.error('Error fetching notification counts:', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCounts();
    }, [loadCounts])
  );

  return { notifCount, refreshNotifications: loadCounts };
};