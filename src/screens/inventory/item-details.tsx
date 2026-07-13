import { CustomDatePicker } from '@/components/CustomDatePicker';
import PremiumActionModal from '@/components/PremiumActionModal';
import { AppNumber, AppText } from '@/components/ui';
import { Fonts } from '@/constants/theme';
import { useDialog } from '@/context/DialogContext';
import { useSettings } from '@/context/SettingsContext';
import { deleteItem, ItemData, updateItem } from '@/database/db';
import { playBad, playNice } from '@/services/soundService';
import { formatDate } from '@/utils/date-utils';
import * as Haptics from 'expo-haptics';
import {
  Activity,
  AlertCircle,
  Award,
  Boxes,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Edit2,
  FileText,
  History,
  Package,
  PhoneCall,
  ShieldCheck,
  Tag,
  Trash2,
  TrendingUp,
  User,
  X,
  Zap
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Linking,
  Modal,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useTutorial, TutorialTarget, TutorialButton, TutorialScrollView } from '@/tutorials';
import { itemDetailsTutorial } from '@/tutorials/definitions';
import { getInventoryGlass } from './glass-inventory';

const ItemDetailsScreen = ({ item, onClose }: { item: ItemData, onClose?: () => void }) => {
  const { colors, calendarType, language, t, theme } = useSettings();
  const G = getInventoryGlass(colors);
  const styles = useMemo(() => createStyles(G), [G]);
  const dialog = useDialog();
  const tutorial = useTutorial({ tutorial: itemDetailsTutorial });
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>(item);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showExpiryPicker, setShowExpiryPicker] = useState(false);

  if (!item) return null;

  const handleSave = () => {
    // Validate all editable fields before saving
    if (!editForm.name.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t('form.error_name_required'));
      return;
    }
    if (isNaN(editForm.basePurchasePrice) || editForm.basePurchasePrice < 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t('form.error_price_invalid'));
      return;
    }
    if (isNaN(editForm.baseSellingPrice) || editForm.baseSellingPrice <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t('form.error_price_positive'));
      return;
    }
    if (isNaN(editForm.totalBaseQuantity) || editForm.totalBaseQuantity < 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t('form.error_quantity_positive'));
      return;
    }
    if (isNaN(editForm.lowStockThreshold ?? 0) || (editForm.lowStockThreshold ?? 0) < 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(t('form.error_quantity_positive'));
      return;
    }
    if (editForm.expiryDate && editForm.expiryDate.trim()) {
      const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
      const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(editForm.expiryDate.trim()) && !isoRegex.test(editForm.expiryDate.trim())) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        alert(t('form.error_date_format'));
        return;
      }
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playNice();
    const success = updateItem(item.id, editForm);
    if (success) {
      setIsEditing(false);
      if (onClose) onClose();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      playBad();
      alert(t('common.error'));
    }
  };

  const handleDelete = () => {
    const success = deleteItem(item.id);
    if (success) {
      setShowDeleteConfirm(false);
      if (onClose) onClose();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      playBad();
      alert(t('common.error'));
    }
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditForm(item);
    setIsEditing(false);
  };

  const toggleEdit = () => {
    Haptics.selectionAsync();
    setIsEditing(true);
  };

  const profit = (editForm.baseSellingPrice - editForm.basePurchasePrice);
  const margin = editForm.basePurchasePrice > 0 ? (profit / editForm.basePurchasePrice) * 100 : 0;
  const expiryDateObj = editForm.expiryDate ? new Date(editForm.expiryDate) : null;
  const daysUntilExpiry = expiryDateObj ? Math.ceil((expiryDateObj.getTime() - Date.now()) / 86400000) : null;

  return (
    <View style={[styles.container, { backgroundColor: G.bg }]}>
      {/* Ambient glow washes */}
      <View style={[styles.glowWash1, { backgroundColor: G.mutedLight }]} />
      <View style={[styles.glowWash2, { backgroundColor: G.mutedLight }]} />
      <View style={[styles.glowWash3, { backgroundColor: G.mutedLight }]} />
      {/* Hero Header */}
      <TutorialTarget id="id-header" style={styles.heroContainer}>
         <View style={[styles.heroWash, { backgroundColor: G.fg + '05' }]} />
         <View style={styles.topActions}>
            <TouchableOpacity onPress={onClose} style={[styles.circleBtn, { backgroundColor: G.bg + '80' }]}>
               <ChevronLeft size={20} color={G.fg} />
            </TouchableOpacity>
            <TutorialButton tutorialId="item-details" screenName={t('screen.item_details')} />
            <View style={styles.row}>
               {isEditing ? (
                 <View style={styles.editActions}>
                    <TouchableOpacity onPress={handleCancel} style={[styles.circleBtn, { backgroundColor: colors.error + '15', marginRight: 10 }]}>
                       <X size={20} color={colors.error} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleSave} style={[styles.circleBtn, { backgroundColor: colors.success + '15' }]}>
                       <Check size={20} color={colors.success} />
                    </TouchableOpacity>
                 </View>
               ) : (
                 <View style={styles.editActions}>
                   <TouchableOpacity onPress={() => setShowDeleteConfirm(true)} style={[styles.circleBtn, { backgroundColor: colors.error + '15', marginRight: 10 }]}>
                       <Trash2 size={18} color={colors.error} />
                   </TouchableOpacity>
                   <TouchableOpacity onPress={toggleEdit} style={[styles.circleBtn, { backgroundColor: G.bg + '80' }]}>
                      <Edit2 size={18} color={G.fg} />
                   </TouchableOpacity>
                 </View>
               )}
            </View>
         </View>

         <Animated.View style={styles.heroContent}>
            <View style={[styles.assetIconBox, { backgroundColor: G.fg }]}>
               <Package size={32} color={G.bg} />
            </View>
            <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.heroSub, { color: G.fgSecondary }]} numberOfLines={1}>{t('detail.asset_blueprint')}</AppText>
            {isEditing ? (
              <TextInput
                style={[styles.heroInput, { color: G.fg }]}
                value={editForm.name}
                onChangeText={(t) => setEditForm((prev: any) => ({ ...prev, name: t }))}
                placeholder={t('form.official_name')}
                placeholderTextColor={G.fgSecondary}
              />
            ) : (
              <AppText variant="display" weight="bold" align="center" style={[styles.heroTitle, { color: G.fg }]} numberOfLines={3}>{editForm.name}</AppText>
            )}
            {isEditing ? (
              <TextInput
                style={[styles.heroSubInput, { color: G.fgSecondary, borderColor: G.border }]}
                value={editForm.companyName || ''}
                onChangeText={(t) => setEditForm((prev: any) => ({ ...prev, companyName: t }))}
                placeholder={t('inventory.company_name')}
                placeholderTextColor={G.fgSecondary}
              />
            ) : editForm.companyName ? (
              <AppText variant="caption" weight="bold" style={[styles.heroCompany, { color: G.fgSecondary }]} numberOfLines={1}>{editForm.companyName}</AppText>
            ) : null}
            {editForm.categoryName ? (
              <AppText variant="caption" weight="medium" style={[styles.heroCategory, { color: G.fgSecondary }]} numberOfLines={1}>{editForm.categoryName}</AppText>
            ) : null}
            <View style={[styles.statusBadge, { backgroundColor: editForm.totalBaseQuantity > 0 ? colors.success + '15' : colors.error + '15' }]}>
               <View style={[styles.statusDot, { backgroundColor: editForm.totalBaseQuantity > 0 ? colors.success : colors.error }]} />
               <AppText variant="micro" weight="bold" transform="uppercase" shrink={false} style={[styles.statusText, { color: editForm.totalBaseQuantity > 0 ? colors.success : colors.error }]} numberOfLines={1}>
                  {editForm.totalBaseQuantity > 0 ? t('dashboard.stats.stable').toUpperCase() : t('inventory.out_of_stock').toUpperCase()}
               </AppText>
            </View>
          </Animated.View>
       </TutorialTarget>

       <TutorialScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Supplier Call Card — only shown when supplierCallEnabled is on */}
        {editForm.supplierCallEnabled && (
          <Animated.View style={styles.section}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={async () => {
                const phone = (editForm.supplierPhone || '').toString().replace(/[^0-9+]/g, '');
                if (!phone) {
                  await dialog.alert({ title: t('common.error'), message: t('detail.no_supplier_phone'), iconType: 'danger' });
                  return;
                }
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                Linking.openURL(`tel:${phone}`).catch(async () => {
                  await dialog.alert({ title: t('common.error'), message: t('detail.could_not_call'), iconType: 'danger' });
                });
              }}
              style={{
                backgroundColor: G.fg,
                borderRadius: 24,
                padding: 20,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: G.bg + '20', justifyContent: 'center', alignItems: 'center' }}>
                <PhoneCall size={22} color={G.bg} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="body-sm" weight="bold" style={{ color: G.bg }} numberOfLines={2}>
                  {t('detail.call_supplier_cta')}
                </AppText>
                <AppText variant="caption" weight="medium" style={{ color: G.bg + 'B0', marginTop: 2 }} numberOfLines={1}>
                  {editForm.supplierPhone || t('detail.no_phone_set')}
                </AppText>
              </View>
              <ChevronRight size={18} color={G.bg + '90'} />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Advanced Details — collapsible */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            Haptics.selectionAsync();
            setShowAdvanced((prev) => !prev);
          }}
          style={[styles.advancedToggle, { backgroundColor: G.bgCard, borderColor: G.border }]}
        >
          <View style={styles.advancedToggleLeft}>
            <Award size={16} color={G.fgSecondary} />
            <AppText variant="caption" weight="bold" style={[styles.advancedToggleText, { color: G.fgSecondary }]} numberOfLines={1}>{t('detail.advanced_details')}</AppText>
          </View>
          <View style={[styles.advancedToggleIcon, { transform: [{ rotate: showAdvanced ? '180deg' : '0deg' }] }]}>
            <ChevronDown size={18} color={G.fgSecondary} />
          </View>
        </TouchableOpacity>

        {showAdvanced && (
          <>

          <Animated.View style={styles.section}>
            <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.sectionTitle, { color: G.fgSecondary }]} numberOfLines={1}>{t('detail.quality_grade')}</AppText>
            <View style={[styles.intelligenceBlock, { backgroundColor: G.bgCard, borderColor: G.border }]}>
              <View style={styles.node}>
                <View style={styles.nodeInfo}>
                  <Award size={16} color={G.fgSecondary} />
                  <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('inventory.quality_grade')}</AppText>
                </View>
                {isEditing ? (
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {['grade1', 'grade2', 'grade3'].map((g) => {
                      const isActive = editForm.qualityGrade === g;
                      return (
                        <TouchableOpacity
                          key={g}
                          style={[styles.gradeChip, { borderColor: G.border, backgroundColor: isActive ? G.fg : 'transparent' }]}
                          onPress={() => setEditForm((prev: any) => ({ ...prev, qualityGrade: g }))}
                        >
                          <AppText variant="caption" weight="bold" shrink={false} style={{ color: isActive ? G.bg : G.fgSecondary }} numberOfLines={1}>{t(`form.${g}`)}</AppText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <View style={[styles.miniBadge, { backgroundColor: G.accentGlass }]}>
                    <AppText variant="caption" weight="bold" transform="uppercase" shrink={false} style={[styles.badgeText, { color: G.fgSecondary }]} numberOfLines={1}>{editForm.qualityGrade ? t(`form.${editForm.qualityGrade}`) : t('common.none')}</AppText>
                  </View>
                )}
              </View>
            </View>
          </Animated.View>

          <Animated.View style={styles.section}>
            <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.sectionTitle, { color: G.fgSecondary }]} numberOfLines={1}>{t('detail.notes')}</AppText>
            <View style={[styles.intelligenceBlock, { backgroundColor: G.bgCard, borderColor: G.border }]}>
              <View style={styles.node}>
                <View style={styles.nodeInfo}>
                  <FileText size={16} color={G.fgSecondary} />
                  <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('common.notes')}</AppText>
                </View>
                {isEditing ? (
                  <TextInput
                    style={[styles.notesInput, { color: G.fg, borderColor: G.border }]}
                    value={editForm.notes || ''}
                    onChangeText={(t) => setEditForm((prev: any) => ({ ...prev, notes: t }))}
                    multiline
                    placeholder={t('inv.notes_ph')}
                    placeholderTextColor={G.fgSecondary}
                  />
                ) : (
                  <AppText variant="body-sm" weight="medium" style={[styles.nodeValue, { color: G.fg, maxWidth: 200 }]} numberOfLines={3}>{editForm.notes || t('common.none')}</AppText>
                )}
              </View>
            </View>
          </Animated.View>

          <Animated.View style={styles.section}>
            <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.sectionTitle, { color: G.fgSecondary }]} numberOfLines={1}>{t('detail.supplier_info')}</AppText>
            <View style={[styles.intelligenceBlock, { backgroundColor: G.bgCard, borderColor: G.border }]}>
              <View style={styles.node}>
                <View style={styles.nodeInfo}>
                  <PhoneCall size={16} color={G.fgSecondary} />
                  <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('inventory.supplier_phone')}</AppText>
                </View>
                {isEditing ? (
                  <TextInput
                    style={[styles.nodeInput, { color: G.fg, borderColor: G.border }]}
                    value={editForm.supplierPhone || ''}
                    onChangeText={(t) => setEditForm((prev: any) => ({ ...prev, supplierPhone: t }))}
                    keyboardType="phone-pad"
                  />
                ) : (
                  <AppText variant="body-sm" weight="bold" style={[styles.nodeValue, { color: G.fg }]} numberOfLines={1}>{editForm.supplierPhone || t('common.none')}</AppText>
                )}
              </View>
              <View style={styles.nodeDivider} />
              <View style={styles.node}>
                <View style={styles.nodeInfo}>
                  <User size={16} color={G.fgSecondary} />
                  <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('inventory.supplier_account')}</AppText>
                </View>
                {isEditing ? (
                  <TextInput
                    style={[styles.nodeInput, { color: G.fg, borderColor: G.border }]}
                    value={editForm.supplierAccount || ''}
                    onChangeText={(t) => setEditForm((prev: any) => ({ ...prev, supplierAccount: t }))}
                    keyboardType="numeric"
                  />
                ) : (
                  <AppText variant="body-sm" weight="bold" style={[styles.nodeValue, { color: G.fg }]} numberOfLines={1}>{editForm.supplierAccount || t('common.none')}</AppText>
                )}
              </View>
              <View style={styles.nodeDivider} />
              <View style={styles.node}>
                <View style={styles.nodeInfo}>
                  <ShieldCheck size={16} color={editForm.isCredit ? colors.warning : G.fgSecondary} />
                  <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('inventory.is_credit')}</AppText>
                </View>
                {isEditing ? (
                  <Switch
                    value={!!editForm.isCredit}
                    onValueChange={(v) => setEditForm((prev: any) => ({ ...prev, isCredit: v ? 1 : 0 }))}
                    trackColor={{ false: G.border, true: colors.warning + '60' }}
                    thumbColor={editForm.isCredit ? colors.warning : G.fgSecondary}
                  />
                ) : (
                  <AppText variant="body-sm" weight="bold" style={[styles.nodeValue, { color: editForm.isCredit ? colors.warning : G.fg }]} numberOfLines={1}>{editForm.isCredit ? t('common.yes') : t('common.no')}</AppText>
                )}
              </View>
              {editForm.supplierCallEnabled && (
                <>
                  <View style={styles.nodeDivider} />
                  <View style={styles.node}>
                    <View style={styles.nodeInfo}>
                      <PhoneCall size={16} color={colors.success} />
                      <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('inventory.supplier_call')}</AppText>
                    </View>
                    {isEditing ? (
                      <Switch
                        value={!!editForm.supplierCallEnabled}
                        onValueChange={(v) => setEditForm((prev: any) => ({ ...prev, supplierCallEnabled: v ? 1 : 0 }))}
                        trackColor={{ false: G.border, true: colors.success + '60' }}
                        thumbColor={editForm.supplierCallEnabled ? colors.success : G.fgSecondary}
                      />
                    ) : (
                      <AppText variant="body-sm" weight="bold" style={[styles.nodeValue, { color: colors.success }]} numberOfLines={1}>{t('common.enabled')}</AppText>
                    )}
                  </View>
                </>
              )}
            </View>
          </Animated.View>

          </>
        )}

        {/* Magnitude Cards */}
        <TutorialTarget id="id-stats">
        <Animated.View style={styles.row}>
           <View style={[styles.magnitudeCard, { backgroundColor: G.bgCard, borderColor: G.border }]}>
              <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.mLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('detail.unit_margin')}</AppText>
              <AppNumber value={margin} suffix="%" size="heading" style={styles.mValue} />
              <View style={styles.mFooter}>
                 <TrendingUp size={12} color={profit >= 0 ? colors.success : colors.error} />
                  <AppNumber value={profit} prefix={t('common.etb') + ' '} size="micro" style={styles.mFooterText} />
              </View>
           </View>
           <View style={{ width: 15 }} />
           <View style={[styles.magnitudeCard, { backgroundColor: G.bgCard, borderColor: G.border }]}>
              <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.mLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('detail.asset_value')}</AppText>
              <AppNumber value={editForm.baseSellingPrice * editForm.totalBaseQuantity} size="title" style={styles.mValue} />
              <View style={styles.mFooter}>
                 <DollarSign size={12} color={G.fgSecondary} />
                 <AppText variant="micro" weight="medium" style={[styles.mFooterText, { color: G.fgSecondary }]} numberOfLines={1}>{t('detail.potential_rev')}</AppText>
              </View>
            </View>
         </Animated.View>
         </TutorialTarget>

         {/* Intelligence Nodes */}
         <Animated.View style={styles.section}>
            <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.sectionTitle, { color: G.fgSecondary }]} numberOfLines={1}>{t('detail.financial_core')}</AppText>
           <View style={[styles.intelligenceBlock, { backgroundColor: G.bgCard, borderColor: G.border }]}>
              <View style={styles.node}>
                 <View style={styles.nodeInfo}>
                    <Tag size={16} color={G.fgSecondary} />
                    <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('inventory.purchase_price')}</AppText>
                 </View>
                 {isEditing ? (
                   <TextInput
                     style={[styles.nodeInput, { color: G.fg, borderColor: G.border }]}
                     value={String(editForm.basePurchasePrice)}
                     onChangeText={(t) => setEditForm((prev: any) => ({ ...prev, basePurchasePrice: Number(t) }))}
                     keyboardType="numeric"
                   />
                 ) : (
                    <AppNumber value={editForm.basePurchasePrice} prefix={t('common.etb') + ' '} size="body-sm" style={styles.nodeValue} />
                 )}
              </View>
              <View style={styles.nodeDivider} />
               <View style={styles.node}>
                  <View style={styles.nodeInfo}>
                     <Zap size={16} color={G.fgSecondary} />
                     <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('inventory.selling_price')}</AppText>
                  </View>
                  {isEditing ? (
                    <TextInput
                      style={[styles.nodeInput, { color: G.fg, borderColor: G.border }]}
                      value={String(editForm.baseSellingPrice)}
                      onChangeText={(t) => setEditForm((prev: any) => ({ ...prev, baseSellingPrice: Number(t) }))}
                      keyboardType="numeric"
                    />
                  ) : (
                     <AppNumber value={editForm.baseSellingPrice} prefix={t('common.etb') + ' '} size="body-sm" style={styles.nodeValue} />
                  )}
               </View>
               {editForm.hasPacks && (
                 <>
                   <View style={styles.nodeDivider} />
                   <View style={styles.node}>
                     <View style={styles.nodeInfo}>
                       <Boxes size={16} color={G.fgSecondary} />
                       <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('inventory.pack_purchase_price')}</AppText>
                     </View>
                     {isEditing ? (
                       <TextInput
                         style={[styles.nodeInput, { color: G.fg, borderColor: G.border }]}
                         value={String(editForm.packPurchasePrice || '')}
                         onChangeText={(t) => setEditForm((prev: any) => ({ ...prev, packPurchasePrice: Number(t) }))}
                         keyboardType="numeric"
                       />
                     ) : (
                       <AppNumber value={editForm.packPurchasePrice} prefix={t('common.etb') + ' '} size="body-sm" style={styles.nodeValue} />
                     )}
                   </View>
                   <View style={styles.nodeDivider} />
                   <View style={styles.node}>
                     <View style={styles.nodeInfo}>
                       <Boxes size={16} color={G.fgSecondary} />
                       <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('inventory.pack_selling_price')}</AppText>
                     </View>
                     {isEditing ? (
                       <TextInput
                         style={[styles.nodeInput, { color: G.fg, borderColor: G.border }]}
                         value={String(editForm.packSellingPrice || '')}
                         onChangeText={(t) => setEditForm((prev: any) => ({ ...prev, packSellingPrice: Number(t) }))}
                         keyboardType="numeric"
                       />
                     ) : (
                       <AppNumber value={editForm.packSellingPrice} prefix={t('common.etb') + ' '} size="body-sm" style={styles.nodeValue} />
                     )}
                   </View>
                 </>
               )}
           </View>
         </Animated.View>

         <TutorialTarget id="id-details">
         <Animated.View style={styles.section}>
            <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.sectionTitle, { color: G.fgSecondary }]} numberOfLines={1}>{t('detail.logistics_scale')}</AppText>
           <View style={[styles.intelligenceBlock, { backgroundColor: G.bgCard, borderColor: G.border }]}>
               <View style={styles.node}>
                  <View style={styles.nodeInfo}>
                     <Activity size={16} color={G.fgSecondary} />
                     <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('inventory.stock_status')}</AppText>
                  </View>
                  {isEditing ? (
                    <TextInput
                      style={[styles.nodeInput, { color: G.fg, borderColor: G.border }]}
                      value={String(editForm.totalBaseQuantity)}
                      onChangeText={(t) => setEditForm((prev: any) => ({ ...prev, totalBaseQuantity: Number(t) }))}
                      keyboardType="numeric"
                    />
                  ) : (
                     <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                       <AppNumber value={editForm.totalBaseQuantity} size="body-sm" style={styles.nodeValue} />
                       <AppText variant="micro" weight="medium" shrink={false} style={styles.curr} numberOfLines={1}>{editForm.baseUnit}</AppText>
                     </View>
                  )}
               </View>
               <View style={styles.nodeDivider} />
               <View style={styles.node}>
                  <View style={styles.nodeInfo}>
                     <Tag size={16} color={G.fgSecondary} />
                     <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('inventory.base_unit')}</AppText>
                  </View>
                  {isEditing ? (
                    <TextInput
                      style={[styles.nodeInput, { color: G.fg, borderColor: G.border }]}
                      value={editForm.baseUnit || ''}
                      onChangeText={(t) => setEditForm((prev: any) => ({ ...prev, baseUnit: t }))}
                    />
                  ) : (
                    <AppText variant="body-sm" weight="bold" style={[styles.nodeValue, { color: G.fg }]} numberOfLines={1}>{editForm.baseUnit}</AppText>
                  )}
               </View>
               <View style={styles.nodeDivider} />
               <View style={styles.node}>
                  <View style={styles.nodeInfo}>
                     <Package size={16} color={G.fgSecondary} />
                     <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('inventory.purchase_unit')}</AppText>
                  </View>
                  {isEditing ? (
                    <TextInput
                      style={[styles.nodeInput, { color: G.fg, borderColor: G.border }]}
                      value={editForm.purchaseUnit || ''}
                      onChangeText={(t) => setEditForm((prev: any) => ({ ...prev, purchaseUnit: t }))}
                    />
                  ) : (
                    <AppText variant="body-sm" weight="bold" style={[styles.nodeValue, { color: G.fg }]} numberOfLines={1}>{editForm.purchaseUnit || editForm.baseUnit}</AppText>
                  )}
                </View>
                <View style={styles.nodeDivider} />
                <View style={styles.node}>
                   <View style={styles.nodeInfo}>
                      <AlertCircle size={16} color={G.fgSecondary} />
                      <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('detail.low_threshold')}</AppText>
                   </View>
                   {isEditing ? (
                     <TextInput
                       style={[styles.nodeInput, { color: G.fg, borderColor: G.border }]}
                       value={String(editForm.lowStockThreshold || 0)}
                       onChangeText={(t) => setEditForm((prev: any) => ({ ...prev, lowStockThreshold: Number(t) }))}
                       keyboardType="numeric"
                     />
                   ) : (
                       <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                        <AppNumber value={editForm.lowStockThreshold} fallback="0" size="body-sm" style={styles.nodeValue} />
                        <AppText variant="micro" weight="medium" shrink={false} style={styles.curr} numberOfLines={1}>{editForm.baseUnit}</AppText>
                      </View>
                   )}
                </View>
                {editForm.hasPacks && (
                  <>
                    <View style={styles.nodeDivider} />
                    <View style={styles.node}>
                      <View style={styles.nodeInfo}>
                        <Boxes size={16} color={G.fgSecondary} />
                        <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('inventory.units_per_pack')}</AppText>
                      </View>
                      {isEditing ? (
                        <TextInput
                          style={[styles.nodeInput, { color: G.fg, borderColor: G.border }]}
                          value={String(editForm.unitsPerPack || 1)}
                          onChangeText={(t) => setEditForm((prev: any) => ({ ...prev, unitsPerPack: Number(t) }))}
                          keyboardType="numeric"
                        />
                      ) : (
                        <AppText variant="body-sm" weight="bold" style={[styles.nodeValue, { color: G.fg }]} numberOfLines={1}>{editForm.unitsPerPack} {editForm.baseUnit}/{t('form.pack')}</AppText>
                      )}
                    </View>
                    <View style={styles.nodeDivider} />
                    <View style={styles.node}>
                      <View style={styles.nodeInfo}>
                        <Boxes size={16} color={G.fgSecondary} />
                        <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('inventory.total_packs')}</AppText>
                      </View>
                     {isEditing ? (
                       <TextInput
                         style={[styles.nodeInput, { color: G.fg, borderColor: G.border }]}
                         value={String(editForm.totalPackQuantity || 0)}
                         onChangeText={(t) => setEditForm((prev: any) => ({ ...prev, totalPackQuantity: Number(t) }))}
                         keyboardType="numeric"
                       />
                     ) : (
                       <AppNumber value={editForm.totalPackQuantity} size="body-sm" style={styles.nodeValue} />
                     )}
                   </View>
                 </>
               )}
            </View>
          </Animated.View>
          </TutorialTarget>

          <TutorialTarget id="id-history">
          <Animated.View style={styles.section}>
            <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.sectionTitle, { color: G.fgSecondary }]} numberOfLines={1}>{t('detail.temporal_audit')}</AppText>
           <View style={[styles.intelligenceBlock, { backgroundColor: G.bgCard, borderColor: G.border }]}>
              <View style={styles.node}>
                 <View style={styles.nodeInfo}>
                    <Calendar size={16} color={G.fgSecondary} />
                    <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('inventory.expiring')}</AppText>
                 </View>
                 {isEditing ? (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setShowExpiryPicker(true)}
                      style={[styles.nodeInput, { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }]}
                    >
                      <AppText variant="body-sm" weight="bold" style={{ color: editForm.expiryDate ? G.fg : G.fgSecondary }} numberOfLines={1}>
                        {editForm.expiryDate ? editForm.expiryDate : t('inv.date_format_iso')}
                      </AppText>
                      <Calendar size={16} color={G.fgSecondary} />
                    </TouchableOpacity>
                  ) : (
                    <AppText variant="body-sm" weight="bold" style={[styles.nodeValue, { color: G.fg }]} numberOfLines={1}>
                      {editForm.expiryDate ? formatDate(new Date(editForm.expiryDate), calendarType, language) : t('common.none').toUpperCase()}
                    </AppText>
                  )}
               </View>
               <View style={styles.nodeDivider} />
               <View style={styles.node}>
                  <View style={styles.nodeInfo}>
                     <AlertCircle size={16} color={daysUntilExpiry !== null && daysUntilExpiry <= 0 ? colors.error : daysUntilExpiry !== null && daysUntilExpiry <= 30 ? colors.warning : G.fgSecondary} />
                     <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('inventory.days_remaining')}</AppText>
                  </View>
                  {daysUntilExpiry !== null ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={[styles.statusDot, { backgroundColor: daysUntilExpiry <= 0 ? colors.error : daysUntilExpiry <= 30 ? colors.warning : colors.success }]} />
                      <AppText variant="body-sm" weight="bold" style={[styles.nodeValue, { color: daysUntilExpiry <= 0 ? colors.error : daysUntilExpiry <= 30 ? colors.warning : colors.success }]} numberOfLines={1}>
                        {daysUntilExpiry <= 0 ? `${Math.abs(daysUntilExpiry)} ${t('inventory.days_ago')}` : `${daysUntilExpiry} ${t('inventory.days_left')}`}
                      </AppText>
                    </View>
                  ) : (
                    <AppText variant="body-sm" weight="bold" style={[styles.nodeValue, { color: G.fgSecondary }]} numberOfLines={1}>{t('common.none')}</AppText>
                  )}
               </View>
               <View style={styles.nodeDivider} />
               <View style={styles.node}>
                  <View style={styles.nodeInfo}>
                     <History size={16} color={G.fgSecondary} />
                     <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('detail.committed_on')}</AppText>
                  </View>
                  <AppText variant="body-sm" weight="bold" style={[styles.nodeValue, { color: G.fg }]} numberOfLines={1}>
                    {editForm.createdAt ? formatDate(new Date(editForm.createdAt), calendarType, language) : t('common.none').toUpperCase()}
                  </AppText>
               </View>
            </View>
          </Animated.View>
          </TutorialTarget>

         <View style={{ height: 100 }} />
       </TutorialScrollView>

      {/* Action Float */}
      <TutorialTarget id="id-actions">
      <View style={[styles.actionFloat, { backgroundColor: colors.background }]}>
         <TouchableOpacity 
            style={[styles.primaryAction, { backgroundColor: G.fg }]}
            onPress={isEditing ? handleSave : () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setIsEditing(true); }}
         >
            {isEditing ? (
              <ShieldCheck size={20} color={G.bg} />
            ) : (
              <Edit2 size={18} color={G.bg} />
            )}
            <AppText variant="body" weight="bold" shrink={false} style={[styles.actionText, { color: G.bg }]} numberOfLines={1}>
              {isEditing ? t('detail.commit_blueprint') : t('detail.modify_asset')}
            </AppText>
         </TouchableOpacity>
      </View>
      </TutorialTarget>

      <CustomDatePicker
        visible={showExpiryPicker}
        onClose={() => setShowExpiryPicker(false)}
        onSelectDate={(date) => setEditForm((prev: any) => ({ ...prev, expiryDate: date }))}
        initialDate={(() => {
          if (!editForm.expiryDate) return undefined;
          const match = editForm.expiryDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
          if (match) return `${match[3]}-${match[2]}-${match[1]}`;
          return editForm.expiryDate;
        })()}
      />

      <Modal visible={showDeleteConfirm} transparent animationType="fade">
        <PremiumActionModal
          title={t('detail.delete_title')}
          subtitle={t('detail.delete_confirm')}
          actionText={t('common.delete')}
          cancelText={t('common.cancel')}
          iconType="danger"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      </Modal>

    </View>
  );
};

const createStyles = (G: any) => StyleSheet.create({
  container: { flex: 1 },
  heroContainer: { height: 320, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 25, position: 'relative' },
  heroWash: { position: 'absolute', top: 0, left: 0, right: 0, height: 260, borderBottomLeftRadius: 40, borderBottomRightRadius: 40 },
  topActions: { position: 'absolute', top: 50, left: 25, right: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 },
  circleBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  heroContent: { alignItems: 'center' },
  assetIconBox: { width: 70, height: 70, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 15, shadowColor: G.fg, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 5, backgroundColor: G.bgCard },
  heroSub: { fontSize: 13, fontFamily: Fonts.bold, letterSpacing: 1.5, marginBottom: 5 },
  heroTitle: { fontSize: 32, fontFamily: Fonts.bold, letterSpacing: -1, textAlign: 'center' },
  heroInput: { fontSize: 24, fontFamily: Fonts.bold, textAlign: 'center', borderWidth: 1, borderColor: G.border, borderRadius: 12, paddingHorizontal: 20, minWidth: 200, backgroundColor: G.bgCard },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginTop: 12 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontFamily: Fonts.bold },
  heroSubInput: { fontSize: 14, fontFamily: Fonts.medium, textAlign: 'center', borderWidth: 1, borderColor: G.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 4, minWidth: 180, marginTop: 4, backgroundColor: G.bgCard },
  heroCompany: { fontSize: 13, fontFamily: Fonts.medium, marginTop: 4, opacity: 0.8 },
  heroCategory: { fontSize: 12, fontFamily: Fonts.medium, marginTop: 2, opacity: 0.6 },
  miniBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  badgeText: { fontSize: 11, fontFamily: Fonts.bold },
  gradeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  notesInput: { fontSize: 14, fontFamily: Fonts.medium, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, minWidth: 160, maxHeight: 80, textAlignVertical: 'top' },
  scrollContent: { padding: 25, flexGrow: 1, paddingBottom: 120 },
  row: { flexDirection: 'row', gap: 15 },
  magnitudeCard: { flex: 1, borderRadius: 24, padding: 20, borderWidth: 1, marginBottom: 30, overflow: 'hidden' },
  mLabel: { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 0.5, marginBottom: 8 },
  mValue: { fontSize: 22, fontFamily: Fonts.bold },
  mFooter: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  mFooterText: { fontSize: 10, fontFamily: Fonts.bold, textTransform: 'uppercase' },
  section: { marginBottom: 30 },
  sectionTitle: { fontSize: 12, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginLeft: 5 },
  advancedToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14, borderRadius: 24, borderWidth: 1, marginBottom: 30 },
  advancedToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  advancedToggleText: { fontSize: 13, fontFamily: Fonts.bold },
  advancedToggleIcon: { },
  intelligenceBlock: { borderRadius: 28, padding: 20, borderWidth: 1, overflow: 'hidden' },
  node: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  nodeInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nodeLabel: { fontSize: 13, fontFamily: Fonts.bold },
  nodeValue: { fontSize: 16, fontFamily: Fonts.bold },
  nodeInput: { fontSize: 15, fontFamily: Fonts.bold, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, minWidth: 100, textAlign: 'right', backgroundColor: G.bgCard },
  curr: { fontSize: 11, fontFamily: Fonts.medium, opacity: 0.6 },
  nodeDivider: { height: 1, backgroundColor: G.border, marginVertical: 4 },
  actionFloat: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 25, paddingTop: 20, paddingBottom: 40 },
  primaryAction: { height: 65, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, shadowColor: G.fg, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10, overflow: 'hidden' },
  actionText: { fontSize: 16, fontFamily: Fonts.bold, letterSpacing: 0.5 },
  editActions: { flexDirection: 'row', alignItems: 'center' },
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

export default ItemDetailsScreen;