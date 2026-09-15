import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { getWarehouses, getWarehouseById } from '@/database/db';
import { useSettings } from './SettingsContext';

interface Warehouse {
  id: number;
  name: string;
  location?: string;
  contactPerson?: string;
  phone?: string;
  notes?: string;
}

interface WarehouseContextType {
  activeWarehouseId: number | null;
  activeWarehouse: Warehouse | null;
  warehouses: Warehouse[];
  setActiveWarehouseId: (id: number | null) => Promise<void>;
  refreshWarehouses: () => void;
}

const WarehouseContext = createContext<WarehouseContextType | undefined>(undefined);

export function WarehouseProvider({ children }: { children: React.ReactNode }) {
  const { featureFlags } = useSettings();
  const warehousesEnabled = featureFlags.warehousesEnabled;
  const [activeWarehouseId, setActiveWarehouseIdState] = useState<number | null>(null);
  const [activeWarehouse, setActiveWarehouse] = useState<Warehouse | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const loadWarehouses = useCallback(() => {
    const data = getWarehouses() as Warehouse[];
    setWarehouses(data);
  }, []);

  useEffect(() => {
    if (!warehousesEnabled) {
      setWarehouses([]);
      setActiveWarehouseIdState(null);
      setActiveWarehouse(null);
      return;
    }
    loadWarehouses();
  }, [warehousesEnabled, loadWarehouses]);

  useEffect(() => {
    if (!warehousesEnabled) return;
    const loadActiveWarehouse = async () => {
      const saved = await SecureStore.getItemAsync('active_warehouse_id');
      if (saved) {
        const id = parseInt(saved, 10);
        if (!isNaN(id)) {
          setActiveWarehouseIdState(id);
          const wh = getWarehouseById(id) as Warehouse | null;
          setActiveWarehouse(wh);
        }
      }
    };
    loadActiveWarehouse();
  }, [warehousesEnabled]);

  useEffect(() => {
    if (!warehousesEnabled) return;
    if (activeWarehouseId) {
      const wh = warehouses.find(w => w.id === activeWarehouseId);
      setActiveWarehouse(wh || null);
    } else {
      setActiveWarehouse(null);
    }
  }, [warehousesEnabled, activeWarehouseId, warehouses]);

  const setActiveWarehouseId = useCallback(async (id: number | null) => {
    setActiveWarehouseIdState(id);
    if (id !== null) {
      await SecureStore.setItemAsync('active_warehouse_id', id.toString());
    } else {
      await SecureStore.deleteItemAsync('active_warehouse_id');
    }
  }, []);

  const refreshWarehouses = useCallback(() => {
    loadWarehouses();
  }, [loadWarehouses]);

  return (
    <WarehouseContext.Provider value={{
      activeWarehouseId,
      activeWarehouse,
      warehouses,
      setActiveWarehouseId,
      refreshWarehouses,
    }}>
      {children}
    </WarehouseContext.Provider>
  );
}

export const useWarehouse = () => {
  const context = useContext(WarehouseContext);
  if (context === undefined) {
    console.warn('useWarehouse called outside WarehouseProvider – using fallback defaults');
    return {
      activeWarehouseId: null,
      activeWarehouse: null,
      warehouses: [],
      setActiveWarehouseId: async () => {},
      refreshWarehouses: () => {},
    };
  }
  return context;
};
