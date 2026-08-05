import { CustomDatePicker } from '@/components/CustomDatePicker';
import { formatDate } from '@/utils/date-utils';
import { DraftSection } from '@/components/DraftSection';
import { AppNumber, AppText } from '@/components/ui';
import { Fonts } from '@/constants/theme';
import { useDialog } from '@/context/DialogContext';
import { useSettings } from '@/context/SettingsContext';
import { useWarehouse } from '@/context/WarehouseContext';
import {
  getItems,
  getSuppliers,
  getUserCategories,
  insertCategory,
  insertContact,
  insertItem,
  insertPack,
  insertPacksBatch,
  updateItem
} from '@/database/db';
import { useFormDrafts } from '@/hooks/useFormDrafts';
import { Draft } from '@/services/draftService';
import { playBad, playNice } from '@/services/soundService';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  CreditCard,
  LayoutGrid,
  Package,
  Phone,
  PhoneCall,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Truck,
  X
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
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
import Animated, {
  FadeInDown
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getInventoryGlass } from './glass-inventory';
import { useTutorial, useTutorialExample, TutorialTarget, TutorialButton, TutorialScrollView } from '@/tutorials';
import { inventoryFormTutorial } from '@/tutorials/definitions';
const QUALITY_GRADES = ['grade1', 'grade2', 'grade3'];

export const AddAssetFlow = ({ onSuccess, onClose }: { onSuccess?: () => void, onClose?: () => void }) => {
  const { colors, t } = useSettings();
  const G = getInventoryGlass(colors);
  const styles = useMemo(() => createStyles(G), [G]);
  const router = useRouter();
  const [mode, setMode] = useState<'add' | 'restock' | null>(null);

  if (!mode) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: G.bg }]}>
        {/* Ambient glow washes */}
        <View style={[styles.glowWash1, { backgroundColor: G.mutedLight }]} />
        <View style={[styles.glowWash2, { backgroundColor: G.mutedLight }]} />
        <View style={[styles.glowWash3, { backgroundColor: G.mutedLight }]} />
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (onClose) onClose();
              else if (router.canGoBack()) router.back();
            }}
            style={[styles.closeBtn, { borderColor: G.border }]}
          >
            <X size={20} color={G.fg} />
          </TouchableOpacity>
          <AppText variant="display" weight="bold" style={[styles.headerTitle, { color: G.fg }]} numberOfLines={2}>{t('inventory.header')}</AppText>
          <View style={{ width: 40 }} />
        </View>

        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 25, gap: 16 }}>
          <TouchableOpacity
            style={[styles.modeCard, { backgroundColor: G.bgCard, borderColor: G.border }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMode('add'); }}
            activeOpacity={0.7}
          >
            <View style={[styles.modeIcon, { backgroundColor: colors.primary + '15' }]}>
              <Plus size={28} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="heading" weight="bold" style={{ color: G.fg }} numberOfLines={1}>{t('form.add_new_item')}</AppText>
              <AppText variant="body-sm" weight="medium" style={{ color: G.fgSecondary, marginTop: 4 }} numberOfLines={2}>{t('form.add_new_item_desc')}</AppText>
            </View>
            <ArrowRight size={20} color={G.fgSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeCard, { backgroundColor: G.bgCard, borderColor: G.border }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMode('restock'); }}
            activeOpacity={0.7}
          >
            <View style={[styles.modeIcon, { backgroundColor: colors.warning + '15' }]}>
              <RefreshCw size={28} color={colors.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="heading" weight="bold" style={{ color: G.fg }} numberOfLines={1}>{t('form.restock_item')}</AppText>
              <AppText variant="body-sm" weight="medium" style={{ color: G.fgSecondary, marginTop: 4 }} numberOfLines={2}>{t('form.restock_item_desc')}</AppText>
            </View>
            <ArrowRight size={20} color={G.fgSecondary} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (mode === 'restock') {
    return <RestockFlow onSuccess={onSuccess} onClose={() => setMode(null)} />;
  }

  return <AddItemFlow onSuccess={onSuccess} onClose={onClose} />;
};

const RestockFlow = ({ onSuccess, onClose }: { onSuccess?: () => void, onClose?: () => void }) => {
  const { colors, t } = useSettings();
  const G = getInventoryGlass(colors);
  const styles = useMemo(() => createStyles(G), [G]);
  const dialog = useDialog();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [allItems, setAllItems] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const [buyingPrice, setBuyingPrice] = useState('');
  const [unitSellingPrice, setUnitSellingPrice] = useState('');
  const [bulkSellingPrice, setBulkSellingPrice] = useState('');
  const [restockQty, setRestockQty] = useState('1');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierCallEnabled, setSupplierCallEnabled] = useState(false);
  const [supplierLog, setSupplierLog] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [creditToggle, setCreditToggle] = useState<'Yes' | 'No'>('No');
  
  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const draftFormKeyRestock = 'inventory-restock';
  const draftFormDataRestock = useFormDrafts({
    screen: 'inventory',
    formKey: draftFormKeyRestock,
    getPayload: useCallback(() => ({
      searchQuery,
      selectedItem,
      buyingPrice,
      unitSellingPrice,
      bulkSellingPrice,
      restockQty,
      supplierPhone,
      supplierCallEnabled,
      selectedSupplier,
      creditToggle,
    }), [searchQuery, selectedItem, buyingPrice, unitSellingPrice, bulkSellingPrice, restockQty, supplierPhone, supplierCallEnabled, selectedSupplier, creditToggle]),
    getTitle: useCallback(() => (selectedItem?.name ? t('draft.restock_title', { name: selectedItem.name }) : t('draft.restock_default')), [selectedItem, t]),
    getSubtitle: useCallback(() => t('draft.restock_subtitle', { qty: restockQty || '0' }), [restockQty, t]),
    enabled: true,
  });

  useEffect(() => {
    const items = getItems();
    setAllItems(items);
    const sups = getSuppliers();
    setSuppliers(sups);
  }, []);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return allItems;
    const q = searchQuery.toLowerCase();
    return allItems.filter((i: any) => i.name?.toLowerCase().includes(q) || i.categoryName?.toLowerCase().includes(q));
  }, [allItems, searchQuery]);

  const selectItem = (item: any) => {
    setSelectedItem(item);
    setBuyingPrice(String(item.basePurchasePrice || ''));
    setUnitSellingPrice(String(item.baseSellingPrice || ''));
    setBulkSellingPrice(String(item.packSellingPrice || ''));
    setRestockQty('1');
    setSupplierPhone(item.supplierPhone || '');
    setSupplierCallEnabled(!!item.supplierCallEnabled);
    setSupplierLog(false);
    setCreditToggle('No');
    const linked = suppliers.find((s: any) => s.id === item.supplierId);
    setSelectedSupplier(linked || null);
  };

  const handleSave = async () => {
    if (!selectedItem) return;
    const qty = parseInt(restockQty) || 0;
    if (qty <= 0) {
      await dialog.alert({ title: t('common.error'), message: t('form.error_quantity_positive'), iconType: 'danger' });
      return;
    }
    const newBaseQty = (selectedItem.totalBaseQuantity || 0) + qty * (selectedItem.unitsPerPack || 1);
    const newPackQty = (selectedItem.totalPackQuantity || 0) + qty;

    const updates: any = {
      basePurchasePrice: parseFloat(buyingPrice) || selectedItem.basePurchasePrice,
      baseSellingPrice: parseFloat(unitSellingPrice) || selectedItem.baseSellingPrice,
      packSellingPrice: parseFloat(bulkSellingPrice) || selectedItem.packSellingPrice,
      totalBaseQuantity: newBaseQty,
      totalPackQuantity: newPackQty,
      supplierCallEnabled,
    };
    if (supplierPhone.trim()) updates.supplierPhone = supplierPhone.trim();
    if (selectedSupplier) {
      updates.supplierPhone = selectedSupplier.phone || supplierPhone;
      updates.supplierAccount = selectedSupplier.accountNumber || selectedItem.supplierAccount;
      // Record the restock as a supplier purchase (movement-level fields).
      updates.supplierId = selectedSupplier.id;
      const unitPrice = parseFloat(buyingPrice) || selectedItem.basePurchasePrice || 0;
      const addedQty = qty * (selectedItem.unitsPerPack || 1);
      updates.purchaseUnitPrice = unitPrice;
      updates.purchasePaymentStatus = creditToggle === 'Yes' ? 'Unpaid' : 'Paid';
      updates.purchasePaidAmount = creditToggle === 'Yes' ? 0 : unitPrice * addedQty;
    }

    const success = updateItem(selectedItem.id, updates);
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      playNice();
      await draftFormDataRestock.clearCurrent();
      setSuccessMessage(t('inventory.restock_success', { name: selectedItem.name }));
      setShowSuccessModal(true);
    } else {
      await dialog.alert({ title: t('common.error'), message: t('inventory.failed_to_save'), iconType: 'danger' });
    }
  };

  const handleSuccessDone = () => {
    setShowSuccessModal(false);
    if (onSuccess) onSuccess();
    else if (onClose) onClose();
    else if (router.canGoBack()) router.back();
  };

  if (!selectedItem) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: G.bg }]}>
        {/* Ambient glow washes */}
        <View style={[styles.glowWash1, { backgroundColor: G.mutedLight }]} />
        <View style={[styles.glowWash2, { backgroundColor: G.mutedLight }]} />
        <View style={[styles.glowWash3, { backgroundColor: G.mutedLight }]} />
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { borderColor: G.border }]}>
            <X size={20} color={G.fg} />
          </TouchableOpacity>
          <AppText variant="display" weight="bold" style={[styles.headerTitle, { color: G.fg }]} numberOfLines={2}>{t('form.restock_item')}</AppText>
          <View style={{ width: 40 }} />
        </View>

        <View style={{ paddingHorizontal: 25, marginBottom: 10 }}>
          <View style={[styles.input, { flexDirection: 'row', alignItems: 'center', height: 50, paddingHorizontal: 15 }]}>
            <Search size={18} color={G.fgSecondary} />
            <TextInput
              style={{ flex: 1, marginLeft: 10, fontSize: 15, fontFamily: Fonts.medium, color: G.fg }}
              placeholder={t('inv.search_items_ph')}
              placeholderTextColor={G.fgSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={16} color={G.fgSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <FlatList
          data={filteredItems}
          keyExtractor={(item: any) => String(item.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 25, paddingBottom: 40 }}
          renderItem={({ item }: { item: any }) => (
            <TouchableOpacity
              style={[styles.modeCard, { backgroundColor: G.bgCard, borderColor: G.border, marginBottom: 8 }]}
              onPress={() => { Haptics.selectionAsync(); selectItem(item); }}
              activeOpacity={0.7}
            >
              <View style={[styles.modeIcon, { backgroundColor: colors.primary + '15', width: 44, height: 44, borderRadius: 12 }]}>
                <Package size={20} color={colors.primary} />
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
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Package size={48} color={G.border} />
              <AppText variant="body" weight="medium" style={{ color: G.fgSecondary, marginTop: 12 }} numberOfLines={2}>{t('inv.no_items_found')}</AppText>
            </View>
          }
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: G.bg }]}>
      {/* Ambient glow washes */}
      <View style={[styles.glowWash1, { backgroundColor: G.mutedLight }]} />
      <View style={[styles.glowWash2, { backgroundColor: G.mutedLight }]} />
      <View style={[styles.glowWash3, { backgroundColor: G.mutedLight }]} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setSelectedItem(null)} style={[styles.closeBtn, { borderColor: G.border }]}>
          <X size={20} color={G.fg} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.fgSecondary }} numberOfLines={1}>{t('form.restock_item')}</AppText>
          <AppText variant="title" weight="bold" style={{ color: G.fg, marginTop: 2 }} numberOfLines={1}>{selectedItem.name}</AppText>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <TutorialScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {draftFormDataRestock.showDrafts && (
          <DraftSection
            drafts={draftFormDataRestock.drafts}
            onRestore={async (draft: Draft) => {
              const d = draft.data;
              setSearchQuery(d.searchQuery || '');
              setBuyingPrice(d.buyingPrice || '');
              setUnitSellingPrice(d.unitSellingPrice || '');
              setBulkSellingPrice(d.bulkSellingPrice || '');
              setRestockQty(d.restockQty || '1');
              setSupplierPhone(d.supplierPhone || '');
              setSupplierCallEnabled(d.supplierCallEnabled || false);
              setCreditToggle(d.creditToggle || 'No');
              if (d.selectedItem) setSelectedItem(d.selectedItem);
              if (d.selectedSupplier) setSelectedSupplier(d.selectedSupplier);
              await draftFormDataRestock.remove(draft.id);
            }}
            onDelete={async (id: string) => {
              await draftFormDataRestock.remove(id);
            }}
          />
        )}
        <Animated.View entering={FadeInDown} style={styles.formCard}>
          {/* Prices */}
          <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.cardTitle, { color: G.fgSecondary }]} numberOfLines={1}>{t('form.financial_strategy')}</AppText>

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 15 }}>
              <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary, marginBottom: 8 }]} numberOfLines={1}>{t('form.unit_cost')}</AppText>
              <TextInput
                style={[styles.input, { color: G.fg, borderColor: G.border, fontFamily: Fonts.bold }]}
                placeholder="0.00"
                value={buyingPrice}
                onChangeText={setBuyingPrice}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary, marginBottom: 8 }]} numberOfLines={1}>{t('form.unit_selling_price')}</AppText>
              <TextInput
                style={[styles.input, { color: G.fg, borderColor: G.border, fontFamily: Fonts.bold }]}
                placeholder="0.00"
                value={unitSellingPrice}
                onChangeText={setUnitSellingPrice}
                keyboardType="numeric"
              />
            </View>
          </View>

          {selectedItem.unitsPerPack > 1 && (
            <View style={styles.inputNode}>
              <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary, marginBottom: 8 }]} numberOfLines={1}>{t('form.bulk_selling_price')}</AppText>
              <TextInput
                style={[styles.input, { color: G.fg, borderColor: G.border, fontFamily: Fonts.bold }]}
                placeholder="0.00"
                value={bulkSellingPrice}
                onChangeText={setBulkSellingPrice}
                keyboardType="numeric"
              />
            </View>
          )}

          {/* Quantity */}
          <View style={styles.inputNode}>
            <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary, marginBottom: 8 }]} numberOfLines={1}>{t('form.initial_stock', { unit: selectedItem.purchaseUnit || selectedItem.baseUnit || 'pcs' })}</AppText>
            <TextInput
              style={[styles.input, { color: G.fg, borderColor: G.border, fontFamily: Fonts.bold, fontSize: 18 }]}
              value={restockQty}
              onChangeText={setRestockQty}
              keyboardType="numeric"
            />
          </View>

          {/* Supplier */}
          <TouchableOpacity
            style={[styles.intelligenceBlock, { backgroundColor: G.bgCard, borderColor: G.border, flexDirection: 'row', alignItems: 'center' }]}
            onPress={() => { setShowSupplierModal(true); }}
          >
            <Truck size={20} color={colors.primary} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <AppText variant="body" weight="bold" style={[styles.blockTitle, { color: G.fg }]} numberOfLines={2}>{t('form.supplier_label')}</AppText>
              <AppText variant="body-sm" weight="medium" style={[styles.blockSub, { color: G.fgSecondary }]} numberOfLines={2}>
                {selectedSupplier ? selectedSupplier.fullName : t('form.tap_select_supplier')}
              </AppText>
            </View>
            <ChevronDown size={18} color={G.fgSecondary} />
          </TouchableOpacity>

          {/* Call supplier on price change */}
          <View style={[styles.intelligenceBlock, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <View style={styles.blockHeader}>
              <PhoneCall size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <AppText variant="body" weight="bold" style={[styles.blockTitle, { color: G.fg }]} numberOfLines={2}>{t('form.supplier_call_title')}</AppText>
                <AppText variant="micro" weight="medium" style={{ color: G.fgSecondary, marginTop: 2 }} numberOfLines={2}>{t('form.supplier_call_sub')}</AppText>
              </View>
              <TouchableOpacity
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSupplierCallEnabled(!supplierCallEnabled); }}
                style={[styles.switch, { backgroundColor: supplierCallEnabled ? G.fg : G.border }]}
              >
                <View style={[styles.switchThumb, { backgroundColor: G.bg, left: supplierCallEnabled ? 24 : 2 }]} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Log as supplier */}
          <View style={[styles.intelligenceBlock, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <View style={styles.blockHeader}>
              <Building2 size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <AppText variant="body" weight="bold" style={[styles.blockTitle, { color: G.fg }]} numberOfLines={2}>{t('form.log_as_supplier')}</AppText>
                <AppText variant="micro" weight="medium" style={{ color: G.fgSecondary, marginTop: 2 }} numberOfLines={2}>{t('form.log_as_supplier_desc')}</AppText>
              </View>
              <TouchableOpacity
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSupplierLog(!supplierLog); }}
                style={[styles.switch, { backgroundColor: supplierLog ? G.fg : G.border }]}
              >
                <View style={[styles.switchThumb, { backgroundColor: G.bg, left: supplierLog ? 24 : 2 }]} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Log as supplier credit */}
          <View style={[styles.intelligenceBlock, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <View style={styles.blockHeader}>
              <CreditCard size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <AppText variant="body" weight="bold" style={[styles.blockTitle, { color: G.fg }]} numberOfLines={2}>{t('form.supplier_credit')}</AppText>
                <AppText variant="micro" weight="medium" style={{ color: G.fgSecondary, marginTop: 2 }} numberOfLines={2}>{t('form.log_as_supplier_desc')}</AppText>
              </View>
              <TouchableOpacity
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCreditToggle(creditToggle === 'Yes' ? 'No' : 'Yes'); }}
                style={[styles.switch, { backgroundColor: creditToggle === 'Yes' ? G.fg : G.border }]}
              >
                <View style={[styles.switchThumb, { backgroundColor: G.bg, left: creditToggle === 'Yes' ? 24 : 2 }]} />
              </TouchableOpacity>
            </View>
          </View>

          {creditToggle === 'Yes' && selectedSupplier && (
            <Animated.View entering={FadeInDown} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 5 }}>
              <Phone size={14} color={G.fgSecondary} />
              <AppText variant="body-sm" weight="medium" style={{ color: G.fgSecondary, flex: 1 }} numberOfLines={1}>
                {selectedSupplier.phone || supplierPhone}
              </AppText>
              <CreditCard size={14} color={G.fgSecondary} />
              <AppText variant="body-sm" weight="medium" style={{ color: G.fgSecondary }} numberOfLines={1}>
                {selectedSupplier.accountNumber || selectedItem.supplierAccount}
              </AppText>
            </Animated.View>
          )}
        </Animated.View>

        {/* Save button */}
        <View style={styles.actionDock}>
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: G.fg, flex: 1 }]}
            onPress={handleSave}
          >
            <Check size={18} color={G.bg} />
            <AppText variant="body" weight="bold" shrink={false} style={[styles.nextBtnText, { color: G.bg }]} numberOfLines={1}>{t('form.initialize_asset')}</AppText>
          </TouchableOpacity>
        </View>
      </TutorialScrollView>

      {/* Supplier Modal */}
      <Modal visible={showSupplierModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowSupplierModal(false)}>
          <Pressable style={[styles.categorySheet, { backgroundColor: G.bg }]}>
            <View style={styles.modalHandleRow}>
              <View style={[styles.modalHandle, { backgroundColor: G.border }]} />
            </View>
            <View style={styles.modalHeader}>
               <AppText variant="title" weight="bold" style={[styles.modalTitle, { color: G.fg }]} numberOfLines={2}>{t('inv.select_supplier')}</AppText>
              <TouchableOpacity onPress={() => setShowSupplierModal(false)}>
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
                  onPress={() => { setSelectedSupplier(sup); setShowSupplierModal(false); Haptics.selectionAsync(); }}
                >
                  <Truck size={20} color={colors.primary} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <AppText variant="body" weight="bold" style={[styles.catName, { color: G.fg }]} numberOfLines={1}>{sup.fullName}</AppText>
                    {sup.phone && <AppText variant="caption" weight="medium" style={{ color: G.fgSecondary }} numberOfLines={1}>{sup.phone}</AppText>}
                  </View>
                  {selectedSupplier?.id === sup.id && <Check size={18} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Success Modal */}
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <Pressable style={styles.successOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowSuccessModal(false)} />
          <View style={[styles.successCard, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <View style={[styles.successIconCircle, { backgroundColor: colors.success }]}>
              <Check size={48} color={G.bg} />
            </View>
            <AppText variant="heading" weight="bold" style={[styles.successTitle, { color: G.fg }]} numberOfLines={2}>{t('common.success')}</AppText>
            <AppText variant="body" weight="medium" style={[styles.successSub, { color: G.fgSecondary }]} numberOfLines={3}>{successMessage}</AppText>
            <TouchableOpacity
              style={[styles.finishBtn, { backgroundColor: G.fg }]}
              onPress={handleSuccessDone}
            >
              <AppText variant="body" weight="bold" shrink={false} style={[styles.finishBtnText, { color: G.bg }]} numberOfLines={1}>{t('common.done')}</AppText>
              <ArrowRight size={18} color={G.bg} />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const AddItemFlow = ({ onSuccess, onClose }: { onSuccess?: () => void, onClose?: () => void }) => {
  const { colors, t, calendarType, language } = useSettings();
  const { activeWarehouseId } = useWarehouse();
  const G = getInventoryGlass(colors);
  const styles = useMemo(() => createStyles(G), [G]);
  const tutorial = useTutorial({ tutorial: inventoryFormTutorial });
  const dialog = useDialog();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState<any[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  // Data State
  const [hasPacks, setHasPacks] = useState(false);
  const [itemName, setItemName] = useState('');
  useTutorialExample('if-name', setItemName);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [companyName, setCompanyName] = useState('');
  useTutorialExample('if-brand', setCompanyName);
  const [purchaseUnit, setPurchaseUnit] = useState('box');
  const [baseUnit, setBaseUnit] = useState('pieces');
  const [unitsPerPack, setUnitsPerPack] = useState('1');
  const [totalPackQuantity, setTotalPackQuantity] = useState('1');
  const [packPurchasePrice, setPackPurchasePrice] = useState('');
  const [baseSellingPrice, setBaseSellingPrice] = useState('');
  const [packSellingPrice, setPackSellingPrice] = useState('');
  const [allowSellByBase] = useState(true);
  const [allowSellByPack, setAllowSellByPack] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  useTutorialExample('if-expiry', setExpiryDate);
  const [qualityGrade, setQualityGrade] = useState('grade1');
  const [notes] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierAccount, setSupplierAccount] = useState('');
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [showNewSupplierForm, setShowNewSupplierForm] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newSupplierAccount, setNewSupplierAccount] = useState('');
  const [newSupplierNotes] = useState('');
  const [creditToggle, setCreditToggle] = useState<'Yes' | 'No'>('No');
  const [supplierCallEnabled, setSupplierCallEnabled] = useState<boolean>(false);

  const [recordDate, setRecordDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [showExpiryDatePicker, setShowExpiryDatePicker] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const draftFormKey = 'inventory-add';
  const draftFormData = useFormDrafts({
    screen: 'inventory',
    formKey: draftFormKey,
    getPayload: useCallback(() => ({
      step,
      itemName,
      selectedCategory,
      companyName,
      purchaseUnit,
      baseUnit,
      unitsPerPack,
      totalPackQuantity,
      packPurchasePrice,
      baseSellingPrice,
      packSellingPrice,
      allowSellByPack,
      expiryDate,
      qualityGrade,
      creditToggle,
      supplierPhone,
      supplierAccount,
      supplierCallEnabled,
      supplierId: selectedSupplier?.id || null,
      hasPacks,
      recordDate,
    }), [step, itemName, selectedCategory, companyName, purchaseUnit, baseUnit, unitsPerPack, totalPackQuantity, packPurchasePrice, baseSellingPrice, packSellingPrice, allowSellByPack, expiryDate, qualityGrade, creditToggle, supplierPhone, supplierAccount, supplierCallEnabled, selectedSupplier, hasPacks, recordDate]),
    getTitle: useCallback(() => (itemName ? t('draft.inventory_title', { name: itemName }) : t('draft.inventory_default')), [itemName, t]),
    getSubtitle: useCallback(() => t('draft.inventory_subtitle', { step: String(step) }), [step, t]),
    enabled: true,
  });

   const loadSuppliers = () => {
     const sup = getSuppliers();
     setSuppliers(sup);
   };

useEffect(() => {
const loadCategories = async () => {
        const dbCats: any = await getUserCategories();
        if (dbCats && dbCats.length > 0) setCategories(dbCats);
      };
     loadCategories();
     loadSuppliers();
   }, []);

  useEffect(() => {
    if (!tutorial.isActive) return;
    const tid = tutorial.currentStep?.targetId;
    if (tid === 'if-unit') {
      setHasPacks(true);
      setPurchaseUnit('box');
      setUnitsPerPack('12');
      setTotalPackQuantity('50');
    } else if (tid === 'if-pricing') {
      setPackPurchasePrice('1200');
      setBaseSellingPrice('150');
      setPackSellingPrice('1800');
    } else if (tid === 'if-supplier') {
      setSupplierPhone('0911-234-567');
      setSupplierAccount('1000234567');
      setCreditToggle('Yes');
      setSupplierCallEnabled(true);
    }
  }, [tutorial.isActive, tutorial.currentStep?.targetId]);

  // Real-time calculations
  const totalBaseQuantity = hasPacks ? (Number(totalPackQuantity) || 0) * (Number(unitsPerPack) || 0) : (Number(totalPackQuantity) || 0);
  const baseCostPrice = hasPacks ? (Number(packPurchasePrice) || 0) / (Number(unitsPerPack) || 1) : (Number(packPurchasePrice) || 0);
  const baseMargin = baseCostPrice > 0 ? ((Number(baseSellingPrice) - baseCostPrice) / baseCostPrice) * 100 : 0;
  const isLossDetected = Number(baseSellingPrice) > 0 && Number(baseSellingPrice) < baseCostPrice;

  const validateStep = (currentStep: number) => {
    let currentErrors: Record<string, string> = {};
    
    if (currentStep === 1) {
      if (!itemName.trim()) currentErrors.itemName = t('form.error_name_required');
      if (!selectedCategory) currentErrors.category = t('form.error_category_required');
    } else if (currentStep === 2) {
      if (Number(totalPackQuantity) <= 0) currentErrors.quantity = t('form.error_quantity_positive');
      if (hasPacks && Number(unitsPerPack) <= 0) currentErrors.unitsPerPack = t('form.error_units_positive');
    } else if (currentStep === 3) {
      if (!packPurchasePrice || Number(packPurchasePrice) <= 0) currentErrors.purchasePrice = t('form.error_price_invalid');
      if (!baseSellingPrice || Number(baseSellingPrice) <= 0) currentErrors.sellingPrice = t('form.error_price_positive');
      if (allowSellByPack && (!packSellingPrice || Number(packSellingPrice) <= 0)) {
        currentErrors.packSellingPrice = t('form.error_price_positive');
      }
    } else if (currentStep === 4) {
      if (creditToggle === 'Yes') {
        if (!supplierPhone.trim()) currentErrors.supplierPhone = t('form.error_phone_required');
        if (!supplierAccount.trim()) currentErrors.supplierAccount = t('form.error_account_required');
      }
      if (expiryDate && expiryDate.trim()) {
        const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
        const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(expiryDate.trim()) && !isoRegex.test(expiryDate.trim())) {
          currentErrors.expiryDate = t('form.error_date_format');
        }
      }
    }
    
    setErrors(currentErrors);
    return Object.keys(currentErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (step < 4) setStep(step + 1);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      playBad();
    }
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step > 1) setStep(step - 1);
  };

  const handleFinish = async () => {
    // Validate all steps before saving
    if (!validateStep(4)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      playBad();
      return;
    }
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      playNice();
      let finalCategoryId = selectedCategory?.id || 0;
      if (selectedCategory && (!selectedCategory.id || selectedCategory.id > 1000)) {
        const newId = await insertCategory(selectedCategory.name, selectedCategory.icon || 'ðŸ“¦', true);
        if (newId) finalCategoryId = Number(newId);
      }

      const itemData: any = {
        name: itemName,
        categoryId: finalCategoryId,
        companyName,
        purchaseUnit: hasPacks ? purchaseUnit : baseUnit,
        baseUnit,
        unitsPerPack: hasPacks ? Number(unitsPerPack) : 1,
        totalPackQuantity: hasPacks ? Number(totalPackQuantity) : 0,
        totalBaseQuantity: totalBaseQuantity,
        packPurchasePrice: hasPacks ? Number(packPurchasePrice) : 0,
        basePurchasePrice: baseCostPrice,
        baseSellingPrice: Number(baseSellingPrice),
        packSellingPrice: hasPacks ? Number(packSellingPrice) : Number(baseSellingPrice),
        allowSellByBaseUnit: hasPacks ? allowSellByBase : true,
        allowSellByPackUnit: hasPacks ? allowSellByPack : false,
        expiryDate: expiryDate || null,
        qualityGrade,
        notes,
        isCredit: creditToggle === 'Yes',
        supplierId: selectedSupplier?.id || null,
        supplierPhone: supplierCallEnabled || creditToggle === 'Yes' ? supplierPhone : null,
        supplierAccount: supplierCallEnabled || creditToggle === 'Yes' ? supplierAccount : null,
        supplierCallEnabled,
        warehouseId: activeWarehouseId || null,
        createdAt: recordDate || undefined,
      };
      // When a supplier is selected, record the initial purchase against them so
      // the item appears in their products AND purchases. Credit purchases are
      // flagged 'Unpaid' so they show as outstanding; cash purchases 'Paid'.
      if (selectedSupplier) {
        itemData.supplierPaymentStatus = creditToggle === 'Yes' ? 'Unpaid' : 'Paid';
        itemData.supplierPaidAmount = creditToggle === 'Yes' ? 0 : totalBaseQuantity * baseCostPrice;
      }

      const insertedId = await insertItem(itemData);
      if (insertedId && hasPacks && allowSellByPack) {
        const packCount = Number(totalPackQuantity);
        const packs = Array.from({ length: packCount }, (_, i) => ({
          itemId: Number(insertedId),
          packNumber: i + 1,
          quantity: Number(unitsPerPack),
          unit: baseUnit,
        }));
        insertPacksBatch(packs);
      }
      // Call onSuccess/onClose directly instead of showing success modal
      await draftFormData.clearCurrent();
      if (onSuccess) onSuccess();
      else if (onClose) onClose();
      else if (router.canGoBack()) router.back();
    } catch (e) {
      console.error(e);
      await dialog.alert({ title: t('common.error'), message: t('inventory.failed_to_save'), iconType: 'danger' });
    }
  };

  // --- RENDERING COMPONENTS ---

  const renderStepIndicator = () => (
    <View style={styles.stepContainer}>
      <View style={[styles.stepLine, { backgroundColor: G.border }]}>
        <Animated.View 
          style={[styles.stepProgress, { backgroundColor: G.fg, width: `${(step / 4) * 100}%` }]} 
        />
      </View>
      <View style={styles.stepLabels}>
        {[t('form.identification'), t('form.metrics'), t('form.finance'), t('form.assurance')].map((label, i) => (
          <View key={i} style={styles.stepLabelItem}>
            <View style={[styles.stepDot, step > i ? { backgroundColor: G.fg } : { backgroundColor: G.border }]} />
            <AppText variant="micro" weight="bold" shrink={false} style={[styles.stepLabelText, { color: step > i ? G.fg : G.fgSecondary }]} numberOfLines={1}>{label}</AppText>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: G.bg }]}>
      {/* Ambient glow washes */}
      <View style={[styles.glowWash1, { backgroundColor: G.mutedLight }]} />
      <View style={[styles.glowWash2, { backgroundColor: G.mutedLight }]} />
      <View style={[styles.glowWash3, { backgroundColor: G.mutedLight }]} />
        <TutorialTarget id="if-header">
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => {
              if (onClose) onClose();
              else if (router.canGoBack()) router.back();
            }} 
            style={[styles.closeBtn, { borderColor: G.border }]}
          >
            <X size={20} color={G.fg} />
          </TouchableOpacity>
          <AppText variant="display" weight="bold" style={[styles.headerTitle, { color: G.fg }]} numberOfLines={2}>{t('form.intelligence_intake')}</AppText>
          <TutorialButton tutorialId="inventory-form" screenName={t('screen.add_inventory_item')} />
        </View>
        </TutorialTarget>

        {renderStepIndicator()}

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
      <TutorialScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {draftFormData.showDrafts && (
          <DraftSection
            drafts={draftFormData.drafts}
            onRestore={async (draft: Draft) => {
              const d = draft.data;
              setStep(d.step || 1);
              setItemName(d.itemName || '');
              setSelectedCategory(d.selectedCategory || null);
              setCompanyName(d.companyName || '');
              setPurchaseUnit(d.purchaseUnit || 'box');
              setBaseUnit(d.baseUnit || 'pieces');
              setUnitsPerPack(d.unitsPerPack || '1');
              setTotalPackQuantity(d.totalPackQuantity || '1');
              setPackPurchasePrice(d.packPurchasePrice || '');
              setBaseSellingPrice(d.baseSellingPrice || '');
              setPackSellingPrice(d.packSellingPrice || '');
              setAllowSellByPack(d.allowSellByPack || false);
              setExpiryDate(d.expiryDate || '');
              setQualityGrade(d.qualityGrade || 'grade1');
              setCreditToggle(d.creditToggle || 'No');
              setSupplierPhone(d.supplierPhone || '');
              setSupplierAccount(d.supplierAccount || '');
              setSupplierCallEnabled(d.supplierCallEnabled || false);
              setSelectedSupplier(d.supplierId ? suppliers.find((s: any) => s.id === d.supplierId) || null : null);
              setHasPacks(d.hasPacks || false);
              setRecordDate(d.recordDate || '');
              await draftFormData.remove(draft.id);
            }}
            onDelete={async (id: string) => {
              await draftFormData.remove(id);
            }}
          />
        )}
        <Animated.View entering={FadeInDown} key={step} style={styles.stepContent}>
          {step === 1 && (
            <View style={styles.formCard}>
              <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.cardTitle, { color: G.fgSecondary }]} numberOfLines={1}>{t('form.asset_identification')}</AppText>
              
                <TutorialTarget id="if-name">
                <View style={styles.inputNode}>
                  <View style={styles.nodeHeader}>
                     <Tag size={14} color={G.fgSecondary} />
                     <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('form.official_name')}</AppText>
                     <AppText variant="micro" weight="medium" shrink={false} style={{ fontSize: 10, color: G.fgSecondary, marginLeft: 'auto' }} numberOfLines={1}>{itemName.length}/50</AppText>
                  </View>
                  <TextInput 
                    style={[styles.input, { color: G.fg, borderColor: errors.itemName ? colors.error : G.border }]} 
                    placeholder={t('form.search_placeholder_asset')} 
                    placeholderTextColor={G.fgSecondary}
                    value={itemName}
                    onChangeText={(val) => { if (val.length <= 50) { setItemName(val); if (errors.itemName) setErrors(prev => ({ ...prev, itemName: '' })); } }}
                    maxLength={50}
                  />
                  {errors.itemName && <AppText variant="caption" weight="medium" style={[styles.errorText, { color: colors.error }]} numberOfLines={2}>{errors.itemName}</AppText>}
                </View>
                </TutorialTarget>

              {/* Category Selector */}
              <View style={styles.inputNode}>
                <View style={styles.nodeHeader}>
                   <LayoutGrid size={14} color={G.fgSecondary} />
                   <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('form.intel_category')}</AppText>
                </View>
                <TouchableOpacity
                  style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderColor: errors.category ? colors.error : G.border }]}
                  onPress={() => setShowCategoryModal(true)}
                >
                  <AppText variant="body" weight="medium" style={{ color: selectedCategory ? G.fg : G.fgSecondary }} numberOfLines={1}>
                    {selectedCategory ? selectedCategory.name : t('form.new_domain')}
                  </AppText>
                  <ChevronDown size={18} color={G.fgSecondary} />
                </TouchableOpacity>
                 {errors.category && <AppText variant="caption" weight="medium" style={[styles.errorText, { color: colors.error }]} numberOfLines={2}>{errors.category}</AppText>}
              </View>

              <TutorialTarget id="if-brand">
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
              </TutorialTarget>
            </View>
          )}

          {step === 2 && (
            <TutorialTarget id="if-unit">
            <View style={styles.formCard}>
              <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.cardTitle, { color: G.fgSecondary }]} numberOfLines={1}>{t('form.metrics_scaling')}</AppText>
              
              <View style={[styles.intelligenceBlock, { backgroundColor: G.bgCard, borderColor: G.border }]}>
                <View style={styles.blockHeader}>
                   <Package size={20} color={colors.primary} />
                   <AppText variant="body" weight="bold" style={[styles.blockTitle, { color: G.fg }]} numberOfLines={2}>{t('form.box_roll_config')}</AppText>
                   <TouchableOpacity 
                     onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setHasPacks(!hasPacks); }}
                     style={[styles.switch, { backgroundColor: hasPacks ? G.fg : G.border }]}
                   >
                     <View style={[styles.switchThumb, { backgroundColor: G.bg, left: hasPacks ? 24 : 2 }]} />
                   </TouchableOpacity>
                </View>
                <AppText variant="body-sm" weight="medium" style={[styles.blockSub, { color: G.fgSecondary }]} numberOfLines={2}>{t('form.box_roll_desc')}</AppText>
              </View>

              <View style={styles.row}>
                {hasPacks && (
                  <View style={{ flex: 1, marginRight: 15 }}>
                     <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary, marginBottom: 8 }]} numberOfLines={1}>{t('form.bulk_unit')}</AppText>
                     <TextInput 
                        style={[styles.input, { color: G.fg, borderColor: G.border }]} 
                        value={purchaseUnit}
                        onChangeText={setPurchaseUnit}
                        placeholder={t('form.bulk_unit')}
                        placeholderTextColor={G.fgSecondary}
                     />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                   <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary, marginBottom: 8 }]} numberOfLines={1}>{t('form.base_unit')}</AppText>
                   <TextInput 
                      style={[styles.input, { color: G.fg, borderColor: G.border }]} 
                      value={baseUnit}
                      onChangeText={setBaseUnit}
                      placeholder={t('form.base_unit')}
                      placeholderTextColor={G.fgSecondary}
                   />
                </View>
              </View>

              {hasPacks && (
                <View style={styles.inputNode}>
                   <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary, marginBottom: 8 }]} numberOfLines={1}>{t('form.conversion_ratio')}</AppText>
                   <TextInput 
                     style={[styles.input, { color: G.fg, borderColor: errors.unitsPerPack ? colors.error : G.border, fontFamily: Fonts.bold }]} 
                     value={unitsPerPack}
                     onChangeText={(val) => { setUnitsPerPack(val); if (errors.unitsPerPack) setErrors(prev => ({ ...prev, unitsPerPack: '' })); }}
                     keyboardType="numeric"
                   />
                   {errors.unitsPerPack && <AppText variant="caption" weight="medium" style={[styles.errorText, { color: colors.error }]} numberOfLines={2}>{errors.unitsPerPack}</AppText>}
                </View>
              )}

              <View style={styles.inputNode}>
                 <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary, marginBottom: 8 }]} numberOfLines={2}>{t('form.initial_stock', { unit: hasPacks ? purchaseUnit : baseUnit })}</AppText>
                 <TextInput 
                   style={[styles.input, { color: G.fg, borderColor: errors.quantity ? colors.error : G.border, fontFamily: Fonts.bold, fontSize: 18 }]} 
                   value={totalPackQuantity}
                   onChangeText={(val) => { setTotalPackQuantity(val); if (errors.quantity) setErrors(prev => ({ ...prev, quantity: '' })); }}
                   keyboardType="numeric"
                 />
                 {errors.quantity && <AppText variant="caption" weight="medium" style={[styles.errorText, { color: colors.error }]} numberOfLines={2}>{errors.quantity}</AppText>}
              </View>
            </View>
            </TutorialTarget>
          )}

          {step === 3 && (
            <TutorialTarget id="if-pricing">
            <View style={styles.formCard}>
              <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.cardTitle, { color: G.fgSecondary }]} numberOfLines={1}>{t('form.financial_strategy')}</AppText>
              
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 15 }}>
                    <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary, marginBottom: 8 }]} numberOfLines={2}>{hasPacks ? t('form.bulk_cost') : t('form.unit_cost')}</AppText>
                    <TextInput 
                      style={[styles.input, { color: G.fg, borderColor: errors.purchasePrice ? colors.error : G.border, fontFamily: Fonts.bold }]} 
                      placeholder="0.00"
                      value={packPurchasePrice}
                      onChangeText={(val) => { setPackPurchasePrice(val); if (errors.purchasePrice) setErrors(prev => ({ ...prev, purchasePrice: '' })); }}
                      keyboardType="numeric"
                    />
                </View>
                <View style={{ flex: 1 }}>
                   <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary, marginBottom: 8 }]} numberOfLines={2}>
                     {hasPacks ? t('form.unit_selling_price') : t('form.unit_price')}
                   </AppText>
                   <TextInput 
                      style={[styles.input, { color: G.fg, borderColor: errors.sellingPrice ? colors.error : (isLossDetected ? colors.error : G.border), fontFamily: Fonts.bold }]} 
                      placeholder={hasPacks && unitsPerPack ? (Number(packPurchasePrice) / Number(unitsPerPack) * 1.2).toFixed(2) : "0.00"}
                      value={baseSellingPrice}
                      onChangeText={(val) => { setBaseSellingPrice(val); if (errors.sellingPrice) setErrors(prev => ({ ...prev, sellingPrice: '' })); }}
                      keyboardType="numeric"
                    />
                </View>
              </View>
              {(errors.purchasePrice || errors.sellingPrice) && (
                <AppText variant="caption" weight="medium" style={[[styles.errorText, { color: colors.error }], { marginBottom: 10 }]} numberOfLines={2}>
                  {errors.purchasePrice || errors.sellingPrice}
                </AppText>
              )}

              <View style={[styles.financeSummary, { backgroundColor: G.bgCard, borderColor: G.border }]}>
                 <View style={styles.summaryRow}>
                    <AppText variant="caption" weight="medium" style={[styles.summaryLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('form.profit_per', { unit: baseUnit })}</AppText>
                    <AppNumber value={Number(baseSellingPrice) - baseCostPrice} prefix={t('common.etb') + ' '} size="body-sm" style={styles.summaryValue} />
                 </View>
                 <View style={styles.summaryRow}>
                    <AppText variant="caption" weight="medium" style={[styles.summaryLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('form.intel_margin')}</AppText>
                    <AppNumber value={baseMargin} suffix="%" size="body-sm" style={styles.summaryValue} />
                 </View>
                 {isLossDetected && (
                   <View style={styles.warningRow}>
                      <AlertCircle size={14} color={colors.error} />
                       <AppText variant="caption" weight="bold" style={[styles.warningText, { color: colors.error }]} numberOfLines={2}>{t('form.loss_detected', { cost: baseCostPrice.toFixed(2) })}</AppText>
                   </View>
                 )}
              </View>

              <TouchableOpacity 
                 style={[styles.advToggle, { borderColor: G.border }]}
                 onPress={() => setAllowSellByPack(!allowSellByPack)}
              >
                 <AppText variant="body-sm" weight="bold" style={[styles.advToggleText, { color: G.fg }]} numberOfLines={2}>{t('form.adv_bulk_selling')}</AppText>
                 <ChevronDown size={18} color={G.fgSecondary} />
              </TouchableOpacity>
              
              {allowSellByPack && (
                <Animated.View entering={FadeInDown} style={styles.inputNode}>
                   <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary, marginBottom: 8 }]} numberOfLines={1}>{t('form.bulk_selling_price')}</AppText>
                   <TextInput 
                     style={[styles.input, { color: G.fg, borderColor: errors.packSellingPrice ? colors.error : G.border, fontFamily: Fonts.bold }]} 
                     placeholder={hasPacks && packPurchasePrice ? (Number(packPurchasePrice) * 1.2).toFixed(2) : "0.00"}
                     value={packSellingPrice}
                     onChangeText={(val) => { setPackSellingPrice(val); if (errors.packSellingPrice) setErrors(prev => ({ ...prev, packSellingPrice: '' })); }}
                     keyboardType="numeric"
                   />
                   {errors.packSellingPrice && <AppText variant="caption" weight="medium" style={[styles.errorText, { color: colors.error }]} numberOfLines={2}>{errors.packSellingPrice}</AppText>}
                </Animated.View>
              )}
            </View>
            </TutorialTarget>
          )}

          {step === 4 && (
            <View style={styles.formCard}>
              <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.cardTitle, { color: G.fgSecondary }]} numberOfLines={1}>{t('form.asset_assurance')}</AppText>

              {/* Record Date */}
              <TouchableOpacity 
                style={[styles.inputNode, { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: G.border, marginBottom: 15 }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Calendar size={18} color={colors.primary} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary, marginBottom: 2 }]} numberOfLines={1}>{t('common.record_date')}</AppText>
                  <AppText variant="body" weight="bold" style={{ color: recordDate ? G.fg : G.fgSecondary }} numberOfLines={1}>
                    {recordDate ? formatDate(new Date(recordDate), calendarType, language) : t('common.today')}
                  </AppText>
                </View>
                <ChevronDown size={18} color={G.fgSecondary} />
              </TouchableOpacity>
              
              <TutorialTarget id="if-expiry">
              <TouchableOpacity
                style={[styles.inputNode, { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: errors.expiryDate ? colors.error : G.border, marginBottom: 15 }]}
                onPress={() => setShowExpiryDatePicker(true)}
              >
                <Calendar size={18} color={colors.primary} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary, marginBottom: 2 }]} numberOfLines={1}>{t('form.expiration_archive')}</AppText>
                  <AppText variant="body" weight="bold" style={{ color: expiryDate ? G.fg : G.fgSecondary }} numberOfLines={1}>
                    {expiryDate ? formatDate(new Date(expiryDate), calendarType, language) : t('form.select_date')}
                  </AppText>
                </View>
                <ChevronDown size={18} color={G.fgSecondary} />
              </TouchableOpacity>
              {errors.expiryDate && <AppText variant="caption" weight="medium" style={[styles.errorText, { color: colors.error }]} numberOfLines={2}>{errors.expiryDate}</AppText>}
              </TutorialTarget>

              <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: G.fgSecondary, marginBottom: 12 }]} numberOfLines={1}>{t('form.quality_classification')}</AppText>
              <View style={styles.gradeGrid}>
                 {QUALITY_GRADES.map(g => (
                   <TouchableOpacity 
                     key={g} 
                     style={[styles.gradeChip, { backgroundColor: G.bgCard, borderColor: qualityGrade === g ? colors.primary : G.border }]}
                     onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setQualityGrade(g); }}
                   >
                     <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.gradeText, { color: qualityGrade === g ? colors.primary : G.fgSecondary }]} numberOfLines={1}>{t(`form.${g}`)}</AppText>
                   </TouchableOpacity>
                 ))}
              </View>

              <TutorialTarget id="if-supplier" style={{ gap: 12 }}>
              {/* Supplier Selection */}
              <TouchableOpacity
                style={[styles.intelligenceBlock, { backgroundColor: G.bgCard, borderColor: G.border, flexDirection: 'row', alignItems: 'center' }]}
                onPress={() => { loadSuppliers(); setShowSupplierModal(true); }}
              >
                <Truck size={20} color={colors.primary} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <AppText variant="body" weight="bold" style={[styles.blockTitle, { color: G.fg }]} numberOfLines={2}>{t('form.supplier_label')}</AppText>
                  <AppText variant="body-sm" weight="medium" style={[styles.blockSub, { color: G.fgSecondary }]} numberOfLines={2}>
                    {selectedSupplier ? selectedSupplier.fullName : t('form.tap_select_supplier')}
                  </AppText>
                  {selectedSupplier?.phone && supplierCallEnabled && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 }}>
                      <Phone size={12} color={colors.primary} />
                      <AppText variant="caption" weight="medium" shrink={false} style={{ color: colors.primary }} numberOfLines={1}>
                        {selectedSupplier.phone}
                      </AppText>
                    </View>
                  )}
                </View>
                {selectedSupplier?.phone && supplierCallEnabled ? (
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation?.();
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      const phone = selectedSupplier.phone.replace(/[^0-9+]/g, '');
                      Linking.openURL(`tel:${phone}`).catch(async () => {
                        await dialog.alert({ title: t('common.error'), message: t('form.could_not_call'), iconType: 'danger' });
                      });
                    }}
                    style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary + '20', justifyContent: 'center', alignItems: 'center' }}
                  >
                    <PhoneCall size={18} color={colors.primary} />
                  </TouchableOpacity>
                ) : (
                  <ChevronDown size={18} color={G.fgSecondary} />
                )}
              </TouchableOpacity>

              <View style={[styles.intelligenceBlock, { backgroundColor: G.bgCard, borderColor: G.border }]}>
                <View style={styles.blockHeader}>
                   <PhoneCall size={20} color={colors.primary} />
                   <View style={{ flex: 1 }}>
                     <AppText variant="body" weight="bold" style={[styles.blockTitle, { color: G.fg }]} numberOfLines={2}>{t('form.supplier_call_title')}</AppText>
                      <AppText variant="micro" weight="medium" style={{ color: G.fgSecondary, marginTop: 2 }} numberOfLines={2}>
                        {t('form.supplier_call_sub')}
                      </AppText>
                   </View>
                   <TouchableOpacity
                     onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSupplierCallEnabled(!supplierCallEnabled); }}
                     style={[styles.switch, { backgroundColor: supplierCallEnabled ? G.fg : G.border }]}
                   >
                     <View style={[styles.switchThumb, { backgroundColor: G.bg, left: supplierCallEnabled ? 24 : 2 }]} />
                   </TouchableOpacity>
                </View>
                {supplierCallEnabled && (
                  <Animated.View entering={FadeInDown} style={{ marginTop: 12, gap: 8 }}>
                    <AppText variant="micro" weight="medium" style={{ color: G.fgSecondary, lineHeight: 16 }} numberOfLines={4}>
                      {t('form.supplier_call_help')}
                    </AppText>
                    {!selectedSupplier && (
                      <TouchableOpacity
                        onPress={() => { loadSuppliers(); setShowSupplierModal(true); }}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 }}
                      >
                        <Plus size={14} color={colors.primary} />
                        <AppText variant="caption" weight="bold" shrink={false} style={{ color: colors.primary }} numberOfLines={1}>
                          {t('form.tap_select_supplier_short')}
                        </AppText>
                      </TouchableOpacity>
                    )}
                  </Animated.View>
                )}
              </View>

              <View style={[styles.intelligenceBlock, { backgroundColor: G.bgCard, borderColor: G.border }]}>
                <View style={styles.blockHeader}>
                   <CreditCard size={20} color={colors.primary} />
                   <AppText variant="body" weight="bold" style={[styles.blockTitle, { color: G.fg }]} numberOfLines={2}>{t('form.supplier_credit')}</AppText>
                   <TouchableOpacity
                     onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCreditToggle(creditToggle === 'Yes' ? 'No' : 'Yes'); }}
                     style={[styles.switch, { backgroundColor: creditToggle === 'Yes' ? G.fg : G.border }]}
                   >
                     <View style={[styles.switchThumb, { backgroundColor: G.bg, left: creditToggle === 'Yes' ? 24 : 2 }]} />
                   </TouchableOpacity>
                </View>
              </View>

              {creditToggle === 'Yes' && selectedSupplier && (
                <Animated.View entering={FadeInDown} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 5 }}>
                  <Phone size={14} color={G.fgSecondary} />
                  <AppText variant="body-sm" weight="medium" style={{ color: G.fgSecondary, flex: 1 }} numberOfLines={1}>
                    {supplierPhone}
                  </AppText>
                  <CreditCard size={14} color={G.fgSecondary} />
                  <AppText variant="body-sm" weight="medium" style={{ color: G.fgSecondary }} numberOfLines={1}>
                    {supplierAccount}
                  </AppText>
                </Animated.View>
              )}
            </TutorialTarget>
            </View>
          )}

          {/* Action Dock */}
          <TutorialTarget id="if-commit-btn">
          <View style={styles.actionDock}>
             {step > 1 && (
               <TouchableOpacity style={[styles.backBtn, { borderColor: G.border }]} onPress={handleBack}>
                 <ChevronLeft size={20} color={G.fg} />
               </TouchableOpacity>
             )}
             <TouchableOpacity 
               style={[styles.nextBtn, { backgroundColor: G.fg, flex: 1 }]} 
               onPress={step < 4 ? handleNext : handleFinish}
             >
                 <AppText variant="body" weight="bold" shrink={false} style={[styles.nextBtnText, { color: G.bg }]} numberOfLines={1}>
                 {step < 4 ? t('form.continue_intake') : t('form.initialize_asset')}
               </AppText>
               <ArrowRight size={18} color={G.bg} />
             </TouchableOpacity>
          </View>
          </TutorialTarget>
        </Animated.View>
      </TutorialScrollView>
      </KeyboardAvoidingView>

      <CustomDatePicker
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelectDate={(date) => { setRecordDate(date); setShowDatePicker(false); }}
        initialDate={recordDate}
      />

      <CustomDatePicker
        visible={showExpiryDatePicker}
        onClose={() => setShowExpiryDatePicker(false)}
        onSelectDate={(date) => { setExpiryDate(date); setShowExpiryDatePicker(false); if (errors.expiryDate) setErrors(prev => ({ ...prev, expiryDate: '' })); }}
        initialDate={expiryDate}
      />

      <Modal visible={showCategoryModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowCategoryModal(false)}>
          <View style={[styles.categorySheet, { backgroundColor: G.bg }]}>
            <View style={styles.modalHandleRow}>
              <View style={[styles.modalHandle, { backgroundColor: G.border }]} />
            </View>
            <View style={styles.modalHeader}>
               <AppText variant="title" weight="bold" style={[styles.modalTitle, { color: G.fg }]} numberOfLines={2}>{t('form.category_intel')}</AppText>
               <TouchableOpacity onPress={() => setShowNewCategory(!showNewCategory)}>
                  <Plus size={24} color={G.fg} />
               </TouchableOpacity>
            </View>
            
            {showNewCategory && (
              <View style={styles.newCatInput}>
                 <TextInput 
                    style={[styles.input, { flex: 1, marginRight: 10, borderColor: G.border, color: G.fg }]}
                    placeholder={t('form.new_domain')}
                    value={newCategoryName}
                    onChangeText={setNewCategoryName}
                 />
                  <TouchableOpacity
                    style={[styles.addBtn, { backgroundColor: G.fg }]}
                    onPress={async () => {
                      const name = newCategoryName.trim();
                      if (!name) return;
                      const exists = categories.some(c => c.name.toLowerCase() === name.toLowerCase());
                      if (exists) {
                        await dialog.alert({ title: t('common.error'), message: t('form.category_exists'), iconType: 'danger' });
                        return;
                      }
                      const newCat = { id: Date.now(), name, icon: '\uD83D\uDCE6' };
                      setCategories([...categories, newCat]);
                      setSelectedCategory(newCat);
                      setNewCategoryName('');
                      setShowNewCategory(false);
                      setShowCategoryModal(false);
                    }}
                  >
                   <Check size={20} color={G.bg} />
                 </TouchableOpacity>
              </View>
            )}

            <ScrollView contentContainerStyle={styles.catScroll}>
              {categories.map(cat => (
                <TouchableOpacity 
                  key={cat.id} 
                  style={[styles.catItem, { borderColor: G.border }]}
                  onPress={() => { setSelectedCategory(cat); setShowCategoryModal(false); Haptics.selectionAsync(); }}
                >
                  <AppText variant="heading" shrink={false} style={styles.catIcon}>{cat.icon}</AppText>
                  <AppText variant="body" weight="bold" style={[styles.catName, { color: G.fg }]} numberOfLines={2}>{cat.name.includes('category.') ? t(cat.name) : cat.name}</AppText>
                  {selectedCategory?.id === cat.id && <Check size={18} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Supplier Selection Modal */}
      <Modal visible={showSupplierModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => { setShowSupplierModal(false); setShowNewSupplierForm(false); }}>
          <Pressable style={[styles.categorySheet, { backgroundColor: G.bg }]}>
            <View style={styles.modalHandleRow}>
              <View style={[styles.modalHandle, { backgroundColor: G.border }]} />
            </View>
            
            <View style={styles.modalHeader}>
               <AppText variant="title" weight="bold" style={[styles.modalTitle, { color: G.fg }]} numberOfLines={2}>{t('inv.select_supplier')}</AppText>
              <TouchableOpacity onPress={() => { setShowNewSupplierForm(!showNewSupplierForm); }}>
                <Plus size={24} color={G.fg} />
              </TouchableOpacity>
            </View>

            {/* New Supplier Form */}
            {showNewSupplierForm && (
              <View style={{ paddingHorizontal: 25, marginBottom: 20, gap: 12 }}>
                <TextInput
                  style={[styles.input, { color: G.fg, borderColor: G.border }]}
                  placeholder={t('common.supplier_name_ph')}
                  placeholderTextColor={G.fgSecondary}
                  value={newSupplierName}
                  onChangeText={setNewSupplierName}
                />
                <TextInput
                  style={[styles.input, { color: G.fg, borderColor: G.border }]}
                  placeholder={t('contacts.phone_ph')}
                  placeholderTextColor={G.fgSecondary}
                  value={newSupplierPhone}
                  onChangeText={setNewSupplierPhone}
                  keyboardType="phone-pad"
                />
                <TextInput
                  style={[styles.input, { color: G.fg, borderColor: G.border }]}
                  placeholder={t('common.account_number_ph')}
                  placeholderTextColor={G.fgSecondary}
                  value={newSupplierAccount}
                  onChangeText={setNewSupplierAccount}
                  keyboardType="numeric"
                />
                <TouchableOpacity
                  style={[styles.addBtn, { backgroundColor: G.fg, alignSelf: 'flex-end' }]}
                  onPress={async () => {
                    if (!newSupplierName.trim()) {
                      await dialog.alert({ title: t('common.error'), message: t('form.supplier_name_required'), iconType: 'danger' });
                      return;
                    }
                    const id = await insertContact({
                      fullName: newSupplierName.trim(),
                      category: 'supplier',
                      phone: newSupplierPhone.trim() || undefined,
                      accountNumber: newSupplierAccount.trim() || undefined,
                      notes: newSupplierNotes.trim() || undefined,
                    });
                    if (id) {
                      const newSup = { id: Number(id), fullName: newSupplierName.trim(), phone: newSupplierPhone.trim(), accountNumber: newSupplierAccount.trim(), category: 'supplier' };
                      setSuppliers([...suppliers, newSup]);
                      setSelectedSupplier(newSup);
                      setSupplierPhone(newSupplierPhone.trim());
                      setSupplierAccount(newSupplierAccount.trim());
                      setShowSupplierModal(false);
                      setShowNewSupplierForm(false);
                      setNewSupplierName('');
                      setNewSupplierPhone('');
                      setNewSupplierAccount('');
                    }
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    playNice();
                  }}
                >
                  <Check size={20} color={G.bg} />
                </TouchableOpacity>
              </View>
            )}

            <ScrollView contentContainerStyle={styles.catScroll}>
              {suppliers.length === 0 && !showNewSupplierForm && (
                <View style={{ padding: 30, alignItems: 'center' }}>
                   <AppText variant="body" weight="medium" align="center" style={[styles.catName, { color: G.fgSecondary }]} numberOfLines={2}>{t('inv.no_suppliers_add')}</AppText>
                </View>
              )}
              {suppliers.map((sup) => (
                <TouchableOpacity
                  key={sup.id}
                  style={[styles.catItem, { borderColor: G.border }]}
                  onPress={() => { setSelectedSupplier(sup); setSupplierPhone(sup.phone || ''); setSupplierAccount(sup.accountNumber || ''); setShowSupplierModal(false); Haptics.selectionAsync(); }}
                >
                  <Truck size={20} color={colors.primary} />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <AppText variant="body" weight="bold" style={[styles.catName, { color: G.fg }]} numberOfLines={1}>{sup.fullName}</AppText>
                      {sup.phone && <AppText variant="caption" weight="medium" style={{ color: G.fgSecondary }} numberOfLines={1}>{sup.phone}</AppText>}
                  </View>
                  {selectedSupplier?.id === sup.id && <Check size={18} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (G: any) => StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 25, paddingVertical: 10 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontFamily: Fonts.bold },
  stepContainer: { paddingHorizontal: 25, marginVertical: 10 },
  stepLine: { height: 4, borderRadius: 2, width: '100%', overflow: 'hidden' },
  stepProgress: { height: '100%' },
  stepLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  stepLabelItem: { alignItems: 'center' },
  stepDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 8 },
  stepLabelText: { fontSize: 10, fontFamily: Fonts.bold, textTransform: 'uppercase' },
  scrollContent: { padding: 20 },
  stepContent: { flex: 1 },
  formCard: { gap: 16, overflow: 'hidden' },
  cardTitle: { fontSize: 13, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 },
  inputNode: { gap: 6 },
  nodeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 5 },
  nodeLabel: { fontSize: 11, fontFamily: Fonts.bold, letterSpacing: 0.5 },
  input: { height: 52, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, fontSize: 15, fontFamily: Fonts.medium, backgroundColor: G.bgCard },
  inputText: { fontSize: 16, fontFamily: Fonts.medium },
  intelligenceBlock: { borderRadius: 20, padding: 14, borderWidth: 1, gap: 8, overflow: 'hidden' },
  blockHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  blockTitle: { flex: 1, fontSize: 15, fontFamily: Fonts.bold },
  blockSub: { fontSize: 12, fontFamily: Fonts.medium, lineHeight: 18 },
  switch: { width: 50, height: 28, borderRadius: 14, padding: 2, position: 'relative' },
  switchThumb: { width: 24, height: 24, borderRadius: 12, position: 'absolute', top: 2 },
  row: { flexDirection: 'row', alignItems: 'center' },
  financeSummary: { borderRadius: 20, padding: 14, borderWidth: 1, gap: 8, overflow: 'hidden' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 13, fontFamily: Fonts.bold },
  summaryValue: { fontSize: 16, fontFamily: Fonts.bold },
  warningRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  warningText: { fontSize: 11, fontFamily: Fonts.bold },
  errorText: { fontSize: 10, fontFamily: Fonts.semibold, marginTop: 4, marginLeft: 5 },
  advToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, borderRadius: 18, borderStyle: 'dashed', borderWidth: 1 },
  advToggleText: { fontSize: 14, fontFamily: Fonts.bold },
  inlineCategoryRow: { flexDirection: 'row', paddingVertical: 8, gap: 8 },
  inlineCategoryChip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, gap: 6 },
  inlineCategoryText: { fontSize: 13, fontFamily: Fonts.medium },
  gradeGrid: { flexDirection: 'row', gap: 10 },
  gradeChip: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center', overflow: 'hidden' },
  gradeText: { fontSize: 13, fontFamily: Fonts.bold },
  actionDock: { flexDirection: 'row', gap: 12, marginTop: 24 },
  backBtn: { width: 56, height: 56, borderRadius: 18, borderWidth: 1, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  nextBtn: { height: 56, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, overflow: 'hidden' },
  nextBtnText: { fontSize: 16, fontFamily: Fonts.bold },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  categorySheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingBottom: 40, maxHeight: '80%' },
  modalHandleRow: { alignItems: 'center', paddingTop: 15, paddingBottom: 10 },
  modalHandle: { width: 40, height: 4, borderRadius: 2 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 25, marginBottom: 20 },
  modalTitle: { fontSize: 18, fontFamily: Fonts.bold },
  newCatInput: { flexDirection: 'row', paddingHorizontal: 25, marginBottom: 20 },
  addBtn: { width: 60, height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  catScroll: { paddingHorizontal: 25 },
  catItem: { flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, gap: 15 },
  catIcon: { fontSize: 22 },
  catName: { flex: 1, fontSize: 16, fontFamily: Fonts.bold },
  successOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  successCard: { width: '85%', borderRadius: 32, padding: 35, alignItems: 'center', borderWidth: 1, overflow: 'hidden' },
  successIconCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  successTitle: { fontSize: 24, fontFamily: Fonts.bold, marginBottom: 8 },
  successSub: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 30 },
  finishBtn: { width: '100%', height: 56, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, overflow: 'hidden' },
  finishBtnText: { fontSize: 16, fontFamily: Fonts.bold },
  vaultBtn: { width: '100%', height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  vaultBtnText: { fontSize: 16, fontFamily: Fonts.bold },
  addMoreBtn: { width: '100%', height: 60, borderRadius: 18, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  addMoreText: { fontSize: 16, fontFamily: Fonts.bold },
  modeCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 18, borderWidth: 1, gap: 12, overflow: 'hidden' },
  modeIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  glowWash1: {
    position: 'absolute',
    top: -80,
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.5,
  },
  glowWash2: {
    position: 'absolute',
    top: 120,
    right: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.4,
  },
  glowWash3: {
    position: 'absolute',
    bottom: 100,
    left: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    opacity: 0.35,
  },
});

export default AddAssetFlow;
