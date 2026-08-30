import React, { useCallback, useState } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { router } from 'expo-router';
import SaleFormScreen from '../src/screens/sales/sale-form';
import { recordSaleBatch } from '../src/services/saleService';
import { useSync } from '../src/context/SyncContext';
import { useToast } from '../src/context/ToastContext';
import { useSettings } from '../src/context/SettingsContext';

export default function SaleFormPage() {
  const { colors } = useSettings();
  const { requestSync } = useSync();
  const { showToast } = useToast();
  const [cart, setCart] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const addItem = useCallback((item: any) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id
            ? { ...i, quantity: Math.max(1, (i.quantity || 1) + 1) }
            : i,
        );
      }
      return [...prev, { ...item, quantity: 1, unitType: "base" }];
    });
  }, []);

  const updateItem = useCallback((id: any, updates: any) => {
    setCart((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
  }, []);

  const removeItem = useCallback((id: any) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const handleFinish = useCallback(
    async (saleMetadata: any) => {
      if (submitting) return;
      setSubmitting(true);
      try {
        await recordSaleBatch(cart, saleMetadata);
        await requestSync();
        showToast({
          title: saleMetadata.paymentStatus === "Debt" ? "Debt recorded" : "Sale recorded",
          message: `Batch saved · ETB ${Number(saleMetadata.totalPrice || 0).toFixed(2)}`,
          type: "success",
        });
        router.back();
      } catch (error) {
        console.error("Standalone sale error:", error);
        showToast({
          title: "Something went wrong",
          message: "The sale was not saved. Please try again.",
          type: "error",
        });
        setSubmitting(false);
      }
    },
    [cart, submitting, requestSync, showToast],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background || "#FFFFFF" }]}>
      {submitting ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : null}
      <SaleFormScreen
        cart={cart}
        onAddItem={addItem}
        onUpdateItem={updateItem}
        onRemoveItem={removeItem}
        onFinish={handleFinish}
        onBack={() => router.back()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 12 },
  loading: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.65)",
  },
});