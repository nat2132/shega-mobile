import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Layout
} from 'react-native-reanimated';
import {
  PackageCheck,
  ChevronDown,
  Info,
  Calendar,
  ArrowRight,
  X,
  Check,
  Plus,
  Package,
  Trash2,
  Shield,
  Building2,
  ShoppingCart,
  CheckCircle,
  BarChart3,
  Tag,
  History,
  AlertCircle,
  Truck,
  CreditCard,
  Target,
  ChevronLeft,
  Sparkles,
  Zap,
  Hammer,
  ShieldCheck,
  LayoutGrid,
  Phone,
  PhoneCall
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import {
   insertItem,
   insertCategory,
   getCategories,
   insertPack,
   getSuppliers,
   insertContact
} from '@/database/db';
import { useSettings } from '@/context/SettingsContext';
import { useDialog } from '@/context/DialogContext';
import { Fonts } from '@/constants/theme';
import { CustomDatePicker } from '@/components/CustomDatePicker';
import { AppText, AppListItem, AppRow, AppCard } from '@/components/ui';
const QUALITY_GRADES = ['grade1', 'grade2', 'grade3'];

export const AddAssetFlow = ({ onSuccess, onClose }: { onSuccess?: () => void, onClose?: () => void }) => {
  const { colors, t, calendarType, language, theme } = useSettings();
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
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [companyName, setCompanyName] = useState('');
  const [purchaseUnit, setPurchaseUnit] = useState('box');
  const [baseUnit, setBaseUnit] = useState('pieces');
  const [unitsPerPack, setUnitsPerPack] = useState('1');
  const [totalPackQuantity, setTotalPackQuantity] = useState('1');
  const [packPurchasePrice, setPackPurchasePrice] = useState('');
  const [baseSellingPrice, setBaseSellingPrice] = useState('');
  const [packSellingPrice, setPackSellingPrice] = useState('');
  const [allowSellByBase, setAllowSellByBase] = useState(true);
  const [allowSellByPack, setAllowSellByPack] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  const [qualityGrade, setQualityGrade] = useState('grade1');
  const [notes, setNotes] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierAccount, setSupplierAccount] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [showNewSupplierForm, setShowNewSupplierForm] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newSupplierAccount, setNewSupplierAccount] = useState('');
  const [newSupplierNotes, setNewSupplierNotes] = useState('');
  const [creditToggle, setCreditToggle] = useState<'Yes' | 'No'>('No');
  const [supplierCallEnabled, setSupplierCallEnabled] = useState<boolean>(false);

  const [recordDate, setRecordDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

   const loadSuppliers = () => {
     const sup = getSuppliers();
     setSuppliers(sup);
   };

useEffect(() => {
const loadCategories = async () => {
        const dbCats: any = await getCategories();
        if (dbCats && dbCats.length > 0) setCategories(dbCats);
      };
     loadCategories();
     loadSuppliers();
   }, []);

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
      return;
    }
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      let finalCategoryId = selectedCategory?.id || 0;
      if (selectedCategory && (!selectedCategory.id || selectedCategory.id > 1000)) {
        const newId = await insertCategory(selectedCategory.name, selectedCategory.icon || '📦', true);
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
        supplierPhone: supplierCallEnabled || creditToggle === 'Yes' ? supplierPhone : null,
        supplierAccount: supplierCallEnabled || creditToggle === 'Yes' ? supplierAccount : null,
        supplierCallEnabled,
        createdAt: recordDate || undefined,
      };

      const insertedId = await insertItem(itemData);
      if (insertedId && hasPacks && allowSellByPack) {
        for (let i = 1; i <= Number(totalPackQuantity); i++) {
          await insertPack({ itemId: Number(insertedId), packNumber: i, quantity: Number(unitsPerPack), unit: baseUnit });
        }
      }
      // Call onSuccess/onClose directly instead of showing success modal
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
      <View style={[styles.stepLine, { backgroundColor: colors.border }]}>
        <Animated.View 
          style={[styles.stepProgress, { backgroundColor: colors.text, width: `${(step / 4) * 100}%` }]} 
        />
      </View>
      <View style={styles.stepLabels}>
        {[t('form.identification'), t('form.metrics'), t('form.finance'), t('form.assurance')].map((label, i) => (
          <View key={i} style={styles.stepLabelItem}>
            <View style={[styles.stepDot, step > i ? { backgroundColor: colors.text } : { backgroundColor: colors.border }]} />
            <AppText variant="micro" weight="bold" shrink={false} style={[styles.stepLabelText, { color: step > i ? colors.text : colors.textSecondary }]} numberOfLines={1}>{label}</AppText>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => {
            if (onClose) onClose();
            else if (router.canGoBack()) router.back();
          }} 
          style={[styles.closeBtn, { borderColor: colors.border }]}
        >
          <X size={20} color={colors.text} />
        </TouchableOpacity>
        <AppText variant="display" weight="bold" style={[styles.headerTitle, { color: colors.text }]} numberOfLines={2}>{t('form.intelligence_intake')}</AppText>
        <View style={{ width: 40 }} />
      </View>

      {renderStepIndicator()}

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 90}
      >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown} key={step} style={styles.stepContent}>
          {step === 1 && (
            <View style={styles.formCard}>
              <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.cardTitle, { color: colors.textSecondary }]} numberOfLines={1}>{t('form.asset_identification')}</AppText>
              
                <View style={styles.inputNode}>
                  <View style={styles.nodeHeader}>
                     <Tag size={14} color={colors.textSecondary} />
                     <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('form.official_name')}</AppText>
                     <AppText variant="micro" weight="medium" shrink={false} style={{ fontSize: 10, color: colors.textSecondary, marginLeft: 'auto' }} numberOfLines={1}>{itemName.length}/50</AppText>
                  </View>
                  <TextInput 
                    style={[styles.input, { color: colors.text, borderColor: errors.itemName ? '#FF3B30' : colors.border }]} 
                    placeholder={t('form.search_placeholder_asset')} 
                    placeholderTextColor={colors.textSecondary}
                    value={itemName}
                    onChangeText={(val) => { if (val.length <= 50) { setItemName(val); if (errors.itemName) setErrors(prev => ({ ...prev, itemName: '' })); } }}
                    maxLength={50}
                  />
                  {errors.itemName && <AppText variant="caption" weight="medium" style={styles.errorText} numberOfLines={2}>{errors.itemName}</AppText>}
                </View>

              {/* Category Selector */}
              <View style={styles.inputNode}>
                <View style={styles.nodeHeader}>
                   <LayoutGrid size={14} color={colors.textSecondary} />
                   <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('form.intel_category')}</AppText>
                </View>
                <TouchableOpacity
                  style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderColor: errors.category ? '#FF3B30' : colors.border }]}
                  onPress={() => setShowCategoryModal(true)}
                >
                  <AppText variant="body" weight="medium" style={{ color: selectedCategory ? colors.text : colors.textSecondary }} numberOfLines={1}>
                    {selectedCategory ? selectedCategory.name : t('form.new_domain')}
                  </AppText>
                  <ChevronDown size={18} color={colors.textSecondary} />
                </TouchableOpacity>
                 {errors.category && <AppText variant="caption" weight="medium" style={styles.errorText} numberOfLines={2}>{errors.category}</AppText>}
              </View>

              <View style={styles.inputNode}>
                <View style={styles.nodeHeader}>
                   <Building2 size={14} color={colors.textSecondary} />
                   <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('form.brand')}</AppText>
                   <AppText variant="micro" weight="medium" shrink={false} style={{ color: colors.textSecondary, marginLeft: 'auto' }} numberOfLines={1}>{companyName.length}/50</AppText>
                </View>
                <TextInput 
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]} 
                  placeholder={t('form.manufacturer_placeholder')} 
                  placeholderTextColor={colors.textSecondary}
                  value={companyName}
                  onChangeText={(val) => { if (val.length <= 50) setCompanyName(val); }}
                  maxLength={50}
                />
              </View>
            </View>
          )}

          {step === 2 && (
            <View style={styles.formCard}>
              <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.cardTitle, { color: colors.textSecondary }]} numberOfLines={1}>{t('form.metrics_scaling')}</AppText>
              
              <View style={[styles.intelligenceBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.blockHeader}>
                   <Package size={20} color={colors.primary} />
                   <AppText variant="body" weight="bold" style={[styles.blockTitle, { color: colors.text }]} numberOfLines={2}>{t('form.box_roll_config')}</AppText>
                   <TouchableOpacity 
                     onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setHasPacks(!hasPacks); }}
                     style={[styles.switch, { backgroundColor: hasPacks ? colors.text : colors.border }]}
                   >
                     <View style={[styles.switchThumb, { backgroundColor: colors.background, left: hasPacks ? 24 : 2 }]} />
                   </TouchableOpacity>
                </View>
                <AppText variant="body-sm" weight="medium" style={[styles.blockSub, { color: colors.textSecondary }]} numberOfLines={2}>{t('form.box_roll_desc')}</AppText>
              </View>

              <View style={styles.row}>
                {hasPacks && (
                  <View style={{ flex: 1, marginRight: 15 }}>
                     <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: colors.textSecondary, marginBottom: 8 }]} numberOfLines={1}>{t('form.bulk_unit')}</AppText>
                     <TextInput 
                        style={[styles.input, { color: colors.text, borderColor: colors.border }]} 
                        value={purchaseUnit}
                        onChangeText={setPurchaseUnit}
                        placeholder={t('form.bulk_unit')}
                        placeholderTextColor={colors.textSecondary}
                     />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                   <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: colors.textSecondary, marginBottom: 8 }]} numberOfLines={1}>{t('form.base_unit')}</AppText>
                   <TextInput 
                      style={[styles.input, { color: colors.text, borderColor: colors.border }]} 
                      value={baseUnit}
                      onChangeText={setBaseUnit}
                      placeholder={t('form.base_unit')}
                      placeholderTextColor={colors.textSecondary}
                   />
                </View>
              </View>

              {hasPacks && (
                <View style={styles.inputNode}>
                   <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: colors.textSecondary, marginBottom: 8 }]} numberOfLines={1}>{t('form.conversion_ratio')}</AppText>
                   <TextInput 
                     style={[styles.input, { color: colors.text, borderColor: errors.unitsPerPack ? '#FF3B30' : colors.border, fontFamily: Fonts.bold }]} 
                     value={unitsPerPack}
                     onChangeText={(val) => { setUnitsPerPack(val); if (errors.unitsPerPack) setErrors(prev => ({ ...prev, unitsPerPack: '' })); }}
                     keyboardType="numeric"
                   />
                   {errors.unitsPerPack && <AppText variant="caption" weight="medium" style={styles.errorText} numberOfLines={2}>{errors.unitsPerPack}</AppText>}
                </View>
              )}

              <View style={styles.inputNode}>
                 <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: colors.textSecondary, marginBottom: 8 }]} numberOfLines={2}>{t('form.initial_stock', { unit: hasPacks ? purchaseUnit : baseUnit })}</AppText>
                 <TextInput 
                   style={[styles.input, { color: colors.text, borderColor: errors.quantity ? '#FF3B30' : colors.border, fontFamily: Fonts.bold, fontSize: 18 }]} 
                   value={totalPackQuantity}
                   onChangeText={(val) => { setTotalPackQuantity(val); if (errors.quantity) setErrors(prev => ({ ...prev, quantity: '' })); }}
                   keyboardType="numeric"
                 />
                 {errors.quantity && <AppText variant="caption" weight="medium" style={styles.errorText} numberOfLines={2}>{errors.quantity}</AppText>}
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={styles.formCard}>
              <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.cardTitle, { color: colors.textSecondary }]} numberOfLines={1}>{t('form.financial_strategy')}</AppText>
              
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 15 }}>
                    <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: colors.textSecondary, marginBottom: 8 }]} numberOfLines={2}>{hasPacks ? t('form.bulk_cost') : t('form.unit_cost')}</AppText>
                    <TextInput 
                      style={[styles.input, { color: colors.text, borderColor: errors.purchasePrice ? '#FF3B30' : colors.border, fontFamily: Fonts.bold }]} 
                      placeholder="0.00"
                      value={packPurchasePrice}
                      onChangeText={(val) => { setPackPurchasePrice(val); if (errors.purchasePrice) setErrors(prev => ({ ...prev, purchasePrice: '' })); }}
                      keyboardType="numeric"
                    />
                </View>
                <View style={{ flex: 1 }}>
                   <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: colors.textSecondary, marginBottom: 8 }]} numberOfLines={2}>
                     {hasPacks ? t('form.unit_selling_price') : t('form.unit_price')}
                   </AppText>
                   <TextInput 
                      style={[styles.input, { color: colors.text, borderColor: errors.sellingPrice ? '#FF3B30' : (isLossDetected ? '#FF3B30' : colors.border), fontFamily: Fonts.bold }]} 
                      placeholder={hasPacks && unitsPerPack ? (Number(packPurchasePrice) / Number(unitsPerPack) * 1.2).toFixed(2) : "0.00"}
                      value={baseSellingPrice}
                      onChangeText={(val) => { setBaseSellingPrice(val); if (errors.sellingPrice) setErrors(prev => ({ ...prev, sellingPrice: '' })); }}
                      keyboardType="numeric"
                    />
                </View>
              </View>
              {(errors.purchasePrice || errors.sellingPrice) && (
                <AppText variant="caption" weight="medium" style={[styles.errorText, { marginBottom: 10 }]} numberOfLines={2}>
                  {errors.purchasePrice || errors.sellingPrice}
                </AppText>
              )}

              <View style={[styles.financeSummary, { backgroundColor: colors.card, borderColor: colors.border }]}>
                 <View style={styles.summaryRow}>
                    <AppText variant="caption" weight="medium" style={[styles.summaryLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('form.profit_per', { unit: baseUnit })}</AppText>
                    <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.summaryValue, baseMargin > 0 ? { color: '#34C759' } : { color: '#FF3B30' }]} numberOfLines={1}>
                       {(Number(baseSellingPrice) - baseCostPrice).toFixed(2)} {t('common.etb')}
                    </AppText>
                 </View>
                 <View style={styles.summaryRow}>
                    <AppText variant="caption" weight="medium" style={[styles.summaryLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('form.intel_margin')}</AppText>
                    <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.summaryValue, baseMargin > 0 ? { color: '#34C759' } : { color: '#FF3B30' }]} numberOfLines={1}>
                       {baseMargin.toFixed(1)}%
                    </AppText>
                 </View>
                 {isLossDetected && (
                   <View style={styles.warningRow}>
                      <AlertCircle size={14} color="#FF3B30" />
                      <AppText variant="caption" weight="bold" style={styles.warningText} numberOfLines={2}>{t('form.loss_detected', { cost: baseCostPrice.toFixed(2) })}</AppText>
                   </View>
                 )}
              </View>

              <TouchableOpacity 
                 style={[styles.advToggle, { borderColor: colors.border }]}
                 onPress={() => setAllowSellByPack(!allowSellByPack)}
              >
                 <AppText variant="body-sm" weight="bold" style={[styles.advToggleText, { color: colors.text }]} numberOfLines={2}>{t('form.adv_bulk_selling')}</AppText>
                 <ChevronDown size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              
              {allowSellByPack && (
                <Animated.View entering={FadeInDown} style={styles.inputNode}>
                   <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: colors.textSecondary, marginBottom: 8 }]} numberOfLines={1}>{t('form.bulk_selling_price')}</AppText>
                   <TextInput 
                     style={[styles.input, { color: colors.text, borderColor: errors.packSellingPrice ? '#FF3B30' : colors.border, fontFamily: Fonts.bold }]} 
                     placeholder={hasPacks && packPurchasePrice ? (Number(packPurchasePrice) * 1.2).toFixed(2) : "0.00"}
                     value={packSellingPrice}
                     onChangeText={(val) => { setPackSellingPrice(val); if (errors.packSellingPrice) setErrors(prev => ({ ...prev, packSellingPrice: '' })); }}
                     keyboardType="numeric"
                   />
                   {errors.packSellingPrice && <AppText variant="caption" weight="medium" style={styles.errorText} numberOfLines={2}>{errors.packSellingPrice}</AppText>}
                </Animated.View>
              )}
            </View>
          )}

          {step === 4 && (
            <View style={styles.formCard}>
              <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.cardTitle, { color: colors.textSecondary }]} numberOfLines={1}>{t('form.asset_assurance')}</AppText>

              {/* Record Date */}
              <TouchableOpacity 
                style={[styles.inputNode, { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 15 }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Calendar size={18} color={colors.primary} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: colors.textSecondary, marginBottom: 2 }]} numberOfLines={1}>{t('common.record_date')}</AppText>
                  <AppText variant="body" weight="bold" style={{ color: recordDate ? colors.text : colors.textSecondary }} numberOfLines={1}>
                    {recordDate || t('common.today')}
                  </AppText>
                </View>
                <ChevronDown size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              
              <View style={styles.inputNode}>
                <View style={styles.nodeHeader}>
                   <Calendar size={14} color={colors.textSecondary} />
                   <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('form.expiration_archive')}</AppText>
                </View>
                <TextInput 
                  style={[styles.input, { color: colors.text, borderColor: errors.expiryDate ? '#FF3B30' : colors.border }]} 
                  placeholder={t('inv.date_format')} 
                  placeholderTextColor={colors.textSecondary}
                  value={expiryDate}
                  onChangeText={(val) => { setExpiryDate(val); if (errors.expiryDate) setErrors(prev => ({ ...prev, expiryDate: '' })); }}
                />
                 {errors.expiryDate && <AppText variant="caption" weight="medium" style={styles.errorText} numberOfLines={2}>{errors.expiryDate}</AppText>}
              </View>

              <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: colors.textSecondary, marginBottom: 12 }]} numberOfLines={1}>{t('form.quality_classification')}</AppText>
              <View style={styles.gradeGrid}>
                 {QUALITY_GRADES.map(g => (
                   <TouchableOpacity 
                     key={g} 
                     style={[styles.gradeChip, { backgroundColor: colors.card, borderColor: qualityGrade === g ? colors.primary : colors.border }]}
                     onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setQualityGrade(g); }}
                   >
                     <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.gradeText, { color: qualityGrade === g ? colors.primary : colors.textSecondary }]} numberOfLines={1}>{t(`form.${g}`)}</AppText>
                   </TouchableOpacity>
                 ))}
              </View>

              {/* Supplier Selection */}
              <TouchableOpacity
                style={[styles.intelligenceBlock, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: 'row', alignItems: 'center' }]}
                onPress={() => { loadSuppliers(); setShowSupplierModal(true); }}
              >
                <Truck size={20} color={colors.primary} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <AppText variant="body" weight="bold" style={[styles.blockTitle, { color: colors.text }]} numberOfLines={2}>{t('form.supplier_label')}</AppText>
                  <AppText variant="body-sm" weight="medium" style={[styles.blockSub, { color: colors.textSecondary }]} numberOfLines={2}>
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
                      Haptics.impactAsync(Haptics.ImpactFeedbackType.Medium);
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
                  <ChevronDown size={18} color={colors.textSecondary} />
                )}
              </TouchableOpacity>

              <View style={[styles.intelligenceBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.blockHeader}>
                   <PhoneCall size={20} color={colors.primary} />
                   <View style={{ flex: 1 }}>
                     <AppText variant="body" weight="bold" style={[styles.blockTitle, { color: colors.text }]} numberOfLines={2}>{t('form.supplier_call_title')}</AppText>
                      <AppText variant="micro" weight="medium" style={{ color: colors.textSecondary, marginTop: 2 }} numberOfLines={2}>
                        {t('form.supplier_call_sub')}
                      </AppText>
                   </View>
                   <TouchableOpacity
                     onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSupplierCallEnabled(!supplierCallEnabled); }}
                     style={[styles.switch, { backgroundColor: supplierCallEnabled ? colors.text : colors.border }]}
                   >
                     <View style={[styles.switchThumb, { backgroundColor: colors.background, left: supplierCallEnabled ? 24 : 2 }]} />
                   </TouchableOpacity>
                </View>
                {supplierCallEnabled && (
                  <Animated.View entering={FadeInDown} style={{ marginTop: 12, gap: 8 }}>
                    <AppText variant="micro" weight="medium" style={{ color: colors.textSecondary, lineHeight: 16 }} numberOfLines={4}>
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

              <View style={[styles.intelligenceBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.blockHeader}>
                   <CreditCard size={20} color={colors.primary} />
                   <AppText variant="body" weight="bold" style={[styles.blockTitle, { color: colors.text }]} numberOfLines={2}>{t('form.supplier_credit')}</AppText>
                   <TouchableOpacity
                     onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCreditToggle(creditToggle === 'Yes' ? 'No' : 'Yes'); }}
                     style={[styles.switch, { backgroundColor: creditToggle === 'Yes' ? colors.text : colors.border }]}
                   >
                     <View style={[styles.switchThumb, { backgroundColor: colors.background, left: creditToggle === 'Yes' ? 24 : 2 }]} />
                   </TouchableOpacity>
                </View>
              </View>

              {creditToggle === 'Yes' && (
                <Animated.View entering={FadeInDown} style={styles.row}>
                   <View style={{ flex: 1, marginRight: 15 }}>
                      <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: colors.textSecondary, marginBottom: 8 }]} numberOfLines={1}>{t('common.phone')}</AppText>
                      <TextInput 
                        style={[styles.input, { color: colors.text, borderColor: errors.supplierPhone ? '#FF3B30' : colors.border }]} 
                        value={supplierPhone}
                        onChangeText={(val) => { setSupplierPhone(val); if (errors.supplierPhone) setErrors(prev => ({ ...prev, supplierPhone: '' })); }}
                        keyboardType="phone-pad"
                      />
                      {errors.supplierPhone && <AppText variant="caption" weight="medium" style={styles.errorText} numberOfLines={2}>{errors.supplierPhone}</AppText>}
                   </View>
                   <View style={{ flex: 1 }}>
                      <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.nodeLabel, { color: colors.textSecondary, marginBottom: 8 }]} numberOfLines={1}>{t('common.account')}</AppText>
                      <TextInput 
                        style={[styles.input, { color: colors.text, borderColor: errors.supplierAccount ? '#FF3B30' : colors.border }]} 
                        value={supplierAccount}
                        onChangeText={(val) => { setSupplierAccount(val); if (errors.supplierAccount) setErrors(prev => ({ ...prev, supplierAccount: '' })); }}
                        keyboardType="numeric"
                      />
                      {errors.supplierAccount && <AppText variant="caption" weight="medium" style={styles.errorText} numberOfLines={2}>{errors.supplierAccount}</AppText>}
                   </View>
                </Animated.View>
              )}
            </View>
          )}

          {/* Action Dock */}
          <View style={styles.actionDock}>
             {step > 1 && (
               <TouchableOpacity style={[styles.backBtn, { borderColor: colors.border }]} onPress={handleBack}>
                 <ChevronLeft size={20} color={colors.text} />
               </TouchableOpacity>
             )}
             <TouchableOpacity 
               style={[styles.nextBtn, { backgroundColor: colors.text, flex: 1 }]} 
               onPress={step < 4 ? handleNext : handleFinish}
             >
                 <AppText variant="body" weight="bold" shrink={false} style={[styles.nextBtnText, { color: colors.background }]} numberOfLines={1}>
                 {step < 4 ? t('form.continue_intake') : t('form.initialize_asset')}
               </AppText>
               <ArrowRight size={18} color={colors.background} />
             </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
      </KeyboardAvoidingView>

      <CustomDatePicker
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelectDate={(date) => { setRecordDate(date); setShowDatePicker(false); }}
        initialDate={recordDate}
      />

      <Modal visible={showCategoryModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowCategoryModal(false)}>
          <View style={[styles.categorySheet, { backgroundColor: colors.background }]}>
            <View style={styles.modalHandleRow}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            </View>
            <View style={styles.modalHeader}>
               <AppText variant="title" weight="bold" style={[styles.modalTitle, { color: colors.text }]} numberOfLines={2}>{t('form.category_intel')}</AppText>
               <TouchableOpacity onPress={() => setShowNewCategory(!showNewCategory)}>
                  <Plus size={24} color={colors.text} />
               </TouchableOpacity>
            </View>
            
            {showNewCategory && (
              <View style={styles.newCatInput}>
                 <TextInput 
                    style={[styles.input, { flex: 1, marginRight: 10, borderColor: colors.border, color: colors.text }]}
                    placeholder={t('form.new_domain')}
                    value={newCategoryName}
                    onChangeText={setNewCategoryName}
                 />
                  <TouchableOpacity
                    style={[styles.addBtn, { backgroundColor: colors.text }]}
                    onPress={async () => {
                      const name = newCategoryName.trim();
                      if (!name) return;
                      const exists = categories.some(c => c.name.toLowerCase() === name.toLowerCase());
                      if (exists) {
                        await dialog.alert({ title: t('common.error'), message: t('form.category_exists'), iconType: 'danger' });
                        return;
                      }
                      const newCat = { id: Date.now(), name, icon: '📦' };
                      setCategories([...categories, newCat]);
                      setSelectedCategory(newCat);
                      setNewCategoryName('');
                      setShowNewCategory(false);
                      setShowCategoryModal(false);
                    }}
                  >
                   <Check size={20} color={colors.background} />
                 </TouchableOpacity>
              </View>
            )}

            <ScrollView contentContainerStyle={styles.catScroll}>
              {categories.map(cat => (
                <TouchableOpacity 
                  key={cat.id} 
                  style={[styles.catItem, { borderColor: colors.border }]}
                  onPress={() => { setSelectedCategory(cat); setShowCategoryModal(false); Haptics.selectionAsync(); }}
                >
                  <AppText variant="heading" shrink={false} style={styles.catIcon}>{cat.icon}</AppText>
                  <AppText variant="body" weight="bold" style={[styles.catName, { color: colors.text }]} numberOfLines={2}>{cat.name.includes('category.') ? t(cat.name) : cat.name}</AppText>
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
          <Pressable style={[styles.categorySheet, { backgroundColor: colors.background }]}>
            <View style={styles.modalHandleRow}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            </View>
            
            <View style={styles.modalHeader}>
              <AppText variant="title" weight="bold" style={[styles.modalTitle, { color: colors.text }]} numberOfLines={2}>Select Supplier</AppText>
              <TouchableOpacity onPress={() => { setShowNewSupplierForm(!showNewSupplierForm); }}>
                <Plus size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* New Supplier Form */}
            {showNewSupplierForm && (
              <View style={{ paddingHorizontal: 25, marginBottom: 20, gap: 12 }}>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  placeholder={t('common.supplier_name_ph')}
                  placeholderTextColor={colors.textSecondary}
                  value={newSupplierName}
                  onChangeText={setNewSupplierName}
                />
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  placeholder={t('contacts.phone_ph')}
                  placeholderTextColor={colors.textSecondary}
                  value={newSupplierPhone}
                  onChangeText={setNewSupplierPhone}
                  keyboardType="phone-pad"
                />
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  placeholder={t('common.account_number_ph')}
                  placeholderTextColor={colors.textSecondary}
                  value={newSupplierAccount}
                  onChangeText={setNewSupplierAccount}
                  keyboardType="numeric"
                />
                <TouchableOpacity
                  style={[styles.addBtn, { backgroundColor: colors.text, alignSelf: 'flex-end' }]}
                  onPress={async () => {
                    if (!newSupplierName.trim()) {
                      await dialog.alert({ title: 'Error', message: 'Supplier name is required', iconType: 'danger' });
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
                      setShowSupplierModal(false);
                      setShowNewSupplierForm(false);
                      setNewSupplierName('');
                      setNewSupplierPhone('');
                      setNewSupplierAccount('');
                    }
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }}
                >
                  <Check size={20} color={colors.background} />
                </TouchableOpacity>
              </View>
            )}

            <ScrollView contentContainerStyle={styles.catScroll}>
              {suppliers.length === 0 && !showNewSupplierForm && (
                <View style={{ padding: 30, alignItems: 'center' }}>
                  <AppText variant="body" weight="medium" align="center" style={[styles.catName, { color: colors.textSecondary }]} numberOfLines={2}>No suppliers yet. Tap + to add one.</AppText>
                </View>
              )}
              {suppliers.map((sup) => (
                <TouchableOpacity
                  key={sup.id}
                  style={[styles.catItem, { borderColor: colors.border }]}
                  onPress={() => { setSelectedSupplier(sup); setShowSupplierModal(false); Haptics.selectionAsync(); }}
                >
                    <AppText variant="heading" shrink={false} style={styles.catIcon}>🚚</AppText>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <AppText variant="body" weight="bold" style={[styles.catName, { color: colors.text }]} numberOfLines={1}>{sup.fullName}</AppText>
                      {sup.phone && <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary }} numberOfLines={1}>{sup.phone}</AppText>}
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 25, paddingVertical: 15 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontFamily: Fonts.bold },
  stepContainer: { paddingHorizontal: 25, marginVertical: 15 },
  stepLine: { height: 4, borderRadius: 2, width: '100%', overflow: 'hidden' },
  stepProgress: { height: '100%' },
  stepLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  stepLabelItem: { alignItems: 'center' },
  stepDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 8 },
  stepLabelText: { fontSize: 10, fontFamily: Fonts.bold, textTransform: 'uppercase' },
  scrollContent: { padding: 25 },
  stepContent: { flex: 1 },
  formCard: { gap: 25 },
  cardTitle: { fontSize: 13, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 },
  inputNode: { gap: 10 },
  nodeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 5 },
  nodeLabel: { fontSize: 11, fontFamily: Fonts.bold, letterSpacing: 0.5 },
  input: { height: 60, borderRadius: 18, borderWidth: 1, paddingHorizontal: 20, fontSize: 16, fontFamily: Fonts.medium },
  inputText: { fontSize: 16, fontFamily: Fonts.medium },
  intelligenceBlock: { borderRadius: 24, padding: 20, borderWidth: 1, gap: 10 },
  blockHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  blockTitle: { flex: 1, fontSize: 15, fontFamily: Fonts.bold },
  blockSub: { fontSize: 12, fontFamily: Fonts.medium, lineHeight: 18 },
  switch: { width: 50, height: 28, borderRadius: 14, padding: 2, position: 'relative' },
  switchThumb: { width: 24, height: 24, borderRadius: 12, position: 'absolute', top: 2 },
  row: { flexDirection: 'row', alignItems: 'center' },
  financeSummary: { borderRadius: 24, padding: 20, borderWidth: 1, gap: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 13, fontFamily: Fonts.bold },
  summaryValue: { fontSize: 16, fontFamily: Fonts.bold },
  warningRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  warningText: { fontSize: 11, fontFamily: Fonts.bold, color: '#FF3B30' },
  errorText: { fontSize: 10, fontFamily: Fonts.semibold, color: '#FF3B30', marginTop: 4, marginLeft: 5 },
  advToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, borderRadius: 18, borderStyle: 'dashed', borderWidth: 1 },
  advToggleText: { fontSize: 14, fontFamily: Fonts.bold },
  inlineCategoryRow: { flexDirection: 'row', paddingVertical: 8, gap: 8 },
  inlineCategoryChip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, gap: 6 },
  inlineCategoryText: { fontSize: 13, fontFamily: Fonts.medium },
  gradeGrid: { flexDirection: 'row', gap: 10 },
  gradeChip: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  gradeText: { fontSize: 13, fontFamily: Fonts.bold },
  actionDock: { flexDirection: 'row', gap: 15, marginTop: 40 },
  backBtn: { width: 65, height: 65, borderRadius: 20, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  nextBtn: { height: 65, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  nextBtnText: { fontSize: 16, fontFamily: Fonts.bold },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  categorySheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingBottom: 40, maxHeight: '80%' },
  modalHandleRow: { alignItems: 'center', paddingTop: 15, paddingBottom: 10 },
  modalHandle: { width: 40, height: 4, borderRadius: 2 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 25, marginBottom: 20 },
  modalTitle: { fontSize: 18, fontFamily: Fonts.bold },
  newCatInput: { flexDirection: 'row', paddingHorizontal: 25, marginBottom: 20 },
  addBtn: { width: 60, height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  catScroll: { paddingHorizontal: 25 },
  catItem: { flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, gap: 15 },
  catIcon: { fontSize: 22 },
  catName: { flex: 1, fontSize: 16, fontFamily: Fonts.bold },
  successOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  successCard: { width: '85%', borderRadius: 32, padding: 35, alignItems: 'center', borderWidth: 1 },
  successIconCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  successTitle: { fontSize: 24, fontFamily: Fonts.bold, marginBottom: 8 },
  successSub: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 30 },
  vaultBtn: { width: '100%', height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  vaultBtnText: { fontSize: 16, fontFamily: Fonts.bold },
  addMoreBtn: { width: '100%', height: 60, borderRadius: 18, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  addMoreText: { fontSize: 16, fontFamily: Fonts.bold }
});

export default AddAssetFlow;