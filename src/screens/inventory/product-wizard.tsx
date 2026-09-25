import { CustomDatePicker } from '@/components/CustomDatePicker';
import { DraftSection } from '@/components/DraftSection';
import { AppNumber, AppText } from '@/components/ui';
import { Fonts } from '@/constants/theme';
import { useDialog } from '@/context/DialogContext';
import { useSettings } from '@/context/SettingsContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { useWarehouse } from '@/context/WarehouseContext';
import {
  generateShegaCode,
  getItemById,
  getItems,
  getPriceHistory,
  findItemsByNameInCategory,
  getSuppliers,
  getUserCategories,
  insertCategory,
  insertContact,
  insertItem,
  updateItem
} from '@/database/db';
import { useFormDrafts } from '@/hooks/useFormDrafts';
import { usePermissions } from '@/hooks/usePermissions';
import { requestImagePermission, openAppSettings } from '@/services/imagePermission';
import { Draft } from '@/services/draftService';
import { playBad, playNice } from '@/services/soundService';
import { ProductImageGallery } from '@/components/ProductImageGallery';
import { parseProductImages, serializeProductImages } from '@/utils/productImages';
import { formatDate } from '@/utils/date-utils';
import {
  fmtMoney,
  fmtPercent,
  profitMetrics,
  splitTax,
  stockForecast,
  suggestedSellingPrice,
} from '@/utils/pricing';
import { getActiveTaxType } from '@/services/taxService';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import {
  AlertCircle,
  ArrowRight,
  Barcode,
  Building2,
  Calendar,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  CreditCard,
  Image as ImageIcon,
  LayoutGrid,
  Lock,
  Package,
  Phone,
  PhoneCall,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  Truck,
  TrendingUp,
  X
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import InventoryScannerSheet from '@/components/InventoryScannerSheet';
import { getInventoryGlass } from './glass-inventory';

const QUALITY_GRADES = ['grade1', 'grade2', 'grade3'];

const STEP_LABELS = ['identify', 'info', 'photo', 'pricing', 'stock'] as const;

interface ProductWizardProps {
  onSuccess?: () => void;
  onClose?: () => void;
  onViewProduct?: (item: any) => void;
}

export const ProductWizard = ({ onSuccess, onClose, onViewProduct }: ProductWizardProps) => {
  const { colors, t, calendarType, language, featureFlags } = useSettings();
  const G = getInventoryGlass(colors);
  const styles = useMemo(() => createStyles(G), [G]);
  const router = useRouter();
  const dialog = useDialog();
  const { isReadOnly } = useSubscription();
  const { canAdjustStock, canManageCatalog } = usePermissions();
  const { activeWarehouseId, warehouses } = useWarehouse();

  // -- flow state ----------------------------------------------------------
  const [mode, setMode] = useState<'create' | 'restock' | null>(null);
  const [step, setStep] = useState(2);
  const [done, setDone] = useState(false);
  const [savedItem, setSavedItem] = useState<any>(null);
  const dormant = done || !mode;

  // -- identify -------------------------------------------------------------
  const [showScanner, setShowScanner] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [allItems, setAllItems] = useState<any[]>([]);
  const sellInputRef = useRef<TextInput>(null);

  // -- restock ---------------------------------------------------------------
  const [restockItem, setRestockItem] = useState<any>(null);
  const [restockQty, setRestockQty] = useState('1');
  const [buyingPrice, setBuyingPrice] = useState('');
  const [unitSellingPrice, setUnitSellingPrice] = useState('');
  const [bulkSellingPrice, setBulkSellingPrice] = useState('');

  // -- create: product info --------------------------------------------------
  const [itemName, setItemName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [baseUnit, setBaseUnit] = useState('pcs');
  const [sku, setSku] = useState('');

  // -- create: photo & barcode ------------------------------------------------
  const [image, setImage] = useState<string | null>(null);
  const [productImages, setProductImages] = useState<string[]>([]);
  const [primaryImageIdx, setPrimaryImageIdx] = useState<number>(0);
  const [barcodeMode, setBarcodeMode] = useState<'external' | 'shega' | 'none'>('none');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');

  // -- create: pricing & tax ---------------------------------------------------
  const [taxType, setTaxType] = useState<'VAT' | 'TOT' | 'None'>('VAT');
  const [basePurchasePrice, setBasePurchasePrice] = useState('');
  const [baseSellingPrice, setBaseSellingPrice] = useState('');
  const [taxTreatment, setTaxTreatment] = useState<'inclusive' | 'exclusive'>('exclusive');
  const [costTransport, setCostTransport] = useState('');
  const [costImport, setCostImport] = useState('');
  const [costPackaging, setCostPackaging] = useState('');
  const [costHandling, setCostHandling] = useState('');
  const [costOther, setCostOther] = useState('');
  const [targetMargin, setTargetMargin] = useState('');
  const [wholesalePrice, setWholesalePrice] = useState('');
  const [minWholesaleQty, setMinWholesaleQty] = useState('');
  const [showPricingAdvanced, setShowPricingAdvanced] = useState(false);
  const [showPricingCalc, setShowPricingCalc] = useState(false);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const priceLocked = isReadOnly || !canManageCatalog;

  // -- create: initial stock ---------------------------------------------------
  const [stockQty, setStockQty] = useState('0');
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierAccount, setSupplierAccount] = useState('');
  const [supplierCallEnabled, setSupplierCallEnabled] = useState(false);
  const [creditToggle, setCreditToggle] = useState<'Yes' | 'No'>('No');
  const [warehouseId, setWarehouseId] = useState<number | null>(activeWarehouseId);
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  const [showExpiryPicker, setShowExpiryPicker] = useState(false);
  const [batchNumber, setBatchNumber] = useState('');
  const [qualityGrade, setQualityGrade] = useState('grade1');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const generatedRef = useRef<string>('');

  const ensureGenerated = useCallback(() => {
    if (!generatedRef.current) {
      try {
        generatedRef.current = generateShegaCode();
      } catch {
        generatedRef.current = '';
      }
    }
    setGeneratedCode(generatedRef.current);
  }, []);

  useEffect(() => {
    ensureGenerated();
    const items = getItems();
    setAllItems(items);
    const sups = getSuppliers();
    setSuppliers(sups);
    const cats = getUserCategories();
    if (cats && cats.length) setCategories(cats as any[]);
  }, [ensureGenerated]);

  // -- drafts -----------------------------------------------------------------
  const createPayload = useCallback(() => {
    if (dormant) return {};
    return {
      step,
      itemName,
      companyName,
      selectedCategory,
      baseUnit,
      stockQty,
      sku,
      image,
      barcodeMode,
      barcodeInput,
      generatedCode,
      taxType,
      basePurchasePrice,
      baseSellingPrice,
      selectedSupplier,
      supplierPhone,
      supplierAccount,
      supplierCallEnabled,
      creditToggle,
      warehouseId,
      expiryDate,
      batchNumber,
      qualityGrade,
      taxTreatment,
      costTransport,
      costImport,
      costPackaging,
      costHandling,
      costOther,
      targetMargin,
      wholesalePrice,
      minWholesaleQty,
    };
  }, [
    dormant, step, itemName, companyName, selectedCategory, baseUnit,
    stockQty, sku, image, barcodeMode, barcodeInput,
    generatedCode, taxType, basePurchasePrice, baseSellingPrice,
    selectedSupplier, supplierPhone, supplierAccount,
    supplierCallEnabled, creditToggle, warehouseId, expiryDate, batchNumber, qualityGrade,
    taxTreatment, costTransport, costImport, costPackaging, costHandling, costOther,
    targetMargin, wholesalePrice, minWholesaleQty,
  ]);

  const createDrafts = useFormDrafts({
    screen: 'inventory',
    formKey: 'product-wizard-create',
    getPayload: createPayload,
    getTitle: useCallback(() => t('draft.inventory_title', { name: itemName || t('draft.inventory_default') }), [itemName, t]),
    getSubtitle: useCallback(() => t('draft.inventory_subtitle', { step: String(step) }), [step, t]),
    enabled: true,
  });

  const restockPayload = useCallback(() => {
    if (dormant || !restockItem) return {};
    return {
      restockItem,
      restockQty,
      buyingPrice,
      unitSellingPrice,
      bulkSellingPrice,
      selectedSupplier,
      creditToggle,
      warehouseId,
      expiryDate,
      batchNumber,
      taxTreatment,
      costTransport,
      costImport,
      costPackaging,
      costHandling,
      costOther,
      targetMargin,
      wholesalePrice,
      minWholesaleQty,
    };
  }, [dormant, restockItem, restockQty, buyingPrice, unitSellingPrice, bulkSellingPrice, selectedSupplier, creditToggle, warehouseId, expiryDate, batchNumber, taxTreatment, costTransport, costImport, costPackaging, costHandling, costOther, targetMargin, wholesalePrice, minWholesaleQty]);

  const restockDrafts = useFormDrafts({
    screen: 'inventory',
    formKey: 'product-wizard-restock',
    getPayload: restockPayload,
    getTitle: useCallback(() => (restockItem?.name ? t('draft.restock_title', { name: restockItem.name }) : t('draft.restock_default')), [restockItem, t]),
    getSubtitle: useCallback(() => t('draft.restock_subtitle', { qty: restockQty || '0' }), [restockQty, t]),
    enabled: true,
  });

  // -- derived -----------------------------------------------------------------
  const stockBaseQty = Number(stockQty) || 0;
  const baseCost = Number(basePurchasePrice) || 0;
  const extraCostPerBase =
    (Number(costTransport) || 0) +
    (Number(costImport) || 0) +
    (Number(costPackaging) || 0) +
    (Number(costHandling) || 0) +
    (Number(costOther) || 0);
  const effectiveCost = baseCost + extraCostPerBase;
  const retailPrice = Number(baseSellingPrice) || 0;
  const baseMetrics = profitMetrics(effectiveCost, retailPrice, taxType, taxTreatment);
  const wholesaleRaw = Number(wholesalePrice) || 0;
  const wholesaleMetrics = wholesaleRaw > 0 ? profitMetrics(effectiveCost, wholesaleRaw, taxType, taxTreatment) : null;
  const suggested = Number(targetMargin) > 0 ? suggestedSellingPrice(effectiveCost, Number(targetMargin), taxType, taxTreatment) : null;
  const targetReached = Number(targetMargin) > 0 && isFinite(baseMetrics.margin) && baseMetrics.margin >= Number(targetMargin);
  const taxSplit = splitTax(retailPrice, taxType, taxTreatment);

  const finalBarcode = barcodeMode === 'external' ? barcodeInput || null : barcodeMode === 'shega' ? generatedCode || null : null;
  const finalSku = (sku && sku.trim()) || barcodeInput || generatedCode || null;

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return allItems.slice(0, 40);
    const q = searchQuery.toLowerCase();
    return allItems.filter((i: any) =>
      i.name?.toLowerCase().includes(q) ||
      i.categoryName?.toLowerCase().includes(q) ||
      i.barcode?.toLowerCase().includes(q) ||
      i.sku?.toLowerCase().includes(q)
    ).slice(0, 40);
  }, [allItems, searchQuery]);

  // -- actions -------------------------------------------------------------------
  const goHome = useCallback(() => {
    setMode(null);
    setStep(2);
    setDone(false);
    setSavedItem(null);
    setRestockItem(null);
    setSearching(false);
    setSearchQuery('');
    setShowScanner(false);
  }, []);

  const handleScannedFound = useCallback(async (item: any) => {
    if (isReadOnly) {
      setShowScanner(false);
      await dialog.alert({ title: t('common.read_only_mode'), message: t('common.read_only_mode'), iconType: 'warning' });
      return;
    }
    if (!canAdjustStock) {
      setShowScanner(false);
      await dialog.alert({ title: t('form.restock_item'), message: t('inventory.no_stock_permission') || 'You do not have permission to adjust stock.', iconType: 'warning' });
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowScanner(false);
    setRestockItem(item);
    setBuyingPrice(String(item.basePurchasePrice || ''));
    setUnitSellingPrice(String(item.baseSellingPrice || ''));
    setBulkSellingPrice(String(item.baseSellingPrice || ''));
    setRestockQty('1');
    const linked = suppliers.find((s: any) => s.id === item.supplierId);
    setSelectedSupplier(linked || null);
    setTaxType(item.taxType || 'VAT');
    setTaxTreatment(item.taxTreatment === 'inclusive' ? 'inclusive' : 'exclusive');
    setPriceHistory(getPriceHistory(item.id));
    setMode('restock');
    setStep(5);
  }, [isReadOnly, canAdjustStock, dialog, t, suppliers]);

  const handleScannedMiss = useCallback((code: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowScanner(false);
    setMode('create');
    setStep(2);
    setBarcodeMode('external');
    setBarcodeInput(code);
    setSku(code);
    ensureGenerated();
  }, [ensureGenerated]);

  const handleScannedForBarcode = useCallback((code: string) => {
    setShowScanner(false);
    setBarcodeInput(code);
    if (!sku.trim()) setSku(code);
  }, [sku]);

  const startCreate = useCallback(() => {
    if (isReadOnly) {
      dialog.alert({ title: t('common.read_only_mode'), message: t('common.read_only_mode'), iconType: 'warning' });
      return;
    }
    if (!canManageCatalog && !canAdjustStock) {
      dialog.alert({ title: t('inventory.new_product'), message: t('inventory.no_catalog_permission') || 'You do not have permission to create products.', iconType: 'warning' });
      return;
    }
    ensureGenerated();
    if (!sku.trim() && !barcodeInput) setSku(generatedRef.current || '');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMode('create');
    setStep(2);
    setSearching(false);
  }, [isReadOnly, canManageCatalog, canAdjustStock, dialog, t, ensureGenerated, sku, barcodeInput]);

  const restoreCreateDraft = useCallback(async (draft: Draft) => {
    const d = draft.data;
    setItemName(d.itemName || '');
    setCompanyName(d.companyName || '');
    setSelectedCategory(d.selectedCategory || null);
    setBaseUnit(d.baseUnit || 'pcs');
    setStockQty(d.stockQty || '0');
    setSku(d.sku || '');
    setImage(d.image || null);
    setBarcodeMode(d.barcodeMode || 'none');
    setBarcodeInput(d.barcodeInput || '');
    setGeneratedCode(d.generatedCode || '');
    setTaxType(d.taxType || 'VAT');
    setBasePurchasePrice(d.basePurchasePrice || '');
    setBaseSellingPrice(d.baseSellingPrice || '');
    setSelectedSupplier(d.selectedSupplier || null);
    setSupplierPhone(d.supplierPhone || '');
    setSupplierAccount(d.supplierAccount || '');
    setSupplierCallEnabled(d.supplierCallEnabled || false);
    setCreditToggle(d.creditToggle || 'No');
    setWarehouseId(d.warehouseId ?? activeWarehouseId);
    setExpiryDate(d.expiryDate || '');
    setBatchNumber(d.batchNumber || '');
    setQualityGrade(d.qualityGrade || 'grade1');
    setTaxTreatment(d.taxTreatment === 'inclusive' ? 'inclusive' : 'exclusive');
    setCostTransport(d.costTransport || '');
    setCostImport(d.costImport || '');
    setCostPackaging(d.costPackaging || '');
    setCostHandling(d.costHandling || '');
    setCostOther(d.costOther || '');
    setTargetMargin(d.targetMargin || '');
    setWholesalePrice(d.wholesalePrice || '');
    setMinWholesaleQty(d.minWholesaleQty || '');
    setMode('create');
    setStep(d.step || 2);
    setSearching(false);
    await createDrafts.remove(draft.id);
  }, [createDrafts, activeWarehouseId]);

  const restoreRestockDraft = useCallback(async (draft: Draft) => {
    const d = draft.data;
    if (d.restockItem) setRestockItem(d.restockItem);
    setRestockQty(d.restockQty || '1');
    setBuyingPrice(d.buyingPrice || '');
    setUnitSellingPrice(d.unitSellingPrice || '');
    setBulkSellingPrice(d.bulkSellingPrice || '');
    setSelectedSupplier(d.selectedSupplier || null);
    setCreditToggle(d.creditToggle || 'No');
    setWarehouseId(d.warehouseId ?? activeWarehouseId);
    setExpiryDate(d.expiryDate || '');
    setBatchNumber(d.batchNumber || '');
    setTaxTreatment(d.taxTreatment === 'inclusive' ? 'inclusive' : 'exclusive');
    setCostTransport(d.costTransport || '');
    setCostImport(d.costImport || '');
    setCostPackaging(d.costPackaging || '');
    setCostHandling(d.costHandling || '');
    setCostOther(d.costOther || '');
    setTargetMargin(d.targetMargin || '');
    setWholesalePrice(d.wholesalePrice || '');
    setMinWholesaleQty(d.minWholesaleQty || '');
    setPriceHistory(getPriceHistory(Number(d.restockItem?.id)));
    setMode('restock');
    setStep(5);
    setSearching(false);
    await restockDrafts.remove(draft.id);
  }, [restockDrafts, activeWarehouseId]);

  const handleNext = useCallback(() => {
    const currentErrors: Record<string, string> = {};

    if (mode === 'create') {
      if (step === 2) {
        if (!itemName.trim()) currentErrors.itemName = t('form.error_name_required');
      } else if (step === 4) {
        if (!priceLocked) {
          if (!baseSellingPrice || Number(baseSellingPrice) <= 0) currentErrors.sellingPrice = t('form.error_price_positive');
        }
      } else if (step === 5) {
        if (creditToggle === 'Yes' && !selectedSupplier) currentErrors.supplier = t('form.tap_select_supplier');
      }
    } else if (mode === 'restock' && step === 5) {
      const qty = Number(restockQty) || 0;
      if (qty <= 0) currentErrors.quantity = t('form.error_quantity_positive');
      if (creditToggle === 'Yes' && !selectedSupplier) currentErrors.supplier = t('form.tap_select_supplier');
    }

    setErrors(currentErrors);
    if (Object.keys(currentErrors).length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      playBad();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(step + 1);
  }, [mode, step, itemName, priceLocked, baseSellingPrice, restockQty, creditToggle, selectedSupplier, t]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (mode === 'restock') goHome();
    else if (step > 2) setStep(step - 1);
    else goHome();
  }, [mode, step, goHome]);

  /**
   * Recover from a denied photo/camera permission: offer an immediate retry, or
   * a shortcut into the OS settings when the prompt can no longer be shown.
   * Resolves true when the caller should retry the action.
   */
  const reclaimImagePermission = useCallback(
    async (kind: 'camera' | 'library', canAskAgain: boolean): Promise<boolean> => {
      const message = kind === 'camera' ? t('permission.camera_message') : t('permission.library_message');
      if (canAskAgain) {
        return dialog.confirm({
          title: t('permission.required'),
          message,
          confirmText: t('common.try_again'),
          cancelText: t('common.cancel'),
          iconType: 'warning',
        });
      }
      const openSettings = await dialog.confirm({
        title: t('permission.required'),
        message,
        confirmText: t('common.open_settings'),
        cancelText: t('common.cancel'),
        iconType: 'warning',
      });
      if (openSettings) openAppSettings();
      return false;
    },
    [dialog, t],
  );

  const takePhoto = useCallback(async (attempt = 0): Promise<void> => {
    try {
      const { granted, canAskAgain } = await requestImagePermission('camera');
      if (!granted) {
        if (attempt < 2 && (await reclaimImagePermission('camera', canAskAgain))) {
          await takePhoto(attempt + 1);
        }
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.5,
        base64: true,
        allowsEditing: true,
        aspect: [4, 3],
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setImage(asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri);
      }
    } catch (e) {
      console.error('Take product photo error:', e);
    }
  }, [reclaimImagePermission]);

  const pickFromLibrary = useCallback(async (attempt = 0): Promise<void> => {
    try {
      const { granted, canAskAgain } = await requestImagePermission('library');
      if (!granted) {
        if (attempt < 2 && (await reclaimImagePermission('library', canAskAgain))) {
          await pickFromLibrary(attempt + 1);
        }
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.5,
        base64: true,
        allowsEditing: true,
        aspect: [4, 3],
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setImage(asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri);
      }
    } catch (e) {
      console.error('Pick product photo error:', e);
    }
  }, [reclaimImagePermission]);

  const createNewCategory = useCallback(async () => {
    const name = newCategory.trim();
    if (!name) return null;
    const newId = await insertCategory(name, '📦', true);
    if (newId) {
      const cat = { id: Number(newId), name, icon: '📦' };
      setCategories((prev) => [...prev, cat]);
      setSelectedCategory(cat);
      setNewCategory('');
    }
    return newId ? Number(newId) : null;
  }, [newCategory]);

  const createNewSupplier = useCallback(async () => {
    const name = newSupplierName.trim();
    if (!name) return;
    const id = await insertContact({
      fullName: name,
      category: 'supplier',
      phone: newSupplierPhone.trim() || undefined,
    });
    if (id) {
      const sup = { id: Number(id), fullName: name, phone: newSupplierPhone.trim() || null };
      setSuppliers((prev) => [...prev, sup]);
      setSelectedSupplier(sup);
      setSupplierPhone(sup.phone || '');
    }
    setShowNewSupplier(false);
    setNewSupplierName('');
    setNewSupplierPhone('');
  }, [newSupplierName, newSupplierPhone]);

  const callSupplier = useCallback(() => {
    const phone = selectedSupplier?.phone?.replace(/[^0-9+]/g, '') || supplierPhone.replace(/[^0-9+]/g, '');
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(async () => {
      await dialog.alert({ title: t('common.error'), message: t('form.could_not_call'), iconType: 'danger' });
    });
  }, [selectedSupplier, supplierPhone, dialog, t]);

  // -- save -----------------------------------------------------------------
  const handleSaveCreate = useCallback(async () => {
    if (isReadOnly) {
      await dialog.alert({ title: t('common.read_only_mode'), message: t('common.read_only_mode'), iconType: 'warning' });
      return;
    }
    if (!canManageCatalog && !canAdjustStock) {
      await dialog.alert({ title: t('inventory.new_product'), message: t('inventory.no_catalog_permission') || 'You do not have permission to create products.', iconType: 'warning' });
      return;
    }
    if (!itemName.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      playBad();
      setErrors({ itemName: t('form.error_name_required') });
      return;
    }
    if (!priceLocked && (!baseSellingPrice || Number(baseSellingPrice) <= 0)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      playBad();
      setErrors({ sellingPrice: t('form.error_price_positive') });
      return;
    }

    setSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playNice();
    try {
      let finalCategoryId = selectedCategory?.id || 0;
      if (selectedCategory && (!selectedCategory.id || selectedCategory.id > 1000)) {
        const newId = await insertCategory(selectedCategory.name, selectedCategory.icon || '📦', true);
        if (newId) finalCategoryId = Number(newId);
      }

      const dupes = findItemsByNameInCategory(itemName.trim(), finalCategoryId);
      if (dupes.length > 0) {
        const proceed = await dialog.confirm({
          title: t('inventory.duplicate_item_title') || 'Duplicate item',
          message: t('inventory.duplicate_item_message', { name: itemName.trim() }) || `An item named '${itemName.trim()}' already exists in this category. Do you want to continue?`,
          confirmText: t('common.proceed') || 'Proceed',
          cancelText: t('common.cancel') || 'Cancel',
          iconType: 'warning',
        });
        if (!proceed) {
          setSaving(false);
          return;
        }
      }

      const totalBaseQty = Number(stockQty) || 0;
      const costPerBase = Number(basePurchasePrice) || 0;
      const sellPrice = priceLocked ? 0 : Number(baseSellingPrice) || 0;

      const itemData: any = {
        name: itemName.trim(),
        categoryId: finalCategoryId,
        companyName: companyName.trim(),
        purchaseUnit: baseUnit,
        baseUnit,
        unitsPerPack: 1,
        totalPackQuantity: totalBaseQty,
        totalBaseQuantity: totalBaseQty,
        packPurchasePrice: costPerBase,
        basePurchasePrice: costPerBase,
        baseSellingPrice: sellPrice,
        packSellingPrice: sellPrice,
        allowSellByBaseUnit: true,
        allowSellByPackUnit: false,
        barcode: finalBarcode,
        sku: finalSku,
        image: serializeProductImages(productImages, primaryImageIdx),
        taxType: getActiveTaxType()?.name || 'VAT',
        taxTreatment: 'exclusive',
        wholesaleSellingPrice: wholesaleRaw || null,
        minWholesaleQty: Number(minWholesaleQty) || null,
        transportCost: Number(costTransport) || 0,
        importCost: Number(costImport) || 0,
        packagingCost: Number(costPackaging) || 0,
        handlingCost: Number(costHandling) || 0,
        otherCost: Number(costOther) || 0,
        targetMargin: Number(targetMargin) || null,
        isCredit: creditToggle === 'Yes',
        expiryDate: expiryDate || undefined,
        qualityGrade,
        notes: batchNumber && batchNumber.trim() ? `Batch: ${batchNumber.trim()}` : undefined,
        warehouseId: warehouseId ?? undefined,
        supplierId: selectedSupplier?.id || undefined,
        supplierPhone: supplierPhone.trim() ? supplierPhone.trim() : undefined,
        supplierAccount: supplierAccount.trim() ? supplierAccount.trim() : undefined,
        supplierCallEnabled,
      };
      if (selectedSupplier) {
        itemData.supplierPaymentStatus = creditToggle === 'Yes' ? 'Unpaid' : 'Paid';
        itemData.supplierPaidAmount = creditToggle === 'Yes' ? 0 : costPerBase * totalBaseQty;
      }

      const insertedId = await insertItem(itemData);
      if (!insertedId) throw new Error('insertItem failed');

      await createDrafts.clearCurrent();
      const persisted: any = getItemById(Number(insertedId));
      setSavedItem(persisted ? { ...persisted, categoryName: persisted.categoryName || selectedCategory?.name || null } : { id: insertedId, categoryName: selectedCategory?.name || null, ...itemData });
      setDone(true);
    } catch (e) {
      console.error(e);
      await dialog.alert({ title: t('common.error'), message: t('inventory.failed_to_save'), iconType: 'danger' });
    } finally {
      setSaving(false);
    }
  }, [isReadOnly, canManageCatalog, canAdjustStock, itemName, priceLocked, baseSellingPrice, stockQty, selectedCategory, companyName, baseUnit, basePurchasePrice, finalBarcode, finalSku, image, taxType, taxTreatment, creditToggle, expiryDate, qualityGrade, batchNumber, warehouseId, selectedSupplier, supplierPhone, supplierAccount, supplierCallEnabled, wholesaleRaw, minWholesaleQty, targetMargin, costTransport, costImport, costPackaging, costHandling, costOther, dialog, t, createDrafts]);

  const handleSaveRestock = useCallback(async () => {
    if (isReadOnly) {
      await dialog.alert({ title: t('common.read_only_mode'), message: t('common.read_only_mode'), iconType: 'warning' });
      return;
    }
    if (!canAdjustStock) {
      await dialog.alert({ title: t('form.restock_item'), message: t('inventory.no_stock_permission') || 'You do not have permission to adjust stock.', iconType: 'warning' });
      return;
    }
    if (!restockItem) return;
    const qty = Number(restockQty) || 0;
    if (qty <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      playBad();
      setErrors({ quantity: t('form.error_quantity_positive') });
      return;
    }

    setSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playNice();
    try {
      const newBaseQty = (restockItem.totalBaseQuantity || 0) + qty;
      const newPackQty = newBaseQty;
      const updates: any = {
        totalBaseQuantity: newBaseQty,
        totalPackQuantity: newPackQty,
        supplierCallEnabled,
        notes: batchNumber && batchNumber.trim() ? `Batch: ${batchNumber.trim()}` : undefined,
      };
      if (!priceLocked) {
        updates.baseSellingPrice = Number(unitSellingPrice) || restockItem.baseSellingPrice;
      }
      updates.basePurchasePrice = Number(buyingPrice) || restockItem.basePurchasePrice || 0;
      updates.taxTreatment = taxTreatment;
      updates.transportCost = Number(costTransport) || 0;
      updates.importCost = Number(costImport) || 0;
      updates.packagingCost = Number(costPackaging) || 0;
      updates.handlingCost = Number(costHandling) || 0;
      updates.otherCost = Number(costOther) || 0;
      if (!priceLocked) {
        updates.wholesaleSellingPrice = wholesaleRaw || null;
        updates.minWholesaleQty = Number(minWholesaleQty) || null;
        updates.targetMargin = Number(targetMargin) || null;
      }
      if (supplierPhone.trim()) updates.supplierPhone = supplierPhone.trim();
      if (selectedSupplier) {
        updates.supplierPhone = selectedSupplier.phone || supplierPhone;
        updates.supplierAccount = selectedSupplier.accountNumber || restockItem.supplierAccount;
        updates.supplierId = selectedSupplier.id;
        const unitPrice = Number(buyingPrice) || restockItem.basePurchasePrice || 0;
        updates.purchaseUnitPrice = unitPrice;
        updates.purchasePaymentStatus = creditToggle === 'Yes' ? 'Unpaid' : 'Paid';
        updates.purchasePaidAmount = creditToggle === 'Yes' ? 0 : unitPrice * qty;
      }

      const success = updateItem(restockItem.id, updates);
      if (!success) throw new Error('updateItem failed');
      await restockDrafts.clearCurrent();
      const persisted = getItemById(restockItem.id, false);
      setSavedItem(persisted || { id: restockItem.id, name: restockItem.name, ...updates });
      setDone(true);
    } catch (e) {
      console.error(e);
      await dialog.alert({ title: t('common.error'), message: t('inventory.failed_to_save'), iconType: 'danger' });
    } finally {
      setSaving(false);
    }
  }, [isReadOnly, canAdjustStock, restockItem, restockQty, priceLocked, unitSellingPrice, bulkSellingPrice, buyingPrice, supplierPhone, selectedSupplier, supplierCallEnabled, creditToggle, batchNumber, taxTreatment, costTransport, costImport, costPackaging, costHandling, costOther, wholesaleRaw, minWholesaleQty, targetMargin, dialog, t, restockDrafts]);

  const handleAddAnother = useCallback(async () => {
    await createDrafts.clearCurrent().catch(() => {});
    await restockDrafts.clearCurrent().catch(() => {});
    setItemName('');
    setCompanyName('');
    setSelectedCategory(null);
    setShowCategoryPicker(false);
    setNewCategory('');
    setBaseUnit('pcs');
    setStockQty('0');
    setSku('');
    setImage(null);
    setBarcodeMode('none');
    setBarcodeInput('');
    setTaxType('VAT');
    setBasePurchasePrice('');
    setBaseSellingPrice('');
    setSelectedSupplier(null);
    setSupplierPhone('');
    setSupplierAccount('');
    setSupplierCallEnabled(false);
    setCreditToggle('No');
    setWarehouseId(activeWarehouseId);
    setExpiryDate('');
    setBatchNumber('');
    setQualityGrade('grade1');
    setRestockItem(null);
    setRestockQty('1');
    setBuyingPrice('');
    setUnitSellingPrice('');
    setBulkSellingPrice('');
    setTaxTreatment('exclusive');
    setCostTransport('');
    setCostImport('');
    setCostPackaging('');
    setCostHandling('');
    setCostOther('');
    setTargetMargin('');
    setWholesalePrice('');
    setMinWholesaleQty('');
    setShowPricingAdvanced(false);
    setShowPricingCalc(false);
    setPriceHistory([]);
    setSearchQuery('');
    setSearching(false);
    setErrors({});
    goHome();
  }, [createDrafts, restockDrafts, activeWarehouseId, goHome]);

  const handleViewProduct = useCallback(() => {
    if (onViewProduct && savedItem) onViewProduct(savedItem);
    else if (onSuccess) onSuccess();
    else if (onClose) onClose();
  }, [onViewProduct, savedItem, onSuccess, onClose]);

  const handleStartSelling = useCallback(() => {
    if (onSuccess) onSuccess();
    router.push('/sale-form');
  }, [onSuccess, router]);

  const cancel = useCallback(() => {
    if (onClose) onClose();
    else if (router.canGoBack()) router.back();
  }, [onClose, router]);

  // -- header ---------------------------------------------------------------
  const headerTitle = done
    ? (mode === 'restock' ? t('common.success') : t('inventory.new_product'))
    : mode === 'restock'
      ? t('form.restock_item')
      : t('inventory.header');

  // -- render helpers ---------------------------------------------------------
  const renderDrafts = () => (
    <>
      {createDrafts.showDrafts && !done && (
        <View style={{ gap: 10 }}>
          <DraftSection
            drafts={createDrafts.drafts}
            onRestore={restoreCreateDraft}
            onDelete={async (id: string) => { await createDrafts.remove(id); }}
          />
        </View>
      )}
      {restockDrafts.showDrafts && !done && (
        <View style={{ gap: 10 }}>
          <DraftSection
            drafts={restockDrafts.drafts}
            onRestore={restoreRestockDraft}
            onDelete={async (id: string) => { await restockDrafts.remove(id); }}
          />
        </View>
      )}
    </>
  );

  const renderStepIndicator = () => (
    <View style={styles.stepOuter}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.fgSecondary }} numberOfLines={1}>
          {t('wizard.identify')} → {t('wizard.initial_stock')}
        </AppText>
        <AppText variant="micro" weight="bold" style={{ color: colors.primary }} numberOfLines={1}>
          {t('wizard.step_of', { step: String(Math.min(step, 5)), total: '5' })}
        </AppText>
      </View>
      <View style={styles.stepLine}>
        <View style={[styles.stepProgress, { backgroundColor: colors.primary, width: `${(Math.min(step, 5) / 5) * 100}%` }]} />
      </View>
      <View style={styles.stepLabels}>
        {STEP_LABELS.map((label, i) => {
          const activeIndex = Math.min(step, 5);
          const active = i + 1 <= activeIndex;
          return (
            <View key={label} style={styles.stepLabelItem}>
              <View style={[styles.stepDot, { backgroundColor: active ? colors.primary : G.border }]} />
              <AppText variant="micro" weight="bold" shrink={false} numberOfLines={1}
                style={[styles.stepLabelText, { color: active ? G.fg : G.fgSecondary }, i === 4 && { marginRight: 0 }]}>
                {t(`wizard.${label}`)}
              </AppText>
            </View>
          );
        })}
      </View>
    </View>
  );

  const renderReviewChip = () => (
    <View style={[styles.reviewChip, { backgroundColor: colors.primary + '18' }]}>
      <Check size={16} color={colors.primary} />
      <AppText variant="caption" weight="bold" transform="uppercase" style={{ color: colors.primary, flex: 1 }} numberOfLines={1}>
        {t('wizard.review')}
      </AppText>
      <AppText variant="caption" weight="bold" style={{ color: colors.primary }} numberOfLines={1}>
        {mode === 'restock' ? '· ' + t('form.restock_item') : '· ' + (itemName || '—')}
      </AppText>
    </View>
  );

  const input = (editable: boolean, extra: any[] = []): any => [
    styles.input,
    { color: editable ? G.fg : G.fgSecondary, borderColor: G.border },
    !editable && { backgroundColor: G.mutedLight + '55' },
    ...extra,
  ];

  const categoryLabel = showCategoryPicker
    ? t('form.new_category')
    : selectedCategory
      ? `${selectedCategory.icon || ''} ${selectedCategory.name}`
      : t('form.select_category') || 'Select category (optional)';

  // ===========================================================================
  //  IDENTIFY
  // ===========================================================================
  const renderIdentify = () => (
    <View key="identify">
      {renderDrafts()}
      {searching ? (
        <View style={styles.formCard}>
          <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.cardTitle, { color: G.fgSecondary }]} numberOfLines={1}>
            {t('wizard.search_existing')}
          </AppText>
          <View style={styles.input}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Search size={18} color={G.fgSecondary} />
              <TextInput
                style={{ flex: 1, marginLeft: 10, fontSize: 15, fontFamily: Fonts.medium, color: G.fg }}
                placeholder={t('inv.search_items_ph')}
                placeholderTextColor={G.fgSecondary}
                autoFocus
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                  <X size={16} color={G.fgSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
          <View style={{ paddingBottom: 8, gap: 8 }}>
            {filteredItems.length === 0 && (
              <View style={{ alignItems: 'center', marginTop: 30 }}>
                <Package size={40} color={G.border} />
                <AppText variant="body" weight="medium" style={{ color: G.fgSecondary, marginTop: 10 }} numberOfLines={2}>
                  {t('inv.no_items_found')}
                </AppText>
              </View>
            )}
            {filteredItems.map((item: any) => (
              <TouchableOpacity
                key={String(item.id)}
                style={[styles.modeCard, { backgroundColor: G.bgCard, borderColor: G.border }]}
                onPress={() => handleScannedFound(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.modeIcon, { backgroundColor: colors.primary + '15', width: 44, height: 44, borderRadius: 12, overflow: 'hidden' }]}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                  ) : (
                    <Package size={20} color={colors.primary} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="body" weight="bold" style={{ color: G.fg }} numberOfLines={1}>{item.name}</AppText>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <AppNumber value={item.baseSellingPrice} prefix={t('common.etb') + ' '} size="caption" />
                    <AppText variant="caption" weight="medium" style={{ color: G.fgSecondary }} numberOfLines={1}> / {item.baseUnit || 'pcs'}</AppText>
                    {item.categoryName ? <AppText variant="caption" weight="medium" style={{ color: G.fgSecondary }} numberOfLines={1}> • {item.categoryName}</AppText> : null}
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <AppNumber value={item.totalBaseQuantity} fallback="0" size="caption" />
                  <AppText variant="caption" weight="bold" style={{ color: G.fgSecondary }} numberOfLines={1}> {item.baseUnit || 'pcs'}</AppText>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          {/* SCAN BARCODE */}
          <TouchableOpacity
            style={[styles.modeCard, { backgroundColor: G.bgCard, borderColor: colors.primary + '44', minHeight: 96 }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowScanner(true); }}
            activeOpacity={0.7}
          >
            <View style={[styles.modeIcon, { backgroundColor: colors.primary + '15' }]}>
              <Barcode size={28} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="heading" weight="bold" style={{ color: G.fg }} numberOfLines={1}>{t('inventory.scan_barcode')}</AppText>
              <AppText variant="body-sm" weight="medium" style={{ color: G.fgSecondary, marginTop: 4 }} numberOfLines={2}>{t('inventory.scan_barcode_desc')}</AppText>
            </View>
            <ArrowRight size={20} color={G.fgSecondary} />
          </TouchableOpacity>

          {/* SEARCH EXISTING */}
          <TouchableOpacity
            style={[styles.modeCard, { backgroundColor: G.bgCard, borderColor: G.border, minHeight: 96, opacity: canAdjustStock ? 1 : 0.55 }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSearching(true); }}
            activeOpacity={0.7}
            disabled={!canAdjustStock}
          >
            <View style={[styles.modeIcon, { backgroundColor: (canAdjustStock ? colors.warning : G.fgSecondary) + '15' }]}>
              {canAdjustStock ? <Search size={28} color={colors.warning} /> : <Lock size={22} color={G.fgSecondary} />}
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="heading" weight="bold" style={{ color: G.fg }} numberOfLines={1}>{t('wizard.search_existing')}</AppText>
              <AppText variant="body-sm" weight="medium" style={{ color: G.fgSecondary, marginTop: 4 }} numberOfLines={2}>
                {canAdjustStock ? t('form.restock_item_desc') : (t('inventory.no_stock_permission') || 'You do not have permission to adjust stock.')}
              </AppText>
            </View>
            <ArrowRight size={20} color={G.fgSecondary} />
          </TouchableOpacity>

          {/* CREATE NEW */}
          <TouchableOpacity
            style={[styles.modeCard, { backgroundColor: G.bgCard, borderColor: G.border, minHeight: 96, opacity: canManageCatalog || canAdjustStock ? 1 : 0.55 }]}
            onPress={startCreate}
            activeOpacity={0.7}
            disabled={!canManageCatalog && !canAdjustStock}
          >
            <View style={[styles.modeIcon, { backgroundColor: ((canManageCatalog || canAdjustStock) ? colors.success : G.fgSecondary) + '15' }]}>
              {(canManageCatalog || canAdjustStock) ? <Package size={28} color={colors.success} /> : <Lock size={22} color={G.fgSecondary} />}
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="heading" weight="bold" style={{ color: G.fg }} numberOfLines={1}>{t('wizard.create_new')}</AppText>
              <AppText variant="body-sm" weight="medium" style={{ color: G.fgSecondary, marginTop: 4 }} numberOfLines={2}>
                {(canManageCatalog || canAdjustStock) ? t('form.add_new_item_desc') : (t('inventory.no_catalog_permission') || 'You do not have permission to create products.')}
              </AppText>
            </View>
            <ArrowRight size={20} color={G.fgSecondary} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // ===========================================================================
  //  STEP 2 · PRODUCT INFORMATION
  // ===========================================================================
  const renderInfo = () => (
    <Animated.View entering={FadeInDown} key="info" style={styles.formCard}>
      <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.cardTitle, { color: G.fgSecondary }]} numberOfLines={1}>
        {t('wizard.product_info')}
      </AppText>

      <View style={styles.inputNode}>
          <View style={styles.nodeHeader}>
            <Tag size={14} color={G.fgSecondary} />
            <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('form.official_name')}</AppText>
            <AppText variant="micro" weight="medium" shrink={false} style={{ fontSize: 10, color: G.fgSecondary, marginLeft: 'auto' }} numberOfLines={1}>{itemName.length}/60</AppText>
          </View>
          <TextInput
            style={[styles.input, { color: G.fg, borderColor: errors.itemName ? colors.error : G.border }]}
            placeholder={t('form.name_placeholder') || 'e.g. Biscuit 50g'}
            placeholderTextColor={G.fgSecondary}
            value={itemName}
            onChangeText={(val) => { if (val.length <= 60) { setItemName(val); if (errors.itemName) setErrors((p) => ({ ...p, itemName: '' })); } }}
            maxLength={60}
          />
          {errors.itemName && <AppText variant="caption" weight="medium" style={[styles.errorText, { color: colors.error }]} numberOfLines={2}>{errors.itemName}</AppText>}
        </View>

      <View style={styles.inputNode}>
        <View style={styles.nodeHeader}>
          <LayoutGrid size={14} color={G.fgSecondary} />
          <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('form.intel_category')}</AppText>
        </View>
        <TouchableOpacity
          style={[styles.input, styles.selectable, { borderColor: errors.category ? colors.error : G.border }]}
          onPress={() => { Haptics.selectionAsync(); setShowCategoryPicker((p) => !p); }}
          activeOpacity={0.7}
        >
          <AppText variant="body" weight="medium" style={{ color: selectedCategory || showCategoryPicker ? G.fg : G.fgSecondary }} numberOfLines={1}>
            {categoryLabel}
          </AppText>
          <ChevronDown size={18} color={G.fgSecondary} />
        </TouchableOpacity>
        {showCategoryPicker && (
          <Animated.View entering={FadeInDown} style={[styles.catPicker, { borderColor: G.border, backgroundColor: G.bgCard }]}>
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ maxHeight: 180 }}>
              {categories.map((c: any) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.catRowIn}
                  onPress={() => { Haptics.selectionAsync(); setSelectedCategory(c); setShowCategoryPicker(false); }}
                  activeOpacity={0.7}
                >
                  <AppText variant="body" weight="medium" style={{ color: G.fg }} numberOfLines={1}>{c.icon} {c.name}</AppText>
                  {selectedCategory?.id === c.id && <Check size={16} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={[styles.newCatRow, { borderTopColor: G.border }]}>
              <TextInput
                style={[styles.input, { height: 46, color: G.fg, borderColor: G.border }]}
                placeholder={t('form.new_category') || 'New category name...'}
                placeholderTextColor={G.fgSecondary}
                value={newCategory}
                onChangeText={setNewCategory}
                maxLength={40}
              />
              {newCategory.trim().length > 0 && (
                <TouchableOpacity
                  style={[styles.chipActive, { backgroundColor: colors.primary }]}
                  onPress={async () => { const id = await createNewCategory(); if (id) { setShowCategoryPicker(false); } }}
                  activeOpacity={0.8}
                >
                  <Plus size={14} color="#fff" />
                  <AppText variant="body-sm" weight="bold" style={{ color: '#fff' }} numberOfLines={1}>{t('common.save')}</AppText>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        )}
      </View>

      <View style={styles.inputNode}>
          <View style={styles.nodeHeader}>
            <Building2 size={14} color={G.fgSecondary} />
            <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('form.brand')}</AppText>
            <AppText variant="micro" weight="medium" shrink={false} style={{ color: G.fgSecondary, marginLeft: 'auto' }} numberOfLines={1}>{companyName.length}/50</AppText>
          </View>
          <TextInput
            style={[styles.input, { color: G.fg, borderColor: G.border }]}
            placeholder={t('form.manufacturer_placeholder')}
            placeholderTextColor={G.fgSecondary}
            value={companyName}
            onChangeText={(val) => { if (val.length <= 50) setCompanyName(val); }}
            maxLength={50}
          />
        </View>

      <View style={styles.inputNode}>
          <View style={styles.nodeHeader}>
            <Package size={14} color={G.fgSecondary} />
            <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('form.base_unit')}</AppText>
          </View>
          <TextInput
            style={[styles.input, { color: G.fg, borderColor: G.border }]}
            value={baseUnit}
            onChangeText={setBaseUnit}
            placeholder={t('form.base_unit')}
            placeholderTextColor={G.fgSecondary}
            maxLength={12}
          />
        </View>

    </Animated.View>
  );

  // ===========================================================================
  //  STEP 3 · PHOTO & BARCODE
  // ===========================================================================
  const renderPhotoBarcode = () => (
    <Animated.View entering={FadeInDown} key="photo" style={styles.formCard}>
      <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.cardTitle, { color: G.fgSecondary }]} numberOfLines={1}>
        {t('wizard.photo_barcode')}
      </AppText>

      {/* Photos (up to 5 images) */}
      <ProductImageGallery
        images={productImages}
        primaryIndex={primaryImageIdx}
        isEditing={true}
        onImagesChange={(imgs, pIdx) => {
          setProductImages(imgs);
          setPrimaryImageIdx(pIdx);
        }}
        colors={{
          primary: colors.primary,
          border: G.border,
          card: G.bgCard,
          text: G.fg,
          textSecondary: G.fgSecondary,
          warning: colors.warning,
        }}
      />

      {/* Barcode */}
      <View style={styles.inputNode}>
        <View style={styles.nodeHeader}>
          <Barcode size={14} color={G.fgSecondary} />
          <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('wizard.barcode')}</AppText>
        </View>
        <View style={styles.chipRow}>
          <TouchableOpacity
            onPress={() => { Haptics.selectionAsync(); setBarcodeMode('external'); }}
            style={[styles.chip, { backgroundColor: barcodeMode === 'external' ? colors.primary : G.bgCard, borderColor: barcodeMode === 'external' ? colors.primary : G.border }]}
            activeOpacity={0.8}
          >
            <AppText variant="body-sm" weight="bold" shrink={false} style={{ color: barcodeMode === 'external' ? '#fff' : G.fgSecondary }} numberOfLines={1}>{t('inventory.yes_scan')}</AppText>
          </TouchableOpacity>
          {!priceLocked && (
            <TouchableOpacity
              onPress={() => { Haptics.selectionAsync(); setBarcodeMode('shega'); }}
              style={[styles.chip, { backgroundColor: barcodeMode === 'shega' ? colors.primary : G.bgCard, borderColor: barcodeMode === 'shega' ? colors.primary : G.border }]}
              activeOpacity={0.8}
            >
              <AppText variant="body-sm" weight="bold" shrink={false} style={{ color: barcodeMode === 'shega' ? '#fff' : G.fgSecondary }} numberOfLines={1}>{t('inventory.no_barcode')}</AppText>
            </TouchableOpacity>
          )}
          {priceLocked && (
            <View style={[styles.chip, { backgroundColor: G.bgCard, borderColor: G.border }]}>
              <Lock size={12} color={G.fgSecondary} style={{ marginRight: 4 }} />
              <AppText variant="body-sm" weight="bold" shrink={false} style={{ color: G.fgSecondary }} numberOfLines={1}>{t('wizard.barcode')}</AppText>
            </View>
          )}
        </View>

        {barcodeMode === 'external' && (
          <Animated.View entering={FadeInDown} style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={[styles.input, { flex: 1, flexDirection: 'row', alignItems: 'center' }]}>
                <Barcode size={16} color={G.fgSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={{ flex: 1, fontSize: 15, fontFamily: Fonts.medium, color: G.fg }}
                  placeholder={t('barcode.placeholder')}
                  placeholderTextColor={G.fgSecondary}
                  value={barcodeInput}
                  onChangeText={setBarcodeInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <TouchableOpacity
                style={[styles.photoBtn, { backgroundColor: G.fg, paddingHorizontal: 16 }]}
                onPress={() => setShowScanner(true)}
                activeOpacity={0.85}
              >
                <Camera size={16} color={G.bg} style={{ marginRight: 6 }} />
                <AppText variant="body-sm" weight="bold" style={{ color: G.bg }} numberOfLines={1}>{t('common.scan')}</AppText>
              </TouchableOpacity>
            </View>
            {barcodeInput && (
              <View style={[styles.infoBox, { borderColor: colors.primary + '44', backgroundColor: colors.primary + '10' }]}>
                <Check size={16} color={colors.success} />
                <AppText variant="body" weight="bold" style={[styles.infoText, { color: G.fg }]} numberOfLines={1}>{barcodeInput}</AppText>
              </View>
            )}
          </Animated.View>
        )}

        {barcodeMode === 'shega' && (
          <Animated.View entering={FadeInDown}>
            <View style={[styles.infoBox, { borderColor: G.border, backgroundColor: G.bgCard }]}>
              <ShieldCheck size={16} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <AppText variant="body" weight="bold" style={{ color: G.fg }} numberOfLines={1}>{generatedCode}</AppText>
                <AppText variant="micro" weight="medium" style={{ color: G.fgSecondary }} numberOfLines={2}>
                  {t('inventory.shega_barcode_hint')}
                </AppText>
              </View>
            </View>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );

  // ===========================================================================
  //  PRICING INTELLIGENCE HELPERS
  // ===========================================================================
  const etb = (v?: number | null) => `${t('common.etb')} ${fmtMoney(v)}`;

  const renderCalcRow = (label: string, value: string, opts?: { color?: string; strong?: boolean }) => (
    <View style={styles.summaryRow}>
      <AppText variant="caption" weight="medium" style={[styles.summaryLabel, { color: G.fgSecondary }]} numberOfLines={1}>{label}</AppText>
      <AppText variant={opts?.strong ? 'body-sm' : 'caption'} weight={opts?.strong ? 'bold' : 'medium'} style={{ color: opts?.color || G.fg, flexShrink: 1 }} numberOfLines={1}>{value}</AppText>
    </View>
  );

  // Real-time tax-aware profit summary (profit/unit, margin, markup) plus an
  // expandable arithmetic breakdown and non-blocking low-profit warnings.
  const renderProfitPanel = (opts: { cost: number; price: number; unitLabel: string }) => {
    const metrics = profitMetrics(opts.cost, opts.price, taxType, taxTreatment);
    const lowProfit = opts.price > 0 && opts.cost > 0 && isFinite(metrics.margin) && metrics.margin > 0 && metrics.margin < 10;
    const belowCost = opts.price > 0 && metrics.grossProfit < 0;
    const profitColor = metrics.grossProfit > 0 ? colors.success : metrics.grossProfit < 0 ? colors.error : G.fgSecondary;
    return (
      <View style={[styles.financeSummary, { backgroundColor: G.bgCard, borderColor: G.border }]}>
        <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('pricing.price_summary')}</AppText>
        <View style={styles.summaryRow}>
          <AppText variant="caption" weight="medium" style={[styles.summaryLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('pricing.purchase_price')}</AppText>
          <AppText variant="caption" weight="medium" style={{ color: G.fg }} numberOfLines={1}>{etb(opts.cost)}</AppText>
        </View>
        <View style={styles.summaryRow}>
          <AppText variant="caption" weight="medium" style={[styles.summaryLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('pricing.selling_price')}</AppText>
          <AppText variant="caption" weight="medium" style={{ color: G.fg }} numberOfLines={1}>{etb(opts.price)}</AppText>
        </View>
        <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: G.border, paddingTop: 6 }]}>
          <AppText variant="caption" weight="medium" style={[styles.summaryLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('form.profit_per', { unit: opts.unitLabel })}</AppText>
          <AppText variant="body-sm" weight="bold" style={{ color: profitColor }} numberOfLines={1}>{etb(metrics.grossProfit)}</AppText>
        </View>
        <View style={styles.summaryRow}>
          <AppText variant="caption" weight="medium" style={[styles.summaryLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('pricing.margin')}</AppText>
          <AppText variant="body-sm" weight="bold" style={{ color: metrics.grossProfit < 0 ? colors.error : G.fg }} numberOfLines={1}>{fmtPercent(metrics.margin)}</AppText>
        </View>
        <View style={styles.summaryRow}>
          <AppText variant="caption" weight="medium" style={[styles.summaryLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('pricing.markup')}</AppText>
          <AppText variant="body-sm" weight="bold" style={{ color: G.fg }} numberOfLines={1}>{fmtPercent(metrics.markup)}</AppText>
        </View>
        {lowProfit && (
          <View style={styles.warningRow}>
            <AlertCircle size={14} color={colors.warning} />
            <AppText variant="caption" weight="bold" style={[styles.warningText, { color: colors.warning }]} numberOfLines={2}>{t('pricing.low_profit')}</AppText>
          </View>
        )}
        {belowCost && (
          <TouchableOpacity onPress={() => sellInputRef.current?.focus()} style={[styles.warningRow, { justifyContent: 'space-between' }]} activeOpacity={0.8}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <AlertCircle size={14} color={colors.error} />
              <AppText variant="caption" weight="bold" style={[styles.warningText, { color: colors.error }]} numberOfLines={2}>{t('pricing.selling_below_cost')}</AppText>
            </View>
            <AppText variant="caption" weight="bold" style={{ color: colors.error }} numberOfLines={1}>{t('pricing.review_price')}</AppText>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => setShowPricingCalc((v) => !v)} style={styles.summaryRow} activeOpacity={0.7}>
          <AppText variant="caption" weight="bold" style={{ color: G.fgSecondary }} numberOfLines={1}>{t(showPricingCalc ? 'pricing.hide_calculation' : 'pricing.view_calculation')}</AppText>
          {showPricingCalc ? <ChevronUp size={14} color={G.fgSecondary} /> : <ChevronDown size={14} color={G.fgSecondary} />}
        </TouchableOpacity>
        {showPricingCalc && (
          <View style={{ borderTopWidth: 1, borderTopColor: G.border, paddingTop: 4 }}>
            {renderCalcRow(t('pricing.calc_profit'), `${fmtMoney(metrics.netRevenue)} − ${fmtMoney(opts.cost)} = ${fmtMoney(metrics.grossProfit)} ${t('common.etb')}`)}
            {renderCalcRow(t('pricing.calc_margin'), `${fmtMoney(metrics.grossProfit)} ÷ ${fmtMoney(metrics.netRevenue)} × 100 = ${fmtPercent(metrics.margin)}`)}
            {renderCalcRow(t('pricing.calc_markup'), `${fmtMoney(metrics.grossProfit)} ÷ ${fmtMoney(opts.cost)} × 100 = ${fmtPercent(metrics.markup)}`)}
            {renderCalcRow(t('pricing.net_sales_value'), etb(metrics.netRevenue))}
            {renderCalcRow(t('pricing.tax_amount'), etb(metrics.tax))}
          </View>
        )}
      </View>
    );
  };

  const costFields: { key: 'costTransport' | 'costImport' | 'costPackaging' | 'costHandling' | 'costOther'; label: string }[] = [
    { key: 'costTransport', label: t('pricing.transport_cost') },
    { key: 'costImport', label: t('pricing.import_cost') },
    { key: 'costPackaging', label: t('pricing.packaging_cost') },
    { key: 'costHandling', label: t('pricing.handling_cost') },
    { key: 'costOther', label: t('pricing.other_cost') },
  ];

  const applySuggestedPrice = (value?: number) => {
    const p = value ?? suggested;
    if (p === null) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setBaseSellingPrice(p.toFixed(2));
    if (mode === 'restock') setUnitSellingPrice(p.toFixed(2));
    if (errors.sellingPrice) setErrors((p) => ({ ...p, sellingPrice: '' }));
  };

  // Potential profit if this many units sell at the current price (step 5).
  const renderPotentialProfit = (qty: number, cost: number, price: number, unitLabel: string) => {
    if (qty <= 0 || price <= 0) return null;
    const f = stockForecast(cost, price, qty, taxType, taxTreatment);
    if (!f) return null;
    const color = f.totalProfit > 0 ? colors.success : f.totalProfit < 0 ? colors.error : G.fgSecondary;
    return (
      <View style={[styles.financeSummary, { backgroundColor: colors.primary + '0a', borderColor: colors.primary + '33' }]}>
        <View style={[styles.blockHeader, styles.nodeHeader]}>
          <TrendingUp size={16} color={colors.primary} />
          <AppText variant="body-sm" weight="bold" style={{ color: G.fg }} numberOfLines={1}>{t('pricing.potential_profit')}</AppText>
        </View>
        {renderCalcRow(t('pricing.quantity'), `${qty} ${unitLabel}`)}
        {renderCalcRow(t('pricing.inventory_cost'), etb(f.cost))}
        {renderCalcRow(t('pricing.potential_revenue'), etb(f.netRevenue))}
        {renderCalcRow(t('pricing.stock_profit'), etb(f.totalProfit), { strong: true, color })}
      </View>
    );
  };

  // ===========================================================================
  //  STEP 4 · PRICING & TAX
  // ===========================================================================
  const renderPricing = () => (
      <Animated.View entering={FadeInDown} key="pricing" style={styles.formCard}>
        <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.cardTitle, { color: G.fgSecondary }]} numberOfLines={1}>
          {t('wizard.pricing_tax')}
        </AppText>

      {priceLocked && !isReadOnly && (
        <View style={[styles.lockedBanner, { backgroundColor: colors.warning + '14', borderColor: colors.warning + '44' }]}>
          <Lock size={16} color={colors.warning} />
          <AppText variant="caption" weight="medium" style={{ color: G.fgSecondary, flex: 1, lineHeight: 16 }} numberOfLines={3}>
            {t('inventory.no_catalog_permission') || 'Prices & tax are set by the store owner or manager. You can still record stock.'}
          </AppText>
        </View>
      )}

      <View style={styles.row}>
        <View style={{ flex: 1, marginRight: 15 }}>
          <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary, marginBottom: 8 }]} numberOfLines={2}>
            {t('form.unit_cost')}
          </AppText>
          <TextInput
            style={input(!priceLocked, [styles.priceInput])}
            placeholder="0.00"
            placeholderTextColor={G.fgSecondary}
            editable={!priceLocked}
            value={basePurchasePrice}
            onChangeText={setBasePurchasePrice}
            keyboardType="numeric"
          />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary, marginBottom: 8 }]} numberOfLines={1}>{t('form.unit_selling_price')}</AppText>
          <TextInput
            ref={sellInputRef}
            style={input(!priceLocked, [styles.priceInput, { borderColor: errors.sellingPrice ? colors.error : G.border }])}
            placeholder="0.00"
            placeholderTextColor={G.fgSecondary}
            editable={!priceLocked}
            value={baseSellingPrice}
            onChangeText={(val) => { setBaseSellingPrice(val); if (errors.sellingPrice) setErrors((p) => ({ ...p, sellingPrice: '' })); }}
            keyboardType="numeric"
          />
        </View>
      </View>
      {errors.sellingPrice && (
        <AppText variant="caption" weight="medium" style={[styles.errorText, { color: colors.error, marginTop: 8 }]} numberOfLines={2}>{errors.sellingPrice}</AppText>
      )}

      {!priceLocked && renderProfitPanel({ cost: effectiveCost, price: retailPrice, unitLabel: baseUnit })}

      {taxType !== 'None' && retailPrice > 0 && (
        <View style={[styles.financeSummary, { backgroundColor: G.bgCard, borderColor: G.border }]}>
          {renderCalcRow(t('pricing.selling_price_incl_tax'), etb(taxSplit.gross))}
          {renderCalcRow(taxType === 'VAT' ? 'sale.tax.vat' : taxType === 'TOT' ? 'sale.tax.tot' : 'sale.tax.other', etb(taxSplit.tax))}
          {renderCalcRow(t('pricing.net_sales_value'), etb(taxSplit.net))}
        </View>
      )}

      {!priceLocked && (
        <View style={[styles.financeSummary, { backgroundColor: G.bgCard, borderColor: G.border }]}>
          <TouchableOpacity onPress={() => setShowPricingAdvanced((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }} activeOpacity={0.7}>
            <AppText variant="body-sm" weight="bold" style={{ color: G.fg }} numberOfLines={1}>{t('pricing.advanced')}</AppText>
            {showPricingAdvanced ? <ChevronUp size={16} color={G.fgSecondary} /> : <ChevronDown size={16} color={G.fgSecondary} />}
          </TouchableOpacity>

          {showPricingAdvanced && (
            <View style={{ marginTop: 6 }}>
              {/* Target margin + suggested price */}
              <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary, marginBottom: 6, marginTop: 6 }]} numberOfLines={1}>{t('pricing.target_margin')}</AppText>
              <TextInput
                style={input(true, [styles.priceInput])}
                placeholder="15%"
                placeholderTextColor={G.fgSecondary}
                keyboardType="numeric"
                value={targetMargin}
                onChangeText={setTargetMargin}
              />
              {suggested !== null && (
                <View style={styles.summaryRow}>
                  <AppText variant="caption" weight="medium" style={[styles.summaryLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('pricing.suggested_price')}</AppText>
                  <AppText variant="body-sm" weight="bold" style={{ color: G.fg }} numberOfLines={1}>{etb(suggested)}</AppText>
                </View>
              )}
              {suggested !== null && (
                <TouchableOpacity
                  onPress={() => applySuggestedPrice()}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: 12, backgroundColor: colors.primary, marginTop: 8 }}
                  activeOpacity={0.85}
                >
                  <TrendingUp size={15} color="#fff" />
                  <AppText variant="body-sm" weight="bold" style={{ color: '#fff' }} numberOfLines={1}>{t('pricing.use_suggested_price')}</AppText>
                </TouchableOpacity>
              )}
              {Number(targetMargin) > 0 && (
                <View style={styles.summaryRow}>
                  {retailPrice > 0 ? (
                    <>
                      <AppText variant="caption" weight="medium" style={[styles.summaryLabel, { color: G.fgSecondary }]} numberOfLines={1}>
                        {targetReached ? t('pricing.target_achieved') : t('pricing.below_target')}
                      </AppText>
                      <AppText variant="caption" weight="bold" style={{ color: targetReached ? colors.success : colors.warning }} numberOfLines={1}>
                        {t('form.intel_margin')} {fmtPercent(baseMetrics.margin)} / {Number(targetMargin)}%
                      </AppText>
                    </>
                  ) : (
                    <AppText variant="caption" weight="medium" style={{ color: G.fgSecondary, flex: 1 }} numberOfLines={2}>{t('pricing.calculate_suggested')}</AppText>
                  )}
                </View>
              )}

              {/* Additional costs -> effective cost & contribution profit */}
              <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: G.border, paddingTop: 10 }}>
                <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary, marginBottom: 8 }]} numberOfLines={1}>{t('pricing.additional_costs')}</AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {costFields.map((cf) => (
                    <View key={cf.key} style={{ width: '47%', gap: 6 }}>
                      <AppText variant="caption" weight="medium" style={{ color: G.fgSecondary }} numberOfLines={1}>{cf.label}</AppText>
                      <TextInput
                        style={input(true, [styles.priceInput])}
                        placeholder="0.00"
                        placeholderTextColor={G.fgSecondary}
                        keyboardType="numeric"
                        value={
                          cf.key === 'costTransport' ? costTransport :
                          cf.key === 'costImport' ? costImport :
                          cf.key === 'costPackaging' ? costPackaging :
                          cf.key === 'costHandling' ? costHandling : costOther
                        }
                        onChangeText={(v) => {
                          const setter = cf.key === 'costTransport' ? setCostTransport : cf.key === 'costImport' ? setCostImport : cf.key === 'costPackaging' ? setCostPackaging : cf.key === 'costHandling' ? setCostHandling : setCostOther;
                          setter(v);
                        }}
                      />
                    </View>
                  ))}
                </View>
                {effectiveCost > 0 && (
                  <View style={{ marginTop: 6 }}>
                    {renderCalcRow(t('pricing.effective_cost'), etb(effectiveCost))}
                    {retailPrice > 0 && renderCalcRow(t('pricing.contribution_profit'), etb(baseMetrics.grossProfit), { strong: true, color: baseMetrics.grossProfit > 0 ? colors.success : baseMetrics.grossProfit < 0 ? colors.error : G.fgSecondary })}
                  </View>
                )}
              </View>

              {/* Wholesale / retail pricing */}
              <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: G.border, paddingTop: 10 }}>
                <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary, marginBottom: 8 }]} numberOfLines={1}>{t('pricing.wholesale_pricing')}</AppText>
                <View style={styles.row}>
                  <View style={{ flex: 1, marginRight: 15, gap: 6 }}>
                    <AppText variant="caption" weight="medium" style={{ color: G.fgSecondary }} numberOfLines={1}>{t('pricing.wholesale_price')}</AppText>
                    <TextInput style={input(true, [styles.priceInput])} placeholder="0.00" placeholderTextColor={G.fgSecondary} keyboardType="numeric" value={wholesalePrice} onChangeText={setWholesalePrice} />
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    <AppText variant="caption" weight="medium" style={{ color: G.fgSecondary }} numberOfLines={1}>{t('pricing.min_wholesale_qty')}</AppText>
                    <TextInput style={input(true, [styles.priceInput])} placeholder="10" placeholderTextColor={G.fgSecondary} keyboardType="numeric" value={minWholesaleQty} onChangeText={setMinWholesaleQty} />
                  </View>
                </View>
                {wholesaleMetrics && (
                  <View style={{ marginTop: 4 }}>
                    {renderCalcRow(t('pricing.wholesale_profit'), etb(wholesaleMetrics.grossProfit), { strong: true, color: wholesaleMetrics.grossProfit > 0 ? colors.success : colors.error })}
                    <View style={styles.summaryRow}>
                      <AppText variant="caption" weight="medium" style={[styles.summaryLabel, { color: G.fgSecondary }]} numberOfLines={1}>
                        {t('pricing.retail')}: {fmtPercent(baseMetrics.margin)}
                      </AppText>
                      <AppText variant="caption" weight="bold" style={{ color: G.fg }} numberOfLines={1}>
                        {t('pricing.wholesale')}: {fmtPercent(wholesaleMetrics.margin)}
                      </AppText>
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      )}
      </Animated.View>
  );

  // ===========================================================================
  //  STEP 5 · INITIAL STOCK / ADD STOCK
  // ===========================================================================
  const renderStock = () => (
    <Animated.View entering={FadeInDown} key="stock">
      {/* Restock summary banner (existing product) */}
      {mode === 'restock' && restockItem && (
        <View style={[styles.foundCard, { backgroundColor: colors.success + '14', borderColor: colors.success + '44' }]}>
          <View style={[styles.modeIcon, { backgroundColor: colors.success + '18' }]}>
            <Check size={22} color={colors.success} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: colors.success }} numberOfLines={1}>{t('wizard.product_found')}</AppText>
            <AppText variant="body" weight="bold" style={{ color: G.fg, marginTop: 2 }} numberOfLines={1}>{restockItem.name}</AppText>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <AppText variant="caption" weight="medium" style={{ color: G.fgSecondary }} numberOfLines={1}>Stock: </AppText>
              <AppNumber value={restockItem.totalBaseQuantity} fallback="0" size="caption" />
              <AppText variant="caption" weight="medium" style={{ color: G.fgSecondary }} numberOfLines={1}> {restockItem.baseUnit || 'pcs'}</AppText>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => { setErrors({}); setRestockItem(null); setMode(null); setStep(2); }}
            style={styles.closeBtn}
            activeOpacity={0.7}
          >
            <X size={18} color={G.fg} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.formCard}>
        <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.cardTitle, { color: G.fgSecondary }]} numberOfLines={1}>
          {mode === 'restock' ? t('form.initial_stock', { unit: restockItem?.baseUnit || 'pcs' }) : t('wizard.initial_stock')}
        </AppText>

        {(mode === 'restock' || !priceLocked) && (
          <View style={styles.inputNode}>
            <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary, marginBottom: 8 }]} numberOfLines={2}>
              {t('form.unit_cost')}
            </AppText>
            <TextInput
              style={input(true, [styles.priceInput, { borderColor: G.border }])}
              placeholder="0.00"
              placeholderTextColor={G.fgSecondary}
              value={(mode === 'restock' ? buyingPrice : basePurchasePrice)}
              onChangeText={mode === 'restock' ? setBuyingPrice : setBasePurchasePrice}
              keyboardType="numeric"
            />
          </View>
        )}

        <View style={styles.inputNode}>
          <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary, marginBottom: 8 }]} numberOfLines={2}>
            {mode === 'restock'
              ? t('form.initial_stock', { unit: restockItem?.baseUnit || 'pcs' })
              : t('form.initial_stock', { unit: baseUnit })}
          </AppText>
          <TextInput
            style={[styles.input, { color: G.fg, borderColor: errors.quantity ? colors.error : G.border, fontFamily: Fonts.bold, fontSize: 18 }]}
            value={mode === 'restock' ? restockQty : stockQty}
            onChangeText={mode === 'restock' ? setRestockQty : setStockQty}
            keyboardType="numeric"
          />
          {errors.quantity && <AppText variant="caption" weight="medium" style={[styles.errorText, { color: colors.error }]} numberOfLines={2}>{errors.quantity}</AppText>}
        </View>

        {renderPotentialProfit(
          mode === 'restock' ? (Number(restockQty) || 0) : (Number(stockQty) || 0),
          mode === 'restock' ? (Number(buyingPrice) || restockItem?.basePurchasePrice || 0) : effectiveCost,
          mode === 'restock' ? (Number(unitSellingPrice) || restockItem?.baseSellingPrice || 0) : retailPrice,
          mode === 'restock' ? (restockItem?.baseUnit || 'pcs') : baseUnit
        )}

        {/* Advanced pricing for restock: edit selling price + price-change impact + history */}
        {mode === 'restock' && (
          <View style={[styles.financeSummary, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <TouchableOpacity
              onPress={() => setShowPricingAdvanced((v) => !v)}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              activeOpacity={0.7}
            >
              <AppText variant="body-sm" weight="bold" style={{ color: G.fg }} numberOfLines={1}>{t('pricing.price_change_impact')}</AppText>
              {showPricingAdvanced ? <ChevronUp size={16} color={G.fgSecondary} /> : <ChevronDown size={16} color={G.fgSecondary} />}
            </TouchableOpacity>

            {showPricingAdvanced && (() => {
              const costNow = Number(buyingPrice) || restockItem?.basePurchasePrice || 0;
              const oldCost = Number(restockItem?.basePurchasePrice) || 0;
              const oldP = Number(restockItem?.baseSellingPrice) || 0;
              const newP = Number(unitSellingPrice) || 0;
              const oldM = profitMetrics(oldCost, oldP || newP, taxType, taxTreatment);
              const newM = profitMetrics(costNow, newP || oldP, taxType, taxTreatment);
              const restockSug = Number(targetMargin) > 0 ? suggestedSellingPrice(costNow, Number(targetMargin), taxType, taxTreatment) : null;
              const sellChanged = oldP > 0 && newP > 0 && Math.abs(newP - oldP) > 0.001;
              const costIncreased = !priceLocked && costNow > oldCost + 0.001;
              const marginDropped = oldP > 0 && (newP > 0 || oldP > 0) && isFinite(oldM.margin) && isFinite(newM.margin) && newM.margin < oldM.margin - 0.05;
              const costDrivenMarginDrop = costIncreased && newP === oldP && marginDropped;
              const extraProfit = sellChanged ? newM.grossProfit - oldM.grossProfit : 0;
              return (
                <View style={{ marginTop: 6 }}>
                  {!priceLocked && (
                    <>
                      <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary, marginBottom: 6, marginTop: 6 }]} numberOfLines={1}>{t('form.unit_selling_price')}</AppText>
                      <TextInput
                        style={input(true, [styles.priceInput])}
                        placeholder={String(restockItem?.baseSellingPrice || '')}
                        placeholderTextColor={G.fgSecondary}
                        keyboardType="numeric"
                        value={unitSellingPrice}
                        onChangeText={setUnitSellingPrice}
                      />
                      <AppText variant="caption" weight="medium" style={{ color: G.fgSecondary, marginTop: 6 }} numberOfLines={2}>
                        {t('pricing.review_price')}
                      </AppText>
                    </>
                  )}
                  {renderCalcRow(t('pricing.previous_selling'), etb(oldP))}
                  {renderCalcRow(t('pricing.current_selling'), etb(newM.price))}
                  {costIncreased && renderCalcRow(t('pricing.previous_margin'), fmtPercent(oldM.margin))}
                  {renderCalcRow(t('pricing.current_margin'), fmtPercent(newM.margin), { strong: true, color: newM.margin < 0 ? colors.error : marginDropped ? colors.warning : G.fg })}
                  {sellChanged && extraProfit !== 0 && renderCalcRow(
                    t('pricing.extra_profit'),
                    `${extraProfit > 0 ? '+' : ''}${fmtMoney(extraProfit)} ${t('common.etb')} / unit`,
                    { strong: true, color: extraProfit > 0 ? colors.success : colors.error }
                  )}
                  {marginDropped && (
                    <View style={styles.warningRow}>
                      <AlertCircle size={14} color={colors.warning} />
                      {costDrivenMarginDrop ? (
                        <AppText variant="caption" weight="bold" style={[styles.warningText, { color: colors.warning }]} numberOfLines={3}>
                          {t('pricing.cost_increased', { oldC: etb(oldCost), newC: etb(costNow), oldM: fmtPercent(oldM.margin), newM: fmtPercent(newM.margin) })}
                        </AppText>
                      ) : (
                        <AppText variant="caption" weight="bold" style={[styles.warningText, { color: colors.warning }]} numberOfLines={3}>{t('pricing.margin_decreased')}</AppText>
                      )}
                    </View>
                  )}
                  {!priceLocked && (
                    <>
                      <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary, marginBottom: 6, marginTop: 8 }]} numberOfLines={1}>{t('pricing.target_margin')}</AppText>
                      <TextInput
                        style={input(true, [styles.priceInput])}
                        placeholder="15%"
                        placeholderTextColor={G.fgSecondary}
                        keyboardType="numeric"
                        value={targetMargin}
                        onChangeText={setTargetMargin}
                      />
                      {restockSug !== null && (
                        <TouchableOpacity
                          onPress={() => applySuggestedPrice(restockSug)}
                          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: 12, backgroundColor: colors.primary, marginTop: 8 }}
                          activeOpacity={0.85}
                        >
                          <TrendingUp size={15} color="#fff" />
                          <AppText variant="body-sm" weight="bold" style={{ color: '#fff' }} numberOfLines={1}>{t('pricing.suggested_price')} {etb(restockSug)} · {t('pricing.use_suggested_price')}</AppText>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                  {priceHistory.length > 0 && (
                    <>
                      <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary, marginBottom: 6, marginTop: 10 }]} numberOfLines={1}>{t('pricing.price_history')}</AppText>
                      {priceHistory.slice(0, 6).map((h: any) => {
                        const fieldLabel = h.field === 'selling' ? t('pricing.selling') : h.field === 'purchase' ? t('pricing.purchase') : h.field === 'wholesale' ? t('pricing.wholesale') : h.field;
                        const dateStr = h.createdAt ? String(h.createdAt).slice(0, 10) : '';
                        return (
                          <View key={h.id} style={styles.summaryRow}>
                            <AppText variant="caption" weight="medium" style={[styles.summaryLabel, { color: G.fgSecondary }]} numberOfLines={1}>
                              {fieldLabel} {dateStr}
                            </AppText>
                            <AppText variant="caption" weight="medium" style={{ color: G.fg, flexShrink: 1 }} numberOfLines={1}>
                              {etb(h.oldValue)} → {etb(h.newValue)}
                            </AppText>
                          </View>
                        );
                      })}
                    </>
                  )}
                </View>
              );
            })()}
          </View>
        )}

        {/* Warehouse */}
        {featureFlags.warehousesEnabled && (
        <TouchableOpacity
          style={[styles.intelligenceBlock, { backgroundColor: G.bgCard, borderColor: G.border, flexDirection: 'row', alignItems: 'center' }]}
          onPress={() => setShowWarehouseModal(true)}
          activeOpacity={0.7}
        >
          <Building2 size={20} color={colors.primary} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <AppText variant="body" weight="bold" style={[styles.blockTitle, { color: G.fg }]} numberOfLines={1}>{t('common.warehouse') || 'Warehouse'}</AppText>
            <AppText variant="body-sm" weight="medium" style={[styles.blockSub, { color: G.fgSecondary }]} numberOfLines={1}>
              {warehouses.find((w: any) => w.id === warehouseId)?.name || t('common.warehouse') || 'Select warehouse'}
            </AppText>
          </View>
          <ChevronDown size={18} color={G.fgSecondary} />
        </TouchableOpacity>
        )}

        {/* Supplier */}
          <TouchableOpacity
            style={[
              styles.intelligenceBlock,
              { backgroundColor: G.bgCard, borderColor: errors.supplier ? colors.error : G.border, flexDirection: 'row', alignItems: 'center' },
            ]}
            onPress={() => { setShowSupplierModal(true); if (errors.supplier) setErrors((p) => ({ ...p, supplier: '' })); }}
            activeOpacity={0.7}
          >
            <Truck size={20} color={colors.primary} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <AppText variant="body" weight="bold" style={[styles.blockTitle, { color: G.fg }]} numberOfLines={1}>{t('form.supplier_label')}</AppText>
              <AppText variant="body-sm" weight="medium" style={[styles.blockSub, { color: G.fgSecondary }]} numberOfLines={2}>
                {selectedSupplier ? selectedSupplier.fullName : t('form.tap_select_supplier')}
              </AppText>
              {selectedSupplier && (supplierCallEnabled || creditToggle === 'Yes') && selectedSupplier.phone && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 }}>
                  <Phone size={12} color={colors.primary} />
                  <AppText variant="caption" weight="medium" shrink={false} style={{ color: colors.primary }} numberOfLines={1}>{selectedSupplier.phone}</AppText>
                </View>
              )}
            </View>
            {selectedSupplier?.phone && supplierCallEnabled ? (
              <TouchableOpacity
                onPress={callSupplier}
                style={styles.callBtn}
                activeOpacity={0.8}
              >
                <PhoneCall size={16} color={colors.primary} />
              </TouchableOpacity>
            ) : (
              <ChevronDown size={18} color={G.fgSecondary} />
            )}
          </TouchableOpacity>
          {errors.supplier && (
            <AppText variant="caption" weight="medium" style={[styles.errorText, { color: colors.error, marginTop: 6 }]} numberOfLines={2}>{errors.supplier}</AppText>
          )}

        {!supplierCallEnabled && creditToggle !== 'Yes' && (
          <View style={styles.supplierChips}>
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSupplierCallEnabled(true); }}
              style={[styles.chip, styles.supplierChip, { borderColor: G.border, backgroundColor: G.bgCard }]}
              activeOpacity={0.8}
            >
              <PhoneCall size={13} color={G.fgSecondary} style={{ marginRight: 6 }} />
              <AppText variant="body-sm" weight="bold" style={{ color: G.fgSecondary }} numberOfLines={1}>{t('form.supplier_call_title')}</AppText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCreditToggle('Yes'); }}
              style={[styles.chip, styles.supplierChip, { borderColor: G.border, backgroundColor: G.bgCard }]}
              activeOpacity={0.8}
            >
              <CreditCard size={13} color={G.fgSecondary} style={{ marginRight: 6 }} />
              <AppText variant="body-sm" weight="bold" style={{ color: G.fgSecondary }} numberOfLines={1}>{t('form.supplier_credit')}</AppText>
            </TouchableOpacity>
          </View>
        )}

        {(supplierCallEnabled || creditToggle === 'Yes') && selectedSupplier && (
          <View style={[styles.supplierDetails, { borderColor: G.border, backgroundColor: G.bgCard }]}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary, marginBottom: 6 }]} numberOfLines={1}>Phone</AppText>
                <TextInput
                  style={[styles.input, { height: 46, color: G.fg, borderColor: G.border }]}
                  value={supplierPhone}
                  onChangeText={setSupplierPhone}
                  placeholder={selectedSupplier?.phone || t('form.phone_placeholder')}
                  placeholderTextColor={G.fgSecondary}
                  keyboardType="phone-pad"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary, marginBottom: 6 }]} numberOfLines={1}>Account</AppText>
                <TextInput
                  style={[styles.input, { height: 46, color: G.fg, borderColor: G.border }]}
                  value={supplierAccount}
                  onChangeText={setSupplierAccount}
                  placeholder={t('form.account_placeholder')}
                  placeholderTextColor={G.fgSecondary}
                />
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                <PhoneCall size={14} color={G.fgSecondary} style={{ marginRight: 6 }} />
                <AppText variant="caption" weight="medium" style={{ color: G.fgSecondary }} numberOfLines={1}>{t('form.supplier_call_title')}</AppText>
              </View>
              <TouchableOpacity
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSupplierCallEnabled(!supplierCallEnabled); }}
                style={[styles.switch, { backgroundColor: supplierCallEnabled ? G.fg : G.border }]}
              >
                <View style={[styles.switchThumb, { backgroundColor: G.bg, left: supplierCallEnabled ? 24 : 2 }]} />
              </TouchableOpacity>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
                <CreditCard size={14} color={G.fgSecondary} style={{ marginRight: 6 }} />
                <AppText variant="caption" weight="medium" style={{ color: G.fgSecondary }} numberOfLines={1}>{t('form.supplier_credit')}</AppText>
              </View>
              <TouchableOpacity
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCreditToggle(creditToggle === 'Yes' ? 'No' : 'Yes'); }}
                style={[styles.switch, { backgroundColor: creditToggle === 'Yes' ? G.fg : G.border, marginLeft: 10 }]}
              >
                <View style={[styles.switchThumb, { backgroundColor: G.bg, left: creditToggle === 'Yes' ? 24 : 2 }]} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Batch + Expiry */}
        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary, marginBottom: 8 }]} numberOfLines={1}>{t('wizard.batch_number')}</AppText>
            <View style={[styles.input, { flexDirection: 'row', alignItems: 'center' }]}>
              <Tag size={15} color={G.fgSecondary} style={{ marginRight: 8 }} />
              <TextInput
                style={{ flex: 1, fontSize: 15, fontFamily: Fonts.medium, color: G.fg }}
                value={batchNumber}
                onChangeText={setBatchNumber}
                placeholder="B-2401"
                placeholderTextColor={G.fgSecondary}
              />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary, marginBottom: 8 }]} numberOfLines={1}>{t('form.expiration_archive')}</AppText>
              <TouchableOpacity
                style={[styles.input, { flexDirection: 'row', alignItems: 'center' }]}
                onPress={() => setShowExpiryPicker(true)}
                activeOpacity={0.7}
              >
                <Calendar size={15} color={G.fgSecondary} style={{ marginRight: 8 }} />
                <AppText variant="body" weight="medium" style={{ color: expiryDate ? G.fg : G.fgSecondary, flex: 1 }} numberOfLines={1}>
                  {expiryDate ? formatDate(new Date(expiryDate), calendarType, language) : t('form.select_date')}
                </AppText>
                <ChevronDown size={16} color={G.fgSecondary} />
              </TouchableOpacity>
          </View>
        </View>

        {/* Quality grade */}
        <View style={styles.inputNode}>
          <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary, marginBottom: 10 }]} numberOfLines={1}>
            {t('form.quality_classification')}
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {QUALITY_GRADES.map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.chip, { backgroundColor: qualityGrade === g ? colors.primary : G.bgCard, borderColor: qualityGrade === g ? colors.primary : G.border }]}
                onPress={() => { Haptics.selectionAsync(); setQualityGrade(g); }}
                activeOpacity={0.8}
              >
                <AppText variant="body-sm" weight="bold" shrink={false} style={{ color: qualityGrade === g ? '#fff' : G.fgSecondary }} numberOfLines={1}>{t(`form.${g}`)}</AppText>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Animated.View>
  );

  // ===========================================================================
  //  STEP 6 · REVIEW & SAVE
  // ===========================================================================
  const costDisplay = mode === 'restock'
    ? (Number(buyingPrice) || restockItem?.basePurchasePrice || 0)
    : baseCost;

  const renderReviewItem = (label: string, value: string, highlight = false) => (
    <View style={styles.summaryRow}>
      <AppText variant="caption" weight="medium" style={[styles.summaryLabel, { color: G.fgSecondary, flex: 1 }]} numberOfLines={2}>{label}</AppText>
      <AppText variant="body-sm" weight={highlight ? 'bold' : 'medium'} style={[styles.summaryValue, { color: highlight ? colors.primary : G.fg }]} numberOfLines={2}>{value}</AppText>
    </View>
  );

  const renderReview = () => (
    <Animated.View entering={FadeInDown} key="review">
      {mode === 'restock' ? (
        <View style={styles.formCard}>
          <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.cardTitle, { color: G.fgSecondary }]} numberOfLines={1}>{t('wizard.review')}</AppText>
          <View style={styles.financeSummary}>
            {renderReviewItem('Product', restockItem?.name || '', true)}
            {renderReviewItem(t('form.initial_stock', { unit: 'qty' }), `${restockQty} ${restockItem?.baseUnit || 'pcs'}`)}
            {renderReviewItem(t('form.unit_cost'), `${t('common.etb')} ${Number(buyingPrice) || restockItem?.basePurchasePrice || 0}`)}
            {!priceLocked && renderReviewItem(t('form.unit_selling_price'), `${t('common.etb')} ${Number(unitSellingPrice) || restockItem?.baseSellingPrice || 0}`)}
            {renderReviewItem(t('form.supplier_label'), selectedSupplier?.fullName || '—')}
            {renderReviewItem(t('form.supplier_credit'), creditToggle === 'Yes' ? 'Unpaid' : 'Paid')}
            {renderReviewItem(t('wizard.batch_number'), batchNumber || '—')}
            {renderReviewItem(t('form.expiration_archive'), expiryDate ? formatDate(new Date(expiryDate), calendarType, language) : '—')}
            {renderReviewItem('Warehouse', warehouses.find((w: any) => w.id === warehouseId)?.name || '—')}
          </View>
        </View>
      ) : (
        <View style={styles.formCard}>
          <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.cardTitle, { color: G.fgSecondary }]} numberOfLines={1}>{t('wizard.review')}</AppText>

          <View style={[styles.reviewProductRow, { borderColor: G.border }]}>
            {image ? (
              <Image source={{ uri: image }} style={styles.reviewThumb} contentFit="cover" />
            ) : (
              <View style={[styles.reviewThumb, { backgroundColor: G.bgCard, justifyContent: 'center', alignItems: 'center' }]}>
                <Package size={22} color={G.fgSecondary} />
              </View>
            )}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <AppText variant="heading" weight="bold" style={{ color: G.fg }} numberOfLines={2}>{itemName || '—'}</AppText>
              <AppText variant="caption" weight="medium" style={{ color: G.fgSecondary }} numberOfLines={1}>
                {selectedCategory?.name || ''}{selectedCategory?.name && companyName ? ' • ' : ''}{companyName}
              </AppText>
            </View>
            {canManageCatalog && !priceLocked && (
              <AppText variant="body" weight="bold" style={{ color: colors.primary }} numberOfLines={1}>
                {t('common.etb')} {Number(baseSellingPrice) || 0}
              </AppText>
            )}
          </View>

          <View style={styles.financeSummary}>
            {renderReviewItem(t('wizard.barcode'), finalBarcode || '—')}
            {renderReviewItem(t('form.sku'), finalSku || '—')}
            {renderReviewItem(t('form.unit_cost'), `${t('common.etb')} ${costDisplay.toFixed(2)}`)}
            {renderReviewItem(t('form.unit_selling_price'), `${t('common.etb')} ${Number(baseSellingPrice) || 0}`)}
            {renderReviewItem(t('sale.tax_type'), taxType)}
            {renderReviewItem(t('wizard.initial_stock'), `${stockBaseQty} ${baseUnit}`)}
            {renderReviewItem(t('form.supplier_label'), selectedSupplier?.fullName || '—')}
            {renderReviewItem(t('wizard.batch_number'), batchNumber || '—')}
            {renderReviewItem(t('form.expiration_archive'), expiryDate ? formatDate(new Date(expiryDate), calendarType, language) : '—')}
            {renderReviewItem('Warehouse', warehouses.find((w: any) => w.id === warehouseId)?.name || '—')}
          </View>
        </View>
      )}
    </Animated.View>
  );

  // ===========================================================================
  //  SUCCESS
  // ===========================================================================
  const renderSuccess = () => (
    <View style={styles.successWrap}>
      <View style={[styles.successIconCircle, { backgroundColor: colors.success }]}>
        <Check size={44} color={G.bg} />
      </View>
      <AppText variant="display" weight="bold" style={[styles.successTitle, { color: G.fg }]} numberOfLines={2}>{t('common.success')}</AppText>
      <AppText variant="body" weight="medium" align="center" style={[styles.successSub, { color: G.fgSecondary }]} numberOfLines={3}>
        {mode === 'restock'
          ? t('inventory.restock_success', { name: savedItem?.name || '' })
          : t('inventory.add_success', { name: itemName || '' }) || `'${itemName}' was added to inventory.`}
      </AppText>

      <View style={{ width: '100%', gap: 12, marginTop: 8 }}>
        <TouchableOpacity
          style={[styles.successBtn, { backgroundColor: colors.primary }]}
          onPress={handleStartSelling}
          activeOpacity={0.85}
        >
          <AppText variant="body" weight="bold" style={{ color: '#fff' }} numberOfLines={1}>{t('wizard.start_selling')}</AppText>
          <ArrowRight size={18} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.successBtn, { backgroundColor: G.bgCard, borderWidth: 1, borderColor: G.border }]}
          onPress={handleViewProduct}
          activeOpacity={0.85}
        >
          <Package size={18} color={G.fg} style={{ marginRight: 8 }} />
          <AppText variant="body" weight="bold" style={{ color: G.fg }} numberOfLines={1}>{t('wizard.view_product')}</AppText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.successBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: G.border }]}
          onPress={handleAddAnother}
          activeOpacity={0.85}
        >
          <Plus size={18} color={G.fgSecondary} style={{ marginRight: 8 }} />
          <AppText variant="body" weight="bold" style={{ color: G.fgSecondary }} numberOfLines={1}>{t('wizard.add_another')}</AppText>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ===========================================================================
  //  MAIN RENDER
  // ===========================================================================
  const activeStep = mode === 'restock' ? (restockItem ? Math.min(step, 6) : 1) : Math.min(step, 6);
  const showIndicator = !done && activeStep <= 5;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: G.bg }]}>
      <View style={[styles.glowWash1, { backgroundColor: G.mutedLight }]} />
      <View style={[styles.glowWash2, { backgroundColor: G.mutedLight }]} />
      <View style={[styles.glowWash3, { backgroundColor: G.mutedLight }]} />

      <View style={styles.header}>
          <TouchableOpacity onPress={done ? handleAddAnother : cancel} style={[styles.closeBtn, { borderColor: G.border }]}>
            {done ? <RefreshCw size={18} color={G.fg} /> : <X size={20} color={G.fg} />}
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <AppText variant="display" weight="bold" style={[styles.headerTitle, { color: G.fg }]} numberOfLines={1}>{headerTitle}</AppText>
            <AppText variant="body-sm" weight="medium" style={{ color: G.fgSecondary, marginTop: 2 }} numberOfLines={1}>
              {done
                ? (mode === 'restock' ? (savedItem?.name || '') : (itemName || ''))
                : mode === 'restock'
                  ? (restockItem?.name || t('form.restock_item_desc'))
                  : (t('inventory.add_what'))}
            </AppText>
          </View>
          {done && <View style={{ width: 40 }} />}
        </View>

      {showIndicator ? renderStepIndicator() : (!done && activeStep === 6 && renderReviewChip())}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {done ? (
            renderSuccess()
          ) : (
            <Animated.View entering={FadeInDown} key={`${mode}-${activeStep}`} style={styles.stepContent}>
              {mode === 'restock' && restockItem && activeStep >= 5 ? (
                <>
                  {activeStep === 5 && renderStock()}
                  {activeStep === 6 && renderReview()}
                </>
              ) : mode === 'restock' ? (
                renderIdentify()
              ) : mode === 'create' ? (
                <>
                  {activeStep === 2 && renderInfo()}
                  {activeStep === 3 && renderPhotoBarcode()}
                  {activeStep === 4 && renderPricing()}
                  {activeStep === 5 && renderStock()}
                  {activeStep === 6 && renderReview()}
                </>
              ) : (
                renderIdentify()
              )}
            </Animated.View>
          )}
        </ScrollView>

        {!done && mode && (
            <View style={styles.actionDock}>
              <TouchableOpacity style={[styles.backBtn, { borderColor: G.border }]} onPress={handleBack} activeOpacity={0.8}>
                <ChevronLeft size={20} color={G.fg} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.nextBtn, { backgroundColor: G.fg, flex: 1 }]}
                onPress={activeStep === 6 ? (mode === 'restock' ? handleSaveRestock : handleSaveCreate) : handleNext}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <AppText variant="body" weight="bold" shrink={false} style={[styles.nextBtnText, { color: G.bg }]} numberOfLines={1}>{t('common.saving')}</AppText>
                ) : (
                  <>
                    <AppText variant="body" weight="bold" shrink={false} style={[styles.nextBtnText, { color: G.bg }]} numberOfLines={1}>
                      {activeStep === 6 ? t('form.initialize_asset') : t('form.continue_intake')}
                    </AppText>
                    {activeStep === 6 ? <Check size={18} color={G.bg} /> : <ArrowRight size={18} color={G.bg} />}
                  </>
                )}
              </TouchableOpacity>
            </View>
        )}
      </KeyboardAvoidingView>

      {/* Scanner (identify + external barcode attach) */}
      <InventoryScannerSheet
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onFound={(item: any, code: string) => {
          if (mode === 'create') { handleScannedForBarcode(code); return; }
          handleScannedFound(item);
        }}
        onSearchExisting={() => { setShowScanner(false); setSearching(true); }}
        onRegister={handleScannedMiss}
      />

      {/* Warehouse picker */}
      <Modal visible={showWarehouseModal} transparent animationType="slide" onRequestClose={() => setShowWarehouseModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowWarehouseModal(false)}>
          <Pressable style={[styles.categorySheet, { backgroundColor: G.bg }]}>
            <View style={styles.modalHandleRow}>
              <View style={[styles.modalHandle, { backgroundColor: G.border }]} />
            </View>
            <View style={[styles.modalHeader, { paddingHorizontal: 20 }]}>
              <AppText variant="title" weight="bold" style={[styles.modalTitle, { color: G.fg }]} numberOfLines={1}>{t('common.warehouse') || 'Warehouse'}</AppText>
              <TouchableOpacity onPress={() => setShowWarehouseModal(false)} activeOpacity={0.7}>
                <X size={24} color={G.fg} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.catScroll}>
              {warehouses.length === 0 && (
                <View style={{ padding: 30, alignItems: 'center' }}>
                  <AppText variant="body" weight="medium" align="center" style={{ color: G.fgSecondary }} numberOfLines={2}>{t('common.no_warehouses') || 'No warehouses yet'}</AppText>
                </View>
              )}
              {warehouses.map((w: any) => (
                <TouchableOpacity
                  key={w.id}
                  style={[styles.catItem, { borderColor: G.border }]}
                  onPress={() => { setWarehouseId(w.id); setShowWarehouseModal(false); Haptics.selectionAsync(); }}
                  activeOpacity={0.7}
                >
                  <Building2 size={20} color={colors.primary} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <AppText variant="body" weight="bold" style={[styles.catName, { color: G.fg }]} numberOfLines={1}>{w.name}</AppText>
                  </View>
                  {warehouseId === w.id && <Check size={18} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Supplier picker */}
      <Modal visible={showSupplierModal} transparent animationType="slide" onRequestClose={() => setShowSupplierModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowSupplierModal(false)}>
          <Pressable style={[styles.categorySheet, { backgroundColor: G.bg }]}>
            <View style={styles.modalHandleRow}>
              <View style={[styles.modalHandle, { backgroundColor: G.border }]} />
            </View>
            <View style={[styles.modalHeader, { paddingHorizontal: 20 }]}>
              <View style={{ flex: 1 }}>
                <AppText variant="title" weight="bold" style={[styles.modalTitle, { color: G.fg }]} numberOfLines={1}>{t('inv.select_supplier')}</AppText>
              </View>
              <TouchableOpacity onPress={() => setShowSupplierModal(false)} activeOpacity={0.7}>
                <X size={24} color={G.fg} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.catScroll}>
              {suppliers.length === 0 && (
                <View style={{ padding: 30, alignItems: 'center' }}>
                  <AppText variant="body" weight="medium" align="center" style={{ color: G.fgSecondary }} numberOfLines={2}>{t('inv.no_suppliers')}</AppText>
                </View>
              )}
              {suppliers.map((sup: any) => (
                <TouchableOpacity
                  key={sup.id}
                  style={[styles.catItem, { borderColor: G.border }]}
                  onPress={() => { setSelectedSupplier(sup); setSupplierPhone(sup.phone || ''); setSupplierAccount(sup.accountNumber || ''); setShowSupplierModal(false); setErrors((p) => ({ ...p, supplier: '' })); Haptics.selectionAsync(); }}
                  activeOpacity={0.7}
                >
                  <Truck size={20} color={colors.primary} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <AppText variant="body" weight="bold" style={[styles.catName, { color: G.fg }]} numberOfLines={1}>{sup.fullName}</AppText>
                    {sup.phone && <AppText variant="caption" weight="medium" style={{ color: G.fgSecondary }} numberOfLines={1}>{sup.phone}</AppText>}
                  </View>
                  {selectedSupplier?.id === sup.id && <Check size={18} color={colors.primary} />}
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.newSupplierBtn, { borderColor: G.border, backgroundColor: G.bgCard }]}
                onPress={() => setShowNewSupplier(true)}
                activeOpacity={0.7}
              >
                <Plus size={18} color={colors.primary} />
                <AppText variant="body" weight="bold" style={{ color: colors.primary }} numberOfLines={1}>{t('form.add_supplier') || 'Add supplier'}</AppText>
              </TouchableOpacity>
              {showNewSupplier && (
                <Animated.View entering={FadeInDown} style={{ paddingHorizontal: 4, gap: 10, paddingTop: 8 }}>
                  <TextInput
                    style={[styles.input, { color: G.fg, borderColor: G.border }]}
                    placeholder={t('form.supplier_name_placeholder') || 'Supplier name'}
                    placeholderTextColor={G.fgSecondary}
                    value={newSupplierName}
                    onChangeText={setNewSupplierName}
                    maxLength={60}
                  />
                  <TextInput
                    style={[styles.input, { color: G.fg, borderColor: G.border }]}
                    placeholder={t('form.phone_placeholder')}
                    placeholderTextColor={G.fgSecondary}
                    value={newSupplierPhone}
                    onChangeText={setNewSupplierPhone}
                    keyboardType="phone-pad"
                  />
                  <TouchableOpacity
                    style={[styles.photoBtn, { backgroundColor: colors.primary }]}
                    onPress={createNewSupplier}
                    activeOpacity={0.85}
                  >
                    <Plus size={16} color="#fff" style={{ marginRight: 6 }} />
                    <AppText variant="body-sm" weight="bold" style={{ color: '#fff' }} numberOfLines={1}>{t('common.save')}</AppText>
                  </TouchableOpacity>
                </Animated.View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Expiry date */}
      <CustomDatePicker
        visible={showExpiryPicker}
        onClose={() => setShowExpiryPicker(false)}
        onSelectDate={setExpiryDate}
        initialDate={expiryDate || undefined}
        minDate={new Date().toISOString().slice(0, 10)}
      />
    </SafeAreaView>
  );
};

export default ProductWizard;

// ===========================================================================

const createStyles = (G: ReturnType<typeof getInventoryGlass>) =>
  StyleSheet.create({
    container: { flex: 1 },
    glowWash1: { position: 'absolute', top: -80, left: -60, width: 200, height: 200, borderRadius: 100, opacity: 0.6 },
    glowWash2: { position: 'absolute', top: 120, right: -80, width: 220, height: 220, borderRadius: 110, opacity: 0.5 },
    glowWash3: { position: 'absolute', bottom: -60, left: 40, width: 180, height: 180, borderRadius: 90, opacity: 0.5 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 10,
      gap: 12,
    },
    closeBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      borderWidth: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: { fontSize: 24 },
    stepOuter: { paddingHorizontal: 20, marginTop: 4, marginBottom: 10 },
    stepLine: { height: 4, borderRadius: 2, backgroundColor: G.border, overflow: 'hidden' },
    stepProgress: { height: 4, borderRadius: 2 },
    stepLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 2 },
    stepLabelItem: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
    stepDot: { width: 6, height: 6, borderRadius: 3 },
    stepLabelText: { fontSize: 9 },
    reviewChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 20,
      marginBottom: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 120,
      gap: 14,
      paddingTop: 4,
    },
    stepContent: { gap: 14 },
    formCard: {
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor: G.border,
      backgroundColor: G.bg,
      gap: 14,
    },
    cardTitle: { letterSpacing: 1, marginBottom: 2 },
    inputNode: { gap: 8 },
    nodeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    nodeLabel: { letterSpacing: 0.8, fontFamily: Fonts.semibold },
    input: {
      height: 52,
      borderRadius: 14,
      borderWidth: 1,
      paddingHorizontal: 14,
      fontSize: 15,
      fontFamily: Fonts.medium,
      justifyContent: 'center',
    },
    selectable: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    priceInput: { fontFamily: Fonts.bold },
    errorText: { marginTop: 2, fontSize: 12, lineHeight: 16 },
    row: { flexDirection: 'row', alignItems: 'center' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
    },
    chipActive: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
    intelligenceBlock: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 14,
    },
    blockHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    blockTitle: { fontFamily: Fonts.semibold },
    blockSub: { marginTop: 2, lineHeight: 16 },
    switch: { width: 46, height: 26, borderRadius: 13, justifyContent: 'center', paddingHorizontal: 2 },
    switchThumb: { width: 22, height: 22, borderRadius: 11 },
    modeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 18,
      borderWidth: 1,
      padding: 16,
      gap: 14,
    },
    modeIcon: {
      width: 52,
      height: 52,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 12 },
    photoPlaceholder: { width: 72, height: 72, borderRadius: 14, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    photoPreviewWrap: { width: 72, height: 72, borderRadius: 14, overflow: 'hidden' },
    photoPreview: { width: 72, height: 72 },
    photoRemove: { position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    photoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 40, borderRadius: 12, paddingHorizontal: 12 },
    infoBox: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
    infoText: { fontFamily: Fonts.semibold, letterSpacing: 0.5, flex: 1 },
    lockedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
    financeSummary: {
      borderRadius: 14,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 8,
      gap: 8,
    },
    summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
    summaryLabel: { fontFamily: Fonts.medium },
    summaryValue: { fontFamily: Fonts.semibold, textAlign: 'right' },
    warningRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 },
    warningText: { fontSize: 12, flex: 1 },
    catPicker: { borderRadius: 14, borderWidth: 1, padding: 8, gap: 8 },
    catRowIn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 12 },
    newCatRow: { borderTopWidth: 1, paddingTop: 10, gap: 8 },
    supplierChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    supplierChip: { paddingVertical: 8 },
    supplierDetails: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 4 },
    callBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: G.primary + '20', justifyContent: 'center', alignItems: 'center' },
    foundCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: 1, padding: 14 },
    actionDock: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 16,
    },
    backBtn: {
      width: 54,
      height: 54,
      borderRadius: 16,
      borderWidth: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    nextBtn: {
      height: 54,
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    nextBtnText: { fontFamily: Fonts.bold },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    categorySheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 30, maxHeight: '75%' },
    modalHandleRow: { alignItems: 'center', paddingTop: 10, paddingBottom: 10 },
    modalHandle: { width: 44, height: 5, borderRadius: 3 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    modalTitle: { fontFamily: Fonts.bold, flex: 1 },
    catScroll: { paddingHorizontal: 20, gap: 8, paddingBottom: 20 },
    catItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1 },
    catName: { fontFamily: Fonts.semibold },
    newSupplierBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1, marginTop: 4 },
    reviewProductRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 12 },
    reviewThumb: { width: 56, height: 56, borderRadius: 12 },
    successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 40, gap: 12 },
    successIconCircle: { width: 88, height: 88, borderRadius: 44, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
    successTitle: { fontSize: 28 },
    successSub: { marginTop: 4 },
    successBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 56, borderRadius: 16, width: '100%' },
  });