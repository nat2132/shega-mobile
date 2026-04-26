import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text as RNText,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  Alert,
  Platform,
  KeyboardAvoidingView
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
  Dolly,
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
  LayoutGrid
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { 
  insertItem, 
  insertCategory, 
  getCategories, 
  seedDefaultCategories, 
  insertPack 
} from '@/database/db';
import { useSettings } from '@/context/SettingsContext';
import { Fonts } from '@/constants/theme';
import { CustomDatePicker } from '@/components/CustomDatePicker';

const UNIT_OPTIONS = ['kg', 'm', 'litre', 'pieces', 'pack', 'can', 'roll', 'sqm', 'sqft', 'ml'];
const QUALITY_GRADES = ['grade1', 'grade2', 'grade3'];

export const DEFAULT_CATEGORIES = [
  { id: 1, name: 'category.fasteners', icon: '🔩' },
  { id: 2, name: 'category.measuring', icon: '📏' },
  { id: 3, name: 'category.hardware', icon: '🪚' },
  { id: 4, name: 'category.paint', icon: '🎨' },
  { id: 5, name: 'category.electrical', icon: '💡' },
  { id: 6, name: 'category.plumbing', icon: '🚰' },
  { id: 7, name: 'category.packing', icon: '📦' },
  { id: 8, name: 'category.cleaning', icon: '🧹' },
  { id: 9, name: 'category.safety', icon: '🛠️' },
  { id: 10, name: 'category.building', icon: '📐' },
  { id: 11, name: 'category.grocery', icon: '🥫' },
];

const AddAssetFlow = ({ onSuccess, onClose }: { onSuccess?: () => void, onClose?: () => void }) => {
  const { colors, t, calendarType, language, theme } = useSettings();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [unitSelectionMode, setUnitSelectionMode] = useState<'price' | 'pack'>('price');
  
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
  const [creditToggle, setCreditToggle] = useState<'Yes' | 'No'>('No');

  const [recordDate, setRecordDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadCategories = async () => {
      seedDefaultCategories(DEFAULT_CATEGORIES.map(c => ({ name: c.name, icon: c.icon })));
      const dbCats: any = await getCategories();
      if (dbCats && dbCats.length > 0) setCategories(dbCats);
    };
    loadCategories();
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
      if (!packPurchasePrice || Number(packPurchasePrice) < 0) currentErrors.purchasePrice = t('form.error_price_invalid');
      if (!baseSellingPrice || Number(baseSellingPrice) <= 0) currentErrors.sellingPrice = t('form.error_price_positive');
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
        supplierPhone: creditToggle === 'Yes' ? supplierPhone : null,
        supplierAccount: creditToggle === 'Yes' ? supplierAccount : null,
        createdAt: recordDate || undefined,
      };

      const insertedId = await insertItem(itemData);
      if (insertedId && hasPacks && allowSellByPack) {
        for (let i = 1; i <= Number(totalPackQuantity); i++) {
          await insertPack({ itemId: Number(insertedId), packNumber: i, quantity: Number(unitsPerPack), unit: baseUnit });
        }
      }
      setShowSuccess(true);
    } catch (e) {
      console.error(e);
      Alert.alert(t('common.error'), t('inventory.failed_to_save'));
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
            <RNText style={[styles.stepLabelText, { color: step > i ? colors.text : colors.textSecondary }]}>{label}</RNText>
          </View>
        ))}
      </View>
    </View>
  );

  const renderSuccessVault = () => (
    <Modal visible={showSuccess} transparent animationType="fade">
      <BlurView intensity={80} tint={theme === 'dark' ? 'dark' : 'light'} style={styles.successOverlay}>
        <Animated.View entering={FadeInUp} style={[styles.successCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.successIconCircle, { backgroundColor: colors.text }]}>
            <ShieldCheck size={48} color={colors.background} />
          </View>
          <RNText style={[styles.successTitle, { color: colors.text }]}>{t('form.asset_initialized')}</RNText>
          <RNText style={[styles.successSub, { color: colors.textSecondary }]}>{t('form.committed_to_vault', { name: itemName })}</RNText>
          
          <TouchableOpacity 
            style={[styles.vaultBtn, { backgroundColor: colors.text }]}
            onPress={() => { 
                setShowSuccess(false); 
                if (onSuccess) onSuccess(); 
                else if (onClose) onClose();
                else if (router.canGoBack()) router.back();
            }}
          >
            <RNText style={[styles.vaultBtnText, { color: colors.background }]}>{t('form.enter_vault')}</RNText>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.addMoreBtn, { borderColor: colors.text }]}
            onPress={() => { setShowSuccess(false); setStep(1); setItemName(''); setSelectedCategory(null); }}
          >
            <RNText style={[styles.addMoreText, { color: colors.text }]}>{t('form.init_another')}</RNText>
          </TouchableOpacity>
        </Animated.View>
      </BlurView>
    </Modal>
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
        <RNText style={[styles.headerTitle, { color: colors.text }]}>{t('form.intelligence_intake')}</RNText>
        <View style={{ width: 40 }} />
      </View>

      {renderStepIndicator()}

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown} key={step} style={styles.stepContent}>
          {step === 1 && (
            <View style={styles.formCard}>
              <RNText style={[styles.cardTitle, { color: colors.textSecondary }]}>{t('form.asset_identification')}</RNText>
              
              <View style={styles.inputNode}>
                <View style={styles.nodeHeader}>
                   <Tag size={14} color={colors.textSecondary} />
                   <RNText style={[styles.nodeLabel, { color: colors.textSecondary }]}>{t('form.official_name')}</RNText>
                </View>
                <TextInput 
                  style={[styles.input, { color: colors.text, borderColor: errors.itemName ? '#FF3B30' : colors.border }]} 
                  placeholder={t('form.search_placeholder_asset')} 
                  placeholderTextColor={colors.textSecondary}
                  value={itemName}
                  onChangeText={(val) => { setItemName(val); if (errors.itemName) setErrors(prev => ({ ...prev, itemName: '' })); }}
                />
                {errors.itemName && <RNText style={styles.errorText}>{errors.itemName}</RNText>}
              </View>

              <View style={styles.inputNode}>
                <View style={styles.nodeHeader}>
                   <LayoutGrid size={14} color={colors.textSecondary} />
                   <RNText style={[styles.nodeLabel, { color: colors.textSecondary }]}>{t('form.intel_category')}</RNText>
                </View>
                <TouchableOpacity 
                  style={[styles.input, { borderColor: errors.category ? '#FF3B30' : colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                  onPress={() => { setShowCategoryModal(true); if (errors.category) setErrors(prev => ({ ...prev, category: '' })); }}
                >
                  <RNText style={[styles.inputText, { color: selectedCategory ? colors.text : colors.textSecondary }]}>
                    {selectedCategory ? `${selectedCategory.icon} ${selectedCategory.name.includes('category.') ? t(selectedCategory.name) : selectedCategory.name}` : t('form.select_domain')}
                  </RNText>
                  <ChevronDown size={18} color={colors.textSecondary} />
                </TouchableOpacity>
                {errors.category && <RNText style={styles.errorText}>{errors.category}</RNText>}
              </View>

              <View style={styles.inputNode}>
                <View style={styles.nodeHeader}>
                   <Building2 size={14} color={colors.textSecondary} />
                   <RNText style={[styles.nodeLabel, { color: colors.textSecondary }]}>{t('form.brand')}</RNText>
                </View>
                <TextInput 
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]} 
                  placeholder={t('form.manufacturer_placeholder')} 
                  placeholderTextColor={colors.textSecondary}
                  value={companyName}
                  onChangeText={setCompanyName}
                />
              </View>
            </View>
          )}

          {step === 2 && (
            <View style={styles.formCard}>
              <RNText style={[styles.cardTitle, { color: colors.textSecondary }]}>{t('form.metrics_scaling')}</RNText>
              
              <View style={[styles.intelligenceBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.blockHeader}>
                   <Package size={20} color={colors.primary} />
                   <RNText style={[styles.blockTitle, { color: colors.text }]}>{t('form.box_roll_config')}</RNText>
                   <TouchableOpacity 
                     onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setHasPacks(!hasPacks); }}
                     style={[styles.switch, { backgroundColor: hasPacks ? colors.text : colors.border }]}
                   >
                     <View style={[styles.switchThumb, { backgroundColor: colors.background, left: hasPacks ? 24 : 2 }]} />
                   </TouchableOpacity>
                </View>
                <RNText style={[styles.blockSub, { color: colors.textSecondary }]}>{t('form.box_roll_desc')}</RNText>
              </View>

              <View style={styles.row}>
                {hasPacks && (
                  <View style={{ flex: 1, marginRight: 15 }}>
                     <RNText style={[styles.nodeLabel, { color: colors.textSecondary, marginBottom: 8 }]}>{t('form.bulk_unit')}</RNText>
                     <TouchableOpacity style={[styles.input, { borderColor: colors.border, justifyContent: 'center' }]} onPress={() => { setUnitSelectionMode('pack'); setShowUnitModal(true); }}>
                        <RNText style={[styles.inputText, { color: colors.text }]}>{t(`form.${purchaseUnit.toLowerCase()}`)}</RNText>
                     </TouchableOpacity>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                   <RNText style={[styles.nodeLabel, { color: colors.textSecondary, marginBottom: 8 }]}>{t('form.base_unit')}</RNText>
                   <TouchableOpacity style={[styles.input, { borderColor: colors.border, justifyContent: 'center' }]} onPress={() => { setUnitSelectionMode('price'); setShowUnitModal(true); }}>
                      <RNText style={[styles.inputText, { color: colors.text }]}>{t(`form.${baseUnit.toLowerCase()}`)}</RNText>
                   </TouchableOpacity>
                </View>
              </View>

              {hasPacks && (
                <View style={styles.inputNode}>
                   <RNText style={[styles.nodeLabel, { color: colors.textSecondary, marginBottom: 8 }]}>{t('form.conversion_ratio')}</RNText>
                   <TextInput 
                     style={[styles.input, { color: colors.text, borderColor: errors.unitsPerPack ? '#FF3B30' : colors.border, fontFamily: Fonts.bold }]} 
                     value={unitsPerPack}
                     onChangeText={(val) => { setUnitsPerPack(val); if (errors.unitsPerPack) setErrors(prev => ({ ...prev, unitsPerPack: '' })); }}
                     keyboardType="numeric"
                   />
                   {errors.unitsPerPack && <RNText style={styles.errorText}>{errors.unitsPerPack}</RNText>}
                </View>
              )}

              <View style={styles.inputNode}>
                 <RNText style={[styles.nodeLabel, { color: colors.textSecondary, marginBottom: 8 }]}>{t('form.initial_stock', { unit: hasPacks ? t(`form.${purchaseUnit.toLowerCase()}`) : t(`form.${baseUnit.toLowerCase()}`) })}</RNText>
                 <TextInput 
                   style={[styles.input, { color: colors.text, borderColor: errors.quantity ? '#FF3B30' : colors.border, fontFamily: Fonts.bold, fontSize: 18 }]} 
                   value={totalPackQuantity}
                   onChangeText={(val) => { setTotalPackQuantity(val); if (errors.quantity) setErrors(prev => ({ ...prev, quantity: '' })); }}
                   keyboardType="numeric"
                 />
                 {errors.quantity && <RNText style={styles.errorText}>{errors.quantity}</RNText>}
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={styles.formCard}>
              <RNText style={[styles.cardTitle, { color: colors.textSecondary }]}>{t('form.financial_strategy')}</RNText>
              
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 15 }}>
                    <RNText style={[styles.nodeLabel, { color: colors.textSecondary, marginBottom: 8 }]}>{hasPacks ? t('form.bulk_cost') : t('form.unit_cost')}</RNText>
                    <TextInput 
                      style={[styles.input, { color: colors.text, borderColor: errors.purchasePrice ? '#FF3B30' : colors.border, fontFamily: Fonts.bold }]} 
                      placeholder="0.00"
                      value={packPurchasePrice}
                      onChangeText={(val) => { setPackPurchasePrice(val); if (errors.purchasePrice) setErrors(prev => ({ ...prev, purchasePrice: '' })); }}
                      keyboardType="numeric"
                    />
                </View>
                <View style={{ flex: 1 }}>
                   <RNText style={[styles.nodeLabel, { color: colors.textSecondary, marginBottom: 8 }]}>
                     {hasPacks ? t('form.unit_selling_price') : t('form.unit_price')}
                   </RNText>
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
                <RNText style={[styles.errorText, { marginBottom: 10 }]}>
                  {errors.purchasePrice || errors.sellingPrice}
                </RNText>
              )}

              <View style={[styles.financeSummary, { backgroundColor: colors.card, borderColor: colors.border }]}>
                 <View style={styles.summaryRow}>
                    <RNText style={[styles.summaryLabel, { color: colors.textSecondary }]}>{t('form.profit_per', { unit: t(`form.${baseUnit.toLowerCase()}`) })}</RNText>
                    <RNText style={[styles.summaryValue, baseMargin > 0 ? { color: '#34C759' } : { color: '#FF3B30' }]}>
                       {(Number(baseSellingPrice) - baseCostPrice).toFixed(2)} {t('common.etb')}
                    </RNText>
                 </View>
                 <View style={styles.summaryRow}>
                    <RNText style={[styles.summaryLabel, { color: colors.textSecondary }]}>{t('form.intel_margin')}</RNText>
                    <RNText style={[styles.summaryValue, baseMargin > 0 ? { color: '#34C759' } : { color: '#FF3B30' }]}>
                       {baseMargin.toFixed(1)}%
                    </RNText>
                 </View>
                 {isLossDetected && (
                   <View style={styles.warningRow}>
                      <AlertCircle size={14} color="#FF3B30" />
                      <RNText style={styles.warningText}>{t('form.loss_detected', { cost: baseCostPrice.toFixed(2) })}</RNText>
                   </View>
                 )}
              </View>

              <TouchableOpacity 
                 style={[styles.advToggle, { borderColor: colors.border }]}
                 onPress={() => setAllowSellByPack(!allowSellByPack)}
              >
                 <RNText style={[styles.advToggleText, { color: colors.text }]}>{t('form.adv_bulk_selling')}</RNText>
                 <ChevronDown size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              
              {allowSellByPack && (
                <Animated.View entering={FadeInDown} style={styles.inputNode}>
                   <RNText style={[styles.nodeLabel, { color: colors.textSecondary, marginBottom: 8 }]}>{t('form.bulk_selling_price')}</RNText>
                   <TextInput 
                     style={[styles.input, { color: colors.text, borderColor: colors.border, fontFamily: Fonts.bold }]} 
                     placeholder={hasPacks && packPurchasePrice ? (Number(packPurchasePrice) * 1.2).toFixed(2) : "0.00"}
                     value={packSellingPrice}
                     onChangeText={setPackSellingPrice}
                     keyboardType="numeric"
                   />
                </Animated.View>
              )}
            </View>
          )}

          {step === 4 && (
            <View style={styles.formCard}>
              <RNText style={[styles.cardTitle, { color: colors.textSecondary }]}>{t('form.asset_assurance')}</RNText>

              {/* Record Date */}
              <TouchableOpacity 
                style={[styles.inputNode, { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 15 }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Calendar size={18} color={colors.primary} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <RNText style={[styles.nodeLabel, { color: colors.textSecondary, marginBottom: 2 }]}>{t('common.record_date')}</RNText>
                  <RNText style={[{ fontSize: 16, fontFamily: Fonts.bold, color: recordDate ? colors.text : colors.textSecondary }]}>
                    {recordDate || t('common.today')}
                  </RNText>
                </View>
                <ChevronDown size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              
              <View style={styles.inputNode}>
                <View style={styles.nodeHeader}>
                   <Calendar size={14} color={colors.textSecondary} />
                   <RNText style={[styles.nodeLabel, { color: colors.textSecondary }]}>{t('form.expiration_archive')}</RNText>
                </View>
                <TextInput 
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]} 
                  placeholder="DD/MM/YYYY" 
                  placeholderTextColor={colors.textSecondary}
                  value={expiryDate}
                  onChangeText={setExpiryDate}
                />
              </View>

              <RNText style={[styles.nodeLabel, { color: colors.textSecondary, marginBottom: 12 }]}>{t('form.quality_classification')}</RNText>
              <View style={styles.gradeGrid}>
                 {QUALITY_GRADES.map(g => (
                   <TouchableOpacity 
                     key={g} 
                     style={[styles.gradeChip, { backgroundColor: colors.card, borderColor: qualityGrade === g ? colors.primary : colors.border }]}
                     onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setQualityGrade(g); }}
                   >
                     <RNText style={[styles.gradeText, { color: qualityGrade === g ? colors.primary : colors.textSecondary }]}>{t(`form.${g}`)}</RNText>
                   </TouchableOpacity>
                 ))}
              </View>

              <View style={[styles.intelligenceBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.blockHeader}>
                   <CreditCard size={20} color={colors.primary} />
                   <RNText style={[styles.blockTitle, { color: colors.text }]}>{t('form.supplier_credit')}</RNText>
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
                      <RNText style={[styles.nodeLabel, { color: colors.textSecondary, marginBottom: 8 }]}>{t('common.phone')}</RNText>
                      <TextInput 
                        style={[styles.input, { color: colors.text, borderColor: colors.border }]} 
                        value={supplierPhone}
                        onChangeText={setSupplierPhone}
                        keyboardType="phone-pad"
                      />
                   </View>
                   <View style={{ flex: 1 }}>
                      <RNText style={[styles.nodeLabel, { color: colors.textSecondary, marginBottom: 8 }]}>{t('common.account')}</RNText>
                      <TextInput 
                        style={[styles.input, { color: colors.text, borderColor: colors.border }]} 
                        value={supplierAccount}
                        onChangeText={setSupplierAccount}
                        keyboardType="numeric"
                      />
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
               <RNText style={[styles.nextBtnText, { color: colors.background }]}>
                 {step < 4 ? t('form.continue_intake') : t('form.initialize_asset')}
               </RNText>
               <ArrowRight size={18} color={colors.background} />
             </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* MODALS */}
      {renderSuccessVault()}

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
               <RNText style={[styles.modalTitle, { color: colors.text }]}>{t('form.category_intel')}</RNText>
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
                   onPress={() => {
                     const newCat = { id: Date.now(), name: newCategoryName, icon: '📦' };
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
                  <RNText style={styles.catIcon}>{cat.icon}</RNText>
                  <RNText style={[styles.catName, { color: colors.text }]}>{cat.name.includes('category.') ? t(cat.name) : cat.name}</RNText>
                  {selectedCategory?.id === cat.id && <Check size={18} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showUnitModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowUnitModal(false)}>
          <View style={[styles.categorySheet, { backgroundColor: colors.background }]}>
            <View style={styles.modalHandleRow}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            </View>
            <RNText style={[styles.modalTitle, { color: colors.text, alignSelf: 'center', marginBottom: 20 }]}>{t('form.unit_scale')}</RNText>
            <ScrollView contentContainerStyle={styles.catScroll}>
               {UNIT_OPTIONS.map(u => (
                 <TouchableOpacity 
                    key={u} 
                    style={[styles.catItem, { borderColor: colors.border }]}
                    onPress={() => { 
                      if (unitSelectionMode === 'pack') setPurchaseUnit(u); 
                      else setBaseUnit(u); 
                      setShowUnitModal(false); 
                      Haptics.selectionAsync(); 
                    }}
                 >
                   <RNText style={[styles.catName, { color: colors.text }]}>{t(`form.${u.toLowerCase()}`)}</RNText>
                   {(unitSelectionMode === 'pack' ? purchaseUnit === u : baseUnit === u) && <Check size={18} color={colors.primary} />}
                 </TouchableOpacity>
               ))}
            </ScrollView>
          </View>
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
  advToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, borderRadius: 18, borderDash: 1, borderStyle: 'dashed', borderWidth: 1 },
  advToggleText: { fontSize: 14, fontFamily: Fonts.bold },
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