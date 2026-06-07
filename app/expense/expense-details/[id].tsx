import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { getExpenseById } from '@/database/db';
import { useSettings } from '@/context/SettingsContext';
import ExpenseDetails from '@/screens/expense/expense-details';

export default function ExpenseDetailsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useSettings();
  const [expense, setExpense] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const expenseId = Number(id);
    if (!expenseId || Number.isNaN(expenseId)) {
      setLoading(false);
      return;
    }
    const found = getExpenseById(expenseId);
    setExpense(found);
    setLoading(false);
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  if (!expense) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ExpenseDetails
        expense={expense}
        onClose={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(tabs)/expense' as any);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
