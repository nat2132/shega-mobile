import { useState, useCallback, useRef, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import { playNice, playBad } from '@/services/soundService';
import { getItemByBarcode, searchInventory } from '@/database/db';
import { useSettings } from '@/context/SettingsContext';

export interface ScannedProduct {
  id: number;
  name: string;
  categoryId: number;
  categoryName: string;
  sku: string | null;
  barcode: string | null;
  companyName: string | null;
  purchaseUnit: string;
  baseUnit: string;
  unitsPerPack: number;
  totalPackQuantity: number;
  totalBaseQuantity: number;
  packPurchasePrice: number;
  basePurchasePrice: number;
  baseSellingPrice: number;
  packSellingPrice: number;
  allowSellByBaseUnit: number;
  allowSellByPackUnit: number;
  expiryDate: string | null;
  qualityGrade: string | null;
  notes: string | null;
  isCredit: number;
  supplierPhone: string | null;
  supplierAccount: string | null;
  supplierCallEnabled: number;
  lastPriceCheckAt: string | null;
  createdAt: string;
  warehouseId: number | null;
  supplierId: number | null;
  taxType: string | null;
  taxRate: number | null;
  reorderPoint: number | null;
  reorderQty: number | null;
  autoReorder: number | null;
  isActive: number;
}

export interface BarcodeScanResult {
  barcode: string;
  type: string;
  bounds?: { x: number; y: number; width: number; height: number };
}

export interface UseBarcodeScannerOptions {
  onProductFound?: (product: ScannedProduct) => void;
  onProductNotFound?: (barcode: string) => void;
  onError?: (error: Error) => void;
  debounceMs?: number;
  cooldownMs?: number;
  maxDuplicateScans?: number;
  duplicateWindowMs?: number;
  enableSound?: boolean;
  enableHaptics?: boolean;
  allowedBarcodeTypes?: string[];
}

export interface UseBarcodeScannerReturn {
  scanBarcode: (barcode: string, type?: string) => Promise<ScannedProduct | null>;
  lookupProduct: (barcode: string) => Promise<ScannedProduct | null>;
  searchProducts: (query: string) => Promise<ScannedProduct[]>;
  isScanning: boolean;
  lastScannedBarcode: string | null;
  lastScannedProduct: ScannedProduct | null;
  scanCount: number;
  resetScanner: () => void;
  setScanning: (scanning: boolean) => void;
}

const DEFAULT_OPTIONS: Required<UseBarcodeScannerOptions> = {
  onProductFound: () => {},
  onProductNotFound: () => {},
  onError: () => {},
  debounceMs: 100,
  cooldownMs: 1500,
  maxDuplicateScans: 1,
  duplicateWindowMs: 3000,
  enableSound: true,
  enableHaptics: true,
  allowedBarcodeTypes: [
    'EAN-13',
    'EAN-8',
    'UPC-A',
    'UPC-E',
    'CODE128',
    'CODE39',
    'CODE93',
    'CODABAR',
    'ITF',
    'QR_CODE',
    'PDF417',
    'AZTEC',
    'DATA_MATRIX',
    'MANUAL',
  ],
};

export function useBarcodeScanner(
  options: UseBarcodeScannerOptions = {}
): UseBarcodeScannerReturn {
  const { t } = useSettings();
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const [isScanning, setIsScanning] = useState(false);
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(null);
  const [lastScannedProduct, setLastScannedProduct] = useState<ScannedProduct | null>(null);
  const [scanCount, setScanCount] = useState(0);

  const lastScanTimeRef = useRef<number>(0);
  const scanHistoryRef = useRef<Array<{ barcode: string; timestamp: number }>>([]);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProcessingRef = useRef(false);

  const cleanup = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const isDuplicateScan = useCallback((barcode: string): boolean => {
    const now = Date.now();
    const recentScans = scanHistoryRef.current.filter(
      (scan) => now - scan.timestamp < opts.duplicateWindowMs && scan.barcode === barcode
    );
    return recentScans.length >= opts.maxDuplicateScans;
  }, [opts.maxDuplicateScans, opts.duplicateWindowMs]);

  const recordScan = useCallback((barcode: string) => {
    const now = Date.now();
    scanHistoryRef.current.push({ barcode, timestamp: now });
    scanHistoryRef.current = scanHistoryRef.current.filter(
      (scan) => now - scan.timestamp < opts.duplicateWindowMs * 2
    );
    lastScanTimeRef.current = now;
    setScanCount((prev) => prev + 1);
  }, [opts.duplicateWindowMs]);

  const triggerFeedback = useCallback((success: boolean) => {
    if (opts.enableHaptics) {
      Haptics.notificationAsync(
        success ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
      );
    }
    if (opts.enableSound) {
      if (success) {
        playNice();
      } else {
        playBad();
      }
    }
  }, [opts.enableHaptics, opts.enableSound]);

  const validateBarcodeType = useCallback((type: string): boolean => {
    return opts.allowedBarcodeTypes.includes(type.toUpperCase());
  }, [opts.allowedBarcodeTypes]);

  const lookupProduct = useCallback(async (barcode: string): Promise<ScannedProduct | null> => {
    try {
      const product = getItemByBarcode(barcode) as ScannedProduct | null;
      if (product && product.isActive === 0) {
        return null;
      }
      return product;
    } catch (error) {
      console.error('[BarcodeScanner] Lookup error:', error);
      opts.onError?.(error instanceof Error ? error : new Error('Lookup failed'));
      return null;
    }
  }, [opts]);

  const searchProducts = useCallback(async (query: string): Promise<ScannedProduct[]> => {
    try {
      if (!query.trim()) return [];
      const results = searchInventory(query.trim()) as ScannedProduct[];
      return results.filter((p) => p.isActive !== 0);
    } catch (error) {
      console.error('[BarcodeScanner] Search error:', error);
      opts.onError?.(error instanceof Error ? error : new Error('Search failed'));
      return [];
    }
  }, [opts]);

  const processScan = useCallback(async (barcode: string, type: string = 'UNKNOWN'): Promise<ScannedProduct | null> => {
    const cleanBarcode = barcode.trim();
    if (!cleanBarcode || cleanBarcode.length < 4) {
      triggerFeedback(false);
      return null;
    }

    if (!validateBarcodeType(type)) {
      console.warn('[BarcodeScanner] Unsupported barcode type:', type);
    }

    if (isProcessingRef.current) {
      return null;
    }

    const now = Date.now();
    if (now - lastScanTimeRef.current < opts.cooldownMs) {
      return null;
    }

    if (isDuplicateScan(cleanBarcode)) {
      console.log('[BarcodeScanner] Duplicate scan prevented:', cleanBarcode);
      return null;
    }

    isProcessingRef.current = true;

    try {
      const product = await lookupProduct(cleanBarcode);
      recordScan(cleanBarcode);

      if (product) {
        setLastScannedBarcode(cleanBarcode);
        setLastScannedProduct(product);
        triggerFeedback(true);
        opts.onProductFound?.(product);
        return product;
      } else {
        setLastScannedBarcode(cleanBarcode);
        setLastScannedProduct(null);
        triggerFeedback(false);
        opts.onProductNotFound?.(cleanBarcode);
        return null;
      }
    } catch (error) {
      console.error('[BarcodeScanner] Process scan error:', error);
      triggerFeedback(false);
      opts.onError?.(error instanceof Error ? error : new Error('Scan processing failed'));
      return null;
    } finally {
      isProcessingRef.current = false;
    }
  }, [
    lookupProduct,
    recordScan,
    triggerFeedback,
    validateBarcodeType,
    isDuplicateScan,
    opts.cooldownMs,
    opts.onProductFound,
    opts.onProductNotFound,
    opts.onError,
  ]);

  const scanBarcode = useCallback(async (barcode: string, type?: string): Promise<ScannedProduct | null> => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    return new Promise((resolve) => {
      debounceTimerRef.current = setTimeout(() => {
        resolve(processScan(barcode, type));
      }, opts.debounceMs);
    });
  }, [processScan, opts.debounceMs]);

  const resetScanner = useCallback(() => {
    cleanup();
    scanHistoryRef.current = [];
    lastScanTimeRef.current = 0;
    isProcessingRef.current = false;
    setLastScannedBarcode(null);
    setLastScannedProduct(null);
    setScanCount(0);
  }, [cleanup]);

  return {
    scanBarcode,
    lookupProduct,
    searchProducts,
    isScanning,
    lastScannedBarcode,
    lastScannedProduct,
    scanCount,
    resetScanner,
    setScanning: setIsScanning,
  };
}

export default useBarcodeScanner;