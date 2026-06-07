import { Fonts } from '@/constants/theme';
import { PROFILE_IMAGES, useSettings } from '@/context/SettingsContext';
import { useDialog } from '@/context/DialogContext';
import { clearDatabase } from '@/database/db';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, {
    FadeInDown,
} from 'react-native-reanimated';

import {
    ArrowUpRight,
    BadgeCheck,
    Bell,
    Calendar,
    ChevronRight,
    Clock,
    CloudDownload,
    Database,
    HelpCircle,
    Languages,
    Palette,
    Shield,
    Trash2,
} from 'lucide-react-native';

import CalendarSettingsScreen from './calendar';
import NotificationSettingsScreen from './notification';
import ProfileSettingsScreen from './profile-settings';
import SecuritySettingsScreen from './security';
import SupportScreen from './support';
import TimeSystemSettingsScreen from './time-system';
import TranslationSettingsScreen from './translation';
import { DataTransferModal } from '@/components/DataTransferModal';
import { AppText, AppListItem, AppCard, AppButton, AppRow } from '@/components/ui';
import { BorderRadius, Spacing } from '@/constants/theme';
// ─── Shared Sub-Components ───────────────────────────────────────────────────

interface SettingItemProps {
  icon: any;
  title: string;
  subtitle?: string;
  type?: 'toggle' | 'link';
  value?: boolean;
  onValueChange?: (v: boolean) => void;
  onPress?: () => void;
  danger?: boolean;
}

const ConfigurationGridItem = ({ icon: Icon, title, onPress, color }: { icon: any, title: string, onPress: () => void, color: string }) => {
  const { colors } = useSettings();
  return (
    <TouchableOpacity
      style={[styles.gridItem, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.gridIconBox, { backgroundColor: color + '15' }]}>
        <Icon size={22} color={color} strokeWidth={2.5} />
      </View>
      <AppText variant="body" weight="bold" style={[styles.gridTitle, { color: colors.text }]} numberOfLines={2}>{title}</AppText>
      <ChevronRight size={14} color={colors.textSecondary} style={styles.gridChevron} />
    </TouchableOpacity>
  );
};

const SettingLedgerItem = ({ icon: Icon, title, subtitle, onPress, danger }: SettingItemProps) => {
  const { colors } = useSettings();
  return (
    <AppListItem
      left={
        <View style={[styles.ledgerIconBox, { backgroundColor: danger ? '#FF3B3015' : colors.surface }]}>
          <Icon size={18} color={danger ? '#FF3B30' : colors.text} strokeWidth={2.5} />
        </View>
      }
      title={title}
      subtitle={subtitle}
      subtitleMaxLines={1}
      titleMaxLines={1}
      right={<ChevronRight size={16} color={colors.textSecondary} />}
      onPress={onPress}
      noBorder
      padding={Spacing.md}
      style={{ backgroundColor: 'transparent' }}
    />
  );
};

// ─── Theme Data ──────────────────────────────────────────────────────────────

const THEME_OPTIONS = [
  {
    id: 'light' as const,
    label: 'theme.light',
    subtitle: 'theme.light_sub',
    bg: '#FFFFFF',
    card: '#F9F9F9',
    accent: '#000000',
    highlight: '#FFC107',
    text: '#000000',
  },
  {
    id: 'dark' as const,
    label: 'theme.dark',
    subtitle: 'theme.dark_sub',
    bg: '#000000',
    card: '#1C1C1E',
    accent: '#FFFFFF',
    highlight: '#FF9500',
    text: '#FFFFFF',
  },
  {
    id: 'midnight' as const,
    label: 'theme.midnight',
    subtitle: 'theme.midnight_sub',
    bg: '#0B1220',
    card: '#172033',
    accent: '#2F6FED',
    highlight: '#E6B85C',
    text: '#EAF1FF',
  },
  {
    id: 'emerald' as const,
    label: 'theme.emerald',
    subtitle: 'theme.emerald_sub',
    bg: '#0E1A16',
    card: '#16241F',
    accent: '#1F8A70',
    highlight: '#EAD2A6',
    text: '#F3F7F6',
  },
  {
    id: 'charcoal' as const,
    label: 'theme.charcoal',
    subtitle: 'theme.charcoal_sub',
    bg: '#121212',
    card: '#1E1E1E',
    accent: '#B23A48',
    highlight: '#F4A261',
    text: '#F1F1F1',
  },
  {
    id: 'slate' as const,
    label: 'theme.slate',
    subtitle: 'theme.slate_sub',
    bg: '#0F0F14',
    card: '#1A1A22',
    accent: '#7C5CFF',
    highlight: '#F2C14E',
    text: '#EAEAF0',
  },
  {
    id: 'cocoa' as const,
    label: 'theme.cocoa',
    subtitle: 'theme.cocoa_sub',
    bg: '#14110F',
    card: '#201A17',
    accent: '#C97C5D',
    highlight: '#F1E3D3',
    text: '#F8F5F2',
  },
];

// ─── Theme Card Component ────────────────────────────────────────────────────

const ThemeCard = ({
  item,
  isActive,
  onPress,
}: {
  item: (typeof THEME_OPTIONS)[0];
  isActive: boolean;
  onPress: () => void;
}) => {
  const { t } = useSettings();
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={[
        themeCardStyles.card,
        { backgroundColor: item.bg, borderColor: isActive ? item.accent : 'transparent' },
      ]}
    >
      {/* Mini Preview */}
      <View style={themeCardStyles.preview}>
        <View style={[themeCardStyles.topBar, { backgroundColor: item.card }]}>
          <View style={[themeCardStyles.dot, { backgroundColor: item.accent }]} />
          <View style={[themeCardStyles.barLine, { backgroundColor: item.text, opacity: 0.25 }]} />
        </View>

        <View style={[themeCardStyles.contentArea, { backgroundColor: item.card }]}>
          <View style={[themeCardStyles.accentLine, { backgroundColor: item.accent }]} />
          <View style={{ flexDirection: 'row', gap: 4, marginTop: 5 }}>
            <View style={[themeCardStyles.smallBlock, { backgroundColor: item.highlight, opacity: 0.9 }]} />
            <View style={[themeCardStyles.smallBlock, { backgroundColor: item.text, opacity: 0.15 }]} />
          </View>
          <View style={[themeCardStyles.textLine, { backgroundColor: item.text, opacity: 0.12 }]} />
        </View>

        <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
          <View style={[themeCardStyles.statBlock, { backgroundColor: item.card }]}>
            <View style={[themeCardStyles.statDot, { backgroundColor: item.accent }]} />
          </View>
          <View style={[themeCardStyles.statBlock, { backgroundColor: item.card }]}>
            <View style={[themeCardStyles.statDot, { backgroundColor: item.highlight }]} />
          </View>
        </View>
      </View>

      <AppText variant="body" weight="bold" style={[themeCardStyles.label, { color: item.text }]} numberOfLines={1}>{t(item.label)}</AppText>
      <AppText variant="body-sm" weight="medium" style={[themeCardStyles.subtitle, { color: item.text, opacity: 0.5 }]} numberOfLines={2}>{t(item.subtitle)}</AppText>

      {isActive && (
        <View style={[themeCardStyles.activeBadge, { backgroundColor: item.accent }]}>
          <View style={themeCardStyles.activeInner} />
        </View>
      )}
    </TouchableOpacity>
  );
};

// ─── Reset Modal ─────────────────────────────────────────────────────────────

const ResetModal = ({
  visible, onClose, pin
}: { visible: boolean; onClose: () => void; pin: string | null }) => {
  const { colors, t } = useSettings();
  const dialog = useDialog();
  const [enteredPin, setEnteredPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (pin && enteredPin !== pin) {
      await dialog.alert({ title: t('common.error'), message: t('settings.pin_invalid'), iconType: 'danger' });
      return;
    }
    if (!pin) {
      const ok = await dialog.confirm({
        title: t('settings.no_pin'),
        message: t('settings.reset_msg'),
        confirmText: t('common.delete'),
        cancelText: t('common.cancel'),
        destructive: true,
        iconType: 'danger',
      });
      if (!ok) return;
      await doReset();
      return;
    }
    await doReset();
  };

  const doReset = async () => {
    setLoading(true);
    const success = clearDatabase();
    setLoading(false);
    if (success) {
      setEnteredPin('');
      onClose();
      await dialog.alert({ title: `✅ ${t('settings.reset_success')}`, message: t('settings.reset_fresh'), iconType: 'success' });
    } else {
      await dialog.alert({ title: t('common.error'), message: t('common.error'), iconType: 'danger' });
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={resetStyles.overlay}>
        <View style={[resetStyles.box, { backgroundColor: colors.card }]}>
          <View style={resetStyles.iconCircle}>
            <Trash2 size={28} color="#FF3B30" />
          </View>
          <AppText variant="title" weight="bold" style={[resetStyles.title, { color: colors.text }]} numberOfLines={2}>{t('settings.reset_title')}</AppText>
          <AppText variant="body" weight="medium" style={[resetStyles.message, { color: colors.textSecondary }]} numberOfLines={4}>
            {t('settings.reset_msg')}{'\n'}
            {pin ? t('settings.reset_confirm_pin') : ''}
          </AppText>

          {pin ? (
            <TextInput
              style={[resetStyles.pinInput, { color: colors.text, borderColor: colors.border }]}
              value={enteredPin}
              onChangeText={setEnteredPin}
              placeholder={t('security.current_pin')}
              secureTextEntry
              keyboardType="number-pad"
              maxLength={4}
              placeholderTextColor={colors.textSecondary}
            />
          ) : null}

          <TouchableOpacity
            style={resetStyles.confirmBtn}
            onPress={handleReset}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#FFF" />
              : <AppText variant="body" weight="bold" style={resetStyles.confirmBtnText} numberOfLines={1}>{t('settings.reset_btn')}</AppText>}
          </TouchableOpacity>
          <TouchableOpacity style={resetStyles.cancelBtn} onPress={onClose}>
            <AppText variant="body" weight="bold" style={resetStyles.cancelBtnText} numberOfLines={1}>{t('common.cancel')}</AppText>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ─── Bottom Sheet Wrapper ─────────────────────────────────────────────────────

const BottomSheet = ({ visible, onClose, children }: any) => {
  const { colors } = useSettings();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.bottomSheetContainer, { height: Dimensions.get('window').height * 0.88, backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}><View style={[styles.modalHandle, { backgroundColor: colors.border }]} /></View>
          <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ─── Main Settings Screen ─────────────────────────────────────────────────────

const SettingsScreen = () => {
  const { theme, setTheme, userProfile, pin, colors, t } = useSettings();

  const [showProfile, setShowProfile] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTimeSystem, setShowTimeSystem] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);


  const handleOpenSub = (setter: (v: boolean) => void) => {
    Haptics.selectionAsync();
    setter(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Background Decor */}
      <View style={StyleSheet.absoluteFill}>
        <View style={[styles.bgWash, { top: -100, right: -100, backgroundColor: colors.primary, opacity: 0.05 }]} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Integrated Header */}
        <View style={styles.integratedHeader}>
          <View>
  <AppText variant="body" weight="medium" style={[styles.headerLabel, { color: colors.textSecondary }]} numberOfLines={2}>{t('settings.system_pref')}</AppText>
  <AppText variant="display" weight="bold" style={[styles.headerTitle, { color: colors.text }]} numberOfLines={2}>{t('settings.configuration')}</AppText>
          </View>
          <View style={[styles.headerIconBox, { borderColor: colors.border }]}>
             <Shield size={24} color={colors.text} />
          </View>
        </View>

        {/* Elite Profile Banner */}
        <Animated.View entering={FadeInDown.duration(600)} style={styles.bannerSection}>
          <TouchableOpacity 
            activeOpacity={0.9} 
            onPress={() => handleOpenSub(setShowProfile)}
            style={[styles.profileBanner, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={styles.bannerAvatarBox}>
              <Image source={userProfile.avatarUri ? { uri: userProfile.avatarUri } : PROFILE_IMAGES[userProfile.avatarIndex >= 0 ? userProfile.avatarIndex : 0]} style={styles.bannerAvatar} />
              <View style={[styles.badgeOverlay, { backgroundColor: colors.text }]}>
                <BadgeCheck size={16} color={colors.background} fill={colors.background} />
              </View>
            </View>
            <View style={styles.bannerInfo}>
            <AppText variant="title" weight="bold" style={[styles.bannerName, { color: colors.text }]} numberOfLines={2}>{userProfile.name}</AppText>
            <AppText variant="body-sm" weight="medium" style={[styles.bannerBusiness, { color: colors.textSecondary }]} numberOfLines={1}>{userProfile.businessName}</AppText>
              <View style={[styles.profileLinkBtn, { backgroundColor: colors.text + '10' }]}>
                <AppText variant="caption" weight="bold" style={[styles.profileLinkText, { color: colors.text }]} numberOfLines={1}>{t('profile.edit')}</AppText>
                <ArrowUpRight size={14} color={colors.text} />
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Service Intelligence Grid */}
        <View style={styles.gridSection}>
          <View style={styles.gridRow}>
            <ConfigurationGridItem 
              icon={Shield} 
              title={t('settings.security')} 
              onPress={() => handleOpenSub(setShowSecurity)} 
              color={colors.primary}
            />
            <ConfigurationGridItem 
              icon={Bell} 
              title={t('settings.notifications')} 
              onPress={() => handleOpenSub(setShowNotification)} 
              color="#FF9500"
            />
          </View>
          <View style={styles.gridRow}>
            <ConfigurationGridItem 
              icon={Languages} 
              title={t('settings.language')} 
              onPress={() => handleOpenSub(setShowTranslation)} 
              color="#5856D6"
            />
            <ConfigurationGridItem 
              icon={Calendar} 
              title={t('settings.date_format')} 
              onPress={() => handleOpenSub(setShowCalendar)} 
              color="#FF2D55"
            />
            <ConfigurationGridItem
              icon={Clock}
              title={t('settings.time_format')}
              onPress={() => handleOpenSub(setShowTimeSystem)}
              color="#34C759"
            />
          </View>
        </View>

        {/* The Palette — Theme Selection */}
        <View style={styles.paletteSection}>
          <View style={styles.sectionHead}>
            <View>
          <AppText variant="heading" weight="bold" style={[styles.sectionTitle, { color: colors.text }]} numberOfLines={2}>{t('settings.palette')}</AppText>
          <AppText variant="body-sm" weight="medium" style={[styles.sectionSub, { color: colors.textSecondary }]} numberOfLines={2}>{t('settings.theme_subtitle')}</AppText>
            </View>
            <Palette size={20} color={colors.textSecondary} />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.paletteScrollContent}
          >
            {THEME_OPTIONS.map((item) => (
              <ThemeCard
                key={item.id}
                item={item}
                isActive={theme === item.id}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setTheme(item.id);
                }}
              />
            ))}
          </ScrollView>
        </View>

        {/* Advanced System Ledger */}
        <View style={styles.ledgerSection}>
          <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.ledgerHeader, { color: colors.textSecondary }]} numberOfLines={1}>{t('settings.advanced')}</AppText>
          <View style={[styles.ledgerGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
             <SettingLedgerItem 
                icon={Database} 
                title={t('settings.export_data')} 
                subtitle={t('settings.export_desc')}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowExportModal(true); }}
             />
             <SettingLedgerItem 
                icon={CloudDownload} 
                title={t('settings.import_data')} 
                subtitle={t('settings.import_desc')}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowImportModal(true); }}
             />
             <SettingLedgerItem 
                icon={HelpCircle} 
                title={t('support.contact')} 
                onPress={() => handleOpenSub(setShowSupport)}
             />
             <SettingLedgerItem 
                icon={Trash2} 
                title={t('settings.reset_app')} 
                subtitle={t('settings.reset_desc_advanced')}
                danger
                onPress={() => handleOpenSub(setShowReset)}
             />
          </View>
        </View>

        <View style={styles.footer}>
           <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.versionText, { color: colors.textSecondary }]} numberOfLines={2}>{t('settings.version_info', { version: '1.0.4' })}</AppText>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Bottom Sheet Modals */}
      <BottomSheet visible={showProfile} onClose={() => setShowProfile(false)}>
        <ProfileSettingsScreen />
      </BottomSheet>
      <BottomSheet visible={showSecurity} onClose={() => setShowSecurity(false)}>
        <SecuritySettingsScreen />
      </BottomSheet>
      <BottomSheet visible={showNotification} onClose={() => setShowNotification(false)}>
        <NotificationSettingsScreen />
      </BottomSheet>
      <BottomSheet visible={showTranslation} onClose={() => setShowTranslation(false)}>
        <TranslationSettingsScreen />
      </BottomSheet>
      <BottomSheet visible={showCalendar} onClose={() => setShowCalendar(false)}>
        <CalendarSettingsScreen />
      </BottomSheet>
      <BottomSheet visible={showTimeSystem} onClose={() => setShowTimeSystem(false)}>
        <TimeSystemSettingsScreen />
      </BottomSheet>
      <BottomSheet visible={showSupport} onClose={() => setShowSupport(false)}>
        <SupportScreen />
      </BottomSheet>

      {/* Reset Modal */}
      <ResetModal 
         visible={showReset} 
         onClose={() => setShowReset(false)} 
         pin={pin} 
      />

      {/* Export Modal */}
      <DataTransferModal
        visible={showExportModal}
        mode="export"
        onClose={() => setShowExportModal(false)}
        onSuccess={(type) => { setShowExportModal(false); }}
      />

      {/* Import Modal */}
      <DataTransferModal
        visible={showImportModal}
        mode="import"
        onClose={() => setShowImportModal(false)}
        onSuccess={(type) => { setShowImportModal(false); }}
      />

    </View>
  );
};

// ─── Theme Card Styles ────────────────────────────────────────────────────────

const themeCardStyles = StyleSheet.create({
  card: {
    width: 130,
    borderRadius: 16,
    padding: 10,
    marginRight: 12,
    borderWidth: 2,
  },
  preview: {
    marginBottom: 10,
  },
  topBar: {
    height: 18,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    gap: 4,
    marginBottom: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  barLine: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  contentArea: {
    borderRadius: 8,
    padding: 6,
    minHeight: 48,
  },
  accentLine: {
    width: '60%',
    height: 4,
    borderRadius: 2,
  },
  smallBlock: {
    width: 20,
    height: 12,
    borderRadius: 3,
  },
  textLine: {
    width: '80%',
    height: 3,
    borderRadius: 1.5,
    marginTop: 5,
  },
  statBlock: {
    flex: 1,
    height: 20,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statDot: {
    width: 8,
    height: 4,
    borderRadius: 2,
  },
  label: {

    fontFamily: Fonts.bold,
    marginBottom: 1,
  },
  subtitle: {

    fontFamily: Fonts.medium,
  },
  activeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeInner: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FFF',
  },
});

// ─── Main Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  bgWash: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    transform: [{ scale: 1.5 }],
  },
  integratedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingTop: 60,
    paddingBottom: 25,
  },
  headerLabel: {

    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  headerTitle: {

    fontFamily: Fonts.bold,
  },
  headerIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerSection: {
    paddingHorizontal: 25,
    marginBottom: 25,
  },
  profileBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    borderRadius: 30,
    borderWidth: 1,
  },
  bannerAvatarBox: {
    position: 'relative',
    marginRight: 20,
  },
  bannerAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  badgeOverlay: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  bannerInfo: {
    flex: 1,
  },
  bannerName: {

    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  bannerBusiness: {

    fontFamily: Fonts.medium,
    marginBottom: 12,
  },
  profileLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  profileLinkText: {

    fontFamily: Fonts.bold,
  },
  gridSection: {
    paddingHorizontal: 25,
    marginBottom: 30,
    gap: 12,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  gridItem: {
    flex: 1,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    position: 'relative',
  },
  gridIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  gridTitle: {

    fontFamily: Fonts.bold,
  },
  gridChevron: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
  paletteSection: {
    marginBottom: 30,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 25,
    marginBottom: 15,
  },
  sectionTitle: {

    fontFamily: Fonts.bold,
  },
  sectionSub: {

    fontFamily: Fonts.medium,
    marginTop: 2,
  },
  paletteScrollContent: {
    paddingHorizontal: 25,
    gap: 12,
  },
  ledgerSection: {
    paddingHorizontal: 25,
  },
  ledgerHeader: {

    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  ledgerGroup: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  ledgerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
  },
  ledgerIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  ledgerTitle: {

    fontFamily: Fonts.bold,
  },
  ledgerSub: {

    fontFamily: Fonts.medium,
    marginTop: 2,
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 25,
  },
  versionText: {

    fontFamily: Fonts.medium,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  bottomSheetContainer: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingBottom: 40,
    overflow: 'hidden',
  },
  modalHeader: {
    alignItems: 'center',
    paddingTop: 15,
    paddingBottom: 10,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
});

const resetStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  box: {
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    width: '100%',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF5F5',
    borderWidth: 1.5,
    borderColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {

    fontFamily: Fonts.bold,
    marginBottom: 10,
  },
  message: {

    textAlign: 'center',
    lineHeight: 22,
    fontFamily: Fonts.medium,
    marginBottom: 22,
  },
  pinInput: {
    width: '100%',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,

    letterSpacing: 12,
    textAlign: 'center',
    fontFamily: Fonts.bold,
    marginBottom: 18,
  },
  confirmBtn: {
    backgroundColor: '#FF3B30',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmBtnText: {
    color: '#FFF',

    fontFamily: Fonts.bold,
  },
  cancelBtn: {
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#888',

    fontFamily: Fonts.medium,
  },
});

export default SettingsScreen;