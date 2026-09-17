import { Fonts } from '@/constants/theme';
import { useDialog } from '@/context/DialogContext';
import { PROFILE_IMAGES, useDashboardVisibility, useSettings } from '@/context/SettingsContext';
import { factoryResetDatabase } from '@/database/db';
import { useSubscription } from '@/context/SubscriptionContext';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  Alert,
  View
} from 'react-native';
import Animated, {
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { getSettingsGlass } from './glass-settings';

import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  Calendar,
  ChevronRight,
  CloudDownload,
  Database,
  HelpCircle,
  Languages,
  LayoutDashboard,
  Palette,
  Printer,
  RefreshCw,
  Shield,
  Sliders,
  Trash2,
  Truck,
  Users,
  Wifi,
  Warehouse,
  Zap,
} from 'lucide-react-native';

import { DataTransferModal } from '@/components/DataTransferModal';
import { BottomSheet } from '@/components/BottomSheet';
import { AppListItem, AppText } from '@/components/ui';
import { PeripheralCenter } from './devices/peripherals';
import { PosHubScreen } from './devices/PosHubScreen';
import { usePermissions } from '@/hooks/usePermissions';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { BusinessSwitcher } from '@/components/BusinessSwitcher';
import PremiumFeatureGate from '@/components/PremiumFeatureGate';
import { useWarehouse } from '@/context/WarehouseContext';
import { translateWarehouseName, translateWarehouseLocation } from '@/utils/warehouse-labels';
import DateTimeSettings from './date-time';
import NotificationSettingsScreen from './notification';
import ProfileSettingsScreen from './profile-settings';
import SecuritySettingsScreen from './security';
import SupportScreen from './support';
import TranslationSettingsScreen from './translation';
import WarehouseSettingsScreen from './warehouse';

import { useUpdate } from '@/context/UpdateContext';
import SyncSettings from '@/components/SyncSettings';
import SyncCenter from '@/components/SyncCenter';
import TaxCenterScreen from './tax-center';

// →→→ Shared Sub-Components →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

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

const ConfigurationGridItem = ({ icon: Icon, title, onPress }: { icon: any, title: string, onPress: () => void, color: string }) => {
  const { colors } = useSettings();
  const G = getSettingsGlass(colors);
  return (
    <TouchableOpacity
      style={[styles.gridItem, { backgroundColor: G.bgCard, borderColor: G.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.gridItemContent}>
        <View style={[styles.gridIconBox, { backgroundColor: G.accentGlass }]}>
          <Icon size={22} color={G.fg} strokeWidth={2.5} />
        </View>
        <AppText variant="body" weight="bold" style={[styles.gridTitle, { color: G.fg }]} numberOfLines={2}>{title}</AppText>
      </View>
      <ChevronRight size={14} color={G.muted} style={styles.gridChevron} />
    </TouchableOpacity>
  );
};

const SettingLedgerItem = ({ icon: Icon, title, subtitle, onPress, danger }: SettingItemProps) => {
  const { colors } = useSettings();
  const G = getSettingsGlass(colors);
  return (
    <AppListItem
      left={
        <View style={[styles.ledgerIconBox, { backgroundColor: danger ? G.accentGlass : G.accentGlass }]}>
          <Icon size={18} color={danger ? G.muted : G.fg} strokeWidth={2.5} />
        </View>
      }
      title={title}
      subtitle={subtitle}
      subtitleMaxLines={1}
      titleMaxLines={1}
      right={<ChevronRight size={16} color={G.muted} />}
      onPress={onPress}
      noBorder
      padding={20}
      gap={0}
      style={{ backgroundColor: 'transparent' }}
    />
  );
};

// →→→ Theme Data →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

const THEME_OPTIONS = [
  {
    id: 'light' as const,
    label: 'theme.light',
    subtitle: 'theme.light_sub',
    bg: '#FFFFFF',
    card: '#EEF0F3',
    accent: '#0052FF',
    highlight: '#578BFA',
    text: '#0A0B0D',
  },
  {
    id: 'dark' as const,
    label: 'theme.dark',
    subtitle: 'theme.dark_sub',
    bg: '#0A0B0D',
    card: '#1B1E24',
    accent: '#4C8CFF',
    highlight: '#3473F0',
    text: '#F4F5F7',
  },
];

// →→→ Theme Card Component →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

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
  const scale = useSharedValue(isActive ? 1.04 : 1);

  useEffect(() => {
    scale.value = withSpring(isActive ? 1.04 : 1, {
      damping: 14,
      stiffness: 180,
    });
  }, [isActive]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSequence(
      withSpring(0.94, { damping: 10, stiffness: 220 }),
      withSpring(1.04, { damping: 14, stiffness: 180 }),
    );
    onPress();
  };

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handlePress}
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
    </Animated.View>
  );
};

// →→→ Reset Modal →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

const ResetModal = ({
  visible, onClose, pin
}: { visible: boolean; onClose: () => void; pin: string | null }) => {
  const { colors, t } = useSettings();
  const G = getSettingsGlass(colors);
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
    // Full factory reset: every table (businesses, users, products, sales,
    // debts, sync_outbox/history/conflicts, devices, app_settings incl. the
    // device id, hub URL/token, pairing code, and POS Hub registrations).
    // Next launch re-initializes the schema exactly like a first install.
    const success = factoryResetDatabase();

    // Clear all persisted SecureStore data
    const storeKeys = [
      'settings_theme', 'settings_language', 'settings_calendar',
      'settings_time_system', 'settings_profile', 'settings_notifications',
      'settings_sound_enabled', 'settings_pin', 'user_pin',
      'pin_salt', 'pin_hash', 'pin_flag',
      'recovery_salt', 'recovery_hash',
      'biometrics_enabled',
      'user_setupComplete', 'user_avatarIndex',
      'last_weekly_check', 'last_notified',
      'auth_token', 'refresh_token', 'shega_auth', 'shega_session',
    ];
    for (const key of storeKeys) {
      try { await SecureStore.deleteItemAsync(key); } catch {}
    }

    setLoading(false);
    if (success) {
      setEnteredPin('');
      onClose();
      await dialog.alert({ title: t('settings.reset_success'), message: t('settings.reset_fresh'), iconType: 'success' });
    } else {
      await dialog.alert({ title: t('common.error'), message: t('common.error'), iconType: 'danger' });
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={resetStyles.overlay}>
          <View style={[resetStyles.box, { backgroundColor: G.bgCard, borderColor: G.border, borderWidth: 1 }]}>
            <View style={[resetStyles.iconCircle, { borderColor: G.muted, backgroundColor: G.accentGlass }]}>
              <Trash2 size={28} color={G.fg} />
            </View>
            <AppText variant="title" weight="bold" style={[resetStyles.title, { color: G.fg }]} numberOfLines={2}>{t('settings.reset_title')}</AppText>
            <AppText variant="body" weight="medium" style={[resetStyles.message, { color: G.muted }]} numberOfLines={4}>
              {t('settings.reset_msg')}{'\n'}
              {pin ? t('settings.reset_confirm_pin') : ''}
            </AppText>

            {pin ? (
              <TextInput
                style={[resetStyles.pinInput, { color: G.fg, borderColor: G.border, backgroundColor: G.bgCard }]}
                value={enteredPin}
                onChangeText={setEnteredPin}
                placeholder={t('security.current_pin')}
                secureTextEntry
                keyboardType="number-pad"
                maxLength={4}
                placeholderTextColor={G.muted}
              />
            ) : null}

            <TouchableOpacity
              style={[resetStyles.confirmBtn, { backgroundColor: G.fg }]}
              onPress={handleReset}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={G.bg} />
                : <AppText variant="body" weight="bold" style={[resetStyles.confirmBtnText, { color: G.bg }]} numberOfLines={1}>{t('settings.reset_btn')}</AppText>}
            </TouchableOpacity>
            <TouchableOpacity style={resetStyles.cancelBtn} onPress={onClose}>
              <AppText variant="body" weight="bold" style={[resetStyles.cancelBtnText, { color: G.muted }]} numberOfLines={1}>{t('common.cancel')}</AppText>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// →→→ Main Settings Screen →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

const SettingsScreen = () => {
  const { theme, setTheme, userProfile, pin, colors, t, featureFlags, setFeatureFlag } = useSettings();
  const { dashboardVisibility, toggleDashboardSection } = useDashboardVisibility();
  const G = getSettingsGlass(colors);
  const themeTransition = useSharedValue(0);
  const [transitionAccent, setTransitionAccent] = useState('#FFFFFF');

  const animatedOverlayStyle = useAnimatedStyle(() => ({
    opacity: themeTransition.value,
    transform: [
      {
        scale: interpolate(themeTransition.value, [0, 0.4, 1], [0.96, 1.02, 1]),
      },
    ],
  }));

  const handleThemeChange = (item: (typeof THEME_OPTIONS)[0]) => {
    if (item.id === theme) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTransitionAccent(item.accent);
    themeTransition.value = 0;
    themeTransition.value = withSequence(
      withTiming(0.45, { duration: 180 }),
      withTiming(0, { duration: 320 })
    );
    setTheme(item.id);
  };

  const [showProfile, setShowProfile] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [showDateTime, setShowDateTime] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showWarehouse, setShowWarehouse] = useState(false);
  const [showDevices, setShowDevices] = useState(false);
  const [showPosHub, setShowPosHub] = useState(false);
  const [showSyncCenter, setShowSyncCenter] = useState(false);
  const [showTax, setShowTax] = useState(false);

  const { canManageDevices } = usePermissions();
  const authBiz = useBusinessAuth();
  // Cashier experience: view-only profile + the essentials only.
  const cashierMode =
    authBiz.role === 'cashier' ||
    (!authBiz.can('products.edit') && !authBiz.can('inventory.adjust') && !authBiz.can('reports.viewAll'));

  const { activeWarehouse, warehouses } = useWarehouse();
  const { checkForUpdates, state: updateState } = useUpdate();
  const { refresh: refreshSubscription } = useSubscription();

  const handleOpenSub = (setter: (v: boolean) => void) => {
    Haptics.selectionAsync();
    setter(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: G.bg }]}>
      {/* Theme Transition Overlay */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: transitionAccent,
            zIndex: 9999,
          },
          animatedOverlayStyle,
        ]}
      />

      {/* Background Ambient Glows */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[styles.bgWash, { top: -80, left: -60, backgroundColor: '#FFFFFF', opacity: 0.03 }]} />
        <View style={[styles.bgWash, { bottom: -60, right: -40, backgroundColor: '#FFFFFF', opacity: 0.025, width: 250, height: 250, borderRadius: 125 }]} />
        <View style={[styles.bgWash, { top: '40%', left: '30%', backgroundColor: '#FFFFFF', opacity: 0.015, width: 200, height: 200, borderRadius: 100 }]} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Integrated Header */}
        <View style={styles.integratedHeader}>
          <View>
            <AppText variant="body" weight="medium" style={[styles.headerLabel, { color: G.muted }]} numberOfLines={2}>{t('settings.system_pref')}</AppText>
            <AppText variant="display" weight="bold" style={[styles.headerTitle, { color: G.fg }]} numberOfLines={2}>{t('settings.configuration')}</AppText>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.headerIconBox, { backgroundColor: G.bgCard, borderColor: G.border }]}>
<Shield size={24} color={G.fg} />
            </View>
          </View>
        </View>

        {/* Active business scope selector */}
        <View style={{ paddingHorizontal: 25, marginBottom: 18 }}>
          <BusinessSwitcher />
        </View>

        {/* Elite Profile Banner */}
        <Animated.View entering={FadeInDown.duration(600)} style={styles.bannerSection}>
          <TouchableOpacity 
            activeOpacity={0.9} 
            onPress={cashierMode ? undefined : () => handleOpenSub(setShowProfile)}
            disabled={cashierMode}
            style={[styles.profileBanner, { backgroundColor: G.bgCard, borderColor: G.border }]}
          >
            <View style={styles.bannerAvatarBox}>
              <Image source={userProfile.avatarUri ? { uri: userProfile.avatarUri } : PROFILE_IMAGES[userProfile.avatarIndex >= 0 ? userProfile.avatarIndex : 0]} style={styles.bannerAvatar} />
              <View style={[styles.badgeOverlay, { backgroundColor: G.fg }]}>
                <BadgeCheck size={16} color={G.bg} fill={G.bg} />
              </View>
            </View>
            <View style={styles.bannerInfo}>
              <AppText variant="title" weight="bold" style={[styles.bannerName, { color: G.fg }]} numberOfLines={2}>{userProfile.name}</AppText>
              <AppText variant="body-sm" weight="medium" style={[styles.bannerBusiness, { color: G.muted }]} numberOfLines={1}>{userProfile.businessName}</AppText>
              {!cashierMode && (
              <View style={[styles.profileLinkBtn, { backgroundColor: G.accentGlass }]}>
                <AppText variant="caption" weight="bold" style={[styles.profileLinkText, { color: G.fg }]} numberOfLines={1}>{t('profile.edit')}</AppText>
                <ArrowUpRight size={14} color={G.fg} />
              </View>
              )}
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Service Intelligence Grid */}
        <View style={styles.gridSection}>
          <View style={styles.gridRow}>
            {!cashierMode && (
            <ConfigurationGridItem 
              icon={Shield} 
              title={t('settings.security')} 
              onPress={() => handleOpenSub(setShowSecurity)} 
              color={G.fg}
            />
            )}
            {!cashierMode && (
            <ConfigurationGridItem 
              icon={Bell} 
              title={t('settings.notifications')} 
              onPress={() => handleOpenSub(setShowNotification)} 
              color={G.fg}
            />
            )}
          </View>
          <View style={styles.gridRow}>
            <ConfigurationGridItem 
              icon={Languages} 
              title={t('settings.language')} 
              onPress={() => handleOpenSub(setShowTranslation)} 
              color={G.fg}
            />
            <ConfigurationGridItem 
              icon={Calendar} 
              title={t('settings.date_time_format')} 
              onPress={() => handleOpenSub(setShowDateTime)} 
              color={G.fg}
            />
          </View>
          {!cashierMode && (
          <View style={styles.gridRow}>
            <ConfigurationGridItem
              icon={Sliders}
              title="Tax Settings"
              onPress={() => handleOpenSub(setShowTax)}
              color={G.fg}
            />
          </View>
          )}
        </View>

        {/* Warehouse Section */}
        {!cashierMode && featureFlags.warehousesEnabled && (
        <View style={styles.ledgerSection}>
          <View style={styles.sectionHead}>
            <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.ledgerHeader, { color: G.muted }]} numberOfLines={1}>{t('inv.warehouses_title')}</AppText>
            <View style={{ flex: 1 }} />
            <Warehouse size={20} color={G.muted} />
          </View>
          <View style={[styles.ledgerGroup, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <SettingLedgerItem
              icon={Warehouse}
              title={activeWarehouse ? translateWarehouseName(t, activeWarehouse.name) : t('inv.all_warehouses')}
              subtitle={activeWarehouse ? (translateWarehouseLocation(t, activeWarehouse.location) || t('data.warehouse_count', { count: warehouses.length.toString() })) : t('inv.all_warehouses_sub')}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowWarehouse(true); }}
            />
          </View>
        </View>
        )}

        {/* Business Features — progressive disclosure toggles */}
        {!cashierMode && (
        <View style={styles.ledgerSection}>
          <View style={styles.sectionHead}>
            <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.ledgerHeader, { color: G.muted }]} numberOfLines={1}>Business Features</AppText>
            <View style={{ flex: 1 }} />
            <Warehouse size={20} color={G.muted} />
          </View>
          <View style={[styles.ledgerGroup, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <View style={[styles.soundRow, { borderBottomColor: G.border }]}>
              <View style={[styles.ledgerIconBox, { backgroundColor: G.accentGlass }]}>
                <Warehouse size={18} color={G.fg} strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="body" weight="bold" style={{ color: G.fg }} numberOfLines={1}>Warehouses</AppText>
                <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={1}>Track stock across multiple locations</AppText>
              </View>
              <Switch
                value={featureFlags.warehousesEnabled}
                onValueChange={(val: boolean) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setFeatureFlag('warehouses', val);
                }}
                trackColor={{ false: G.border, true: G.fg + '60' }}
                thumbColor={featureFlags.warehousesEnabled ? G.fg : G.muted}
              />
            </View>
            <View style={[styles.soundRow, { borderBottomColor: G.border }]}>
              <View style={[styles.ledgerIconBox, { backgroundColor: G.accentGlass }]}>
                <Truck size={18} color={G.fg} strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="body" weight="bold" style={{ color: G.fg }} numberOfLines={1}>Shipments</AppText>
                <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={1}>Track incoming and outgoing shipments</AppText>
              </View>
              <Switch
                value={featureFlags.shipmentsEnabled}
                onValueChange={(val: boolean) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setFeatureFlag('shipments', val);
                }}
                trackColor={{ false: G.border, true: G.fg + '60' }}
                thumbColor={featureFlags.shipmentsEnabled ? G.fg : G.muted}
              />
            </View>
            <View style={[styles.soundRow, { borderBottomColor: 'transparent' }]}>
              <View style={[styles.ledgerIconBox, { backgroundColor: G.accentGlass }]}>
                <Users size={18} color={G.fg} strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="body" weight="bold" style={{ color: G.fg }} numberOfLines={1}>Customers</AppText>
                <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={1}>Manage customers and record credit sales</AppText>
              </View>
              <Switch
                value={featureFlags.customersEnabled}
                onValueChange={(val: boolean) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setFeatureFlag('customers', val);
                }}
                trackColor={{ false: G.border, true: G.fg + '60' }}
                thumbColor={featureFlags.customersEnabled ? G.fg : G.muted}
              />
            </View>
          </View>
        </View>
        )}

        {/* Offline-first Sync (Phase 3) — compact summary + link to full §24 Sync Center */}
        <SyncSettings />
        <View style={styles.ledgerSection}>
          <View style={styles.sectionHead}>
            <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.ledgerHeader, { color: G.muted }]} numberOfLines={1}>{t('sync.center_title')}</AppText>
            <View style={{ flex: 1 }} />
            <RefreshCw size={20} color={G.muted} />
          </View>
          <View style={[styles.ledgerGroup, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <SettingLedgerItem
              icon={RefreshCw}
              title={'Sync Center'}
              subtitle={'Pending · Devices · History · Conflicts'}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowSyncCenter(true); }}
            />
          </View>
        </View>

        {/* Devices & Peripherals */}
        {!cashierMode && canManageDevices ? (
          <View style={styles.ledgerSection}>
            <View style={styles.sectionHead}>
              <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.ledgerHeader, { color: G.muted }]} numberOfLines={1}>{t('devices.title')}</AppText>
              <View style={{ flex: 1 }} />
              <Printer size={20} color={G.muted} />
            </View>
            <View style={[styles.ledgerGroup, { backgroundColor: G.bgCard, borderColor: G.border }]}>
              <SettingLedgerItem
                icon={Printer}
                title={t('devices.title')}
                subtitle={t('devices.settings_subtitle')}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowDevices(true); }}
              />
              <SettingLedgerItem
                icon={Wifi}
                title="POS Hub"
                subtitle="Let other devices connect to this phone"
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowPosHub(true); }}
              />
            </View>
          </View>
        ) : null}

        {/* Dashboard Customization */}
        {!cashierMode && (
        <View style={styles.ledgerSection}>
          <View style={styles.sectionHead}>
            <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.ledgerHeader, { color: G.muted }]} numberOfLines={1}>{t('settings.dashboard')}</AppText>
            <View style={{ flex: 1 }} />
            <LayoutDashboard size={20} color={G.muted} />
          </View>
          <View style={[styles.ledgerGroup, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <View style={[styles.soundRow, { borderBottomColor: G.border }]}>
              <View style={[styles.ledgerIconBox, { backgroundColor: G.accentGlass }]}>
                <AlertTriangle size={18} color={G.fg} strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="body" weight="bold" style={{ color: G.fg }} numberOfLines={1}>{t('dashboard.alerts')}</AppText>
                <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={1}>{t('settings.dashboard_alerts_desc')}</AppText>
              </View>
              <Switch
                value={dashboardVisibility.alerts}
                onValueChange={(val: boolean) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  toggleDashboardSection('alerts', val);
                }}
                trackColor={{ false: G.border, true: G.fg + '60' }}
                thumbColor={dashboardVisibility.alerts ? G.fg : G.muted}
              />
            </View>

            <View style={[styles.soundRow, { borderBottomColor: G.border }]}>
              <View style={[styles.ledgerIconBox, { backgroundColor: G.accentGlass }]}>
                <Zap size={18} color={G.fg} strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="body" weight="bold" style={{ color: G.fg }} numberOfLines={1}>{t('dashboard.health_score')}</AppText>
                <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={1}>{t('settings.dashboard_health_desc')}</AppText>
              </View>
              <Switch
                value={dashboardVisibility.businessHealth}
                onValueChange={(val: boolean) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  toggleDashboardSection('businessHealth', val);
                }}
                trackColor={{ false: G.border, true: G.fg + '60' }}
                thumbColor={dashboardVisibility.businessHealth ? G.fg : G.muted}
              />
            </View>

            <View style={[styles.soundRow, { borderBottomColor: 'transparent' }]}>
              <View style={[styles.ledgerIconBox, { backgroundColor: G.accentGlass }]}>
                <LayoutDashboard size={18} color={G.fg} strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="body" weight="bold" style={{ color: G.fg }} numberOfLines={1}>{t('dashboard.assistant')}</AppText>
                <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={1}>{t('settings.dashboard_assistant_desc')}</AppText>
              </View>
              <Switch
                value={dashboardVisibility.businessAssistant}
                onValueChange={(val: boolean) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  toggleDashboardSection('businessAssistant', val);
                }}
                trackColor={{ false: G.border, true: G.fg + '60' }}
                thumbColor={dashboardVisibility.businessAssistant ? G.fg : G.muted}
              />
            </View>
          </View>
        </View>
        )}

        {/* The Palette — Theme Selection */}
        <View style={styles.paletteSection}>
          <View style={styles.sectionHead}>
            <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.ledgerHeader, { color: G.muted }]} numberOfLines={1}>{t('settings.palette')}</AppText>
            <View style={{ flex: 1 }} />
            <Palette size={20} color={G.muted} />
          </View>
          <PremiumFeatureGate feature="themes" featureName={t('settings.palette')}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.paletteScrollContent}>
            {THEME_OPTIONS.map((item) => (
              <ThemeCard
                key={item.id}
                item={item}
                isActive={theme === item.id}
                onPress={() => handleThemeChange(item)}
              />
            ))}
          </ScrollView>
          </PremiumFeatureGate>
        </View>

        {/* Advanced System Ledger */}
        {!cashierMode && (
        <View style={styles.ledgerSection}>
          <View style={styles.sectionHead}>
            <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.ledgerHeader, { color: G.muted }]} numberOfLines={1}>{t('settings.advanced')}</AppText>
            <View style={{ flex: 1 }} />
            <Sliders size={20} color={G.muted} />
          </View>
          <View style={[styles.ledgerGroup, { backgroundColor: G.bgCard, borderColor: G.border }]}>
             <SettingLedgerItem 
                icon={Database} 
                title={t('settings.export_data')} 
                subtitle={t('settings.export_desc')}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowExportModal(true); }}
             />
             <PremiumFeatureGate feature="csv_import" featureName={t('settings.import_data')}>
             <SettingLedgerItem 
                icon={CloudDownload} 
                title={t('settings.import_data')} 
                subtitle={t('settings.import_desc')}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowImportModal(true); }}
             />
             </PremiumFeatureGate>
              <SettingLedgerItem
                icon={CloudDownload}
                title={t('settings.check_updates')}
                subtitle={updateState.checking ? t('update.checking') : t('settings.check_updates_desc')}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  checkForUpdates();
                }}
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
        )}

        <View style={styles.footer}>
           <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.versionText, { color: G.muted }]} numberOfLines={2}>{t('settings.version_info', { version: updateState.currentVersion })}</AppText>
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
      <BottomSheet visible={showDateTime} onClose={() => setShowDateTime(false)}>
        <DateTimeSettings />
      </BottomSheet>
      <BottomSheet visible={showTax} onClose={() => setShowTax(false)}>
        <TaxCenterScreen />
      </BottomSheet>
      <BottomSheet visible={showSupport} onClose={() => setShowSupport(false)}>
        <SupportScreen />
      </BottomSheet>

      {/* Warehouse Modal */}
      <BottomSheet visible={showWarehouse && featureFlags.warehousesEnabled} onClose={() => setShowWarehouse(false)}>
        <WarehouseSettingsScreen onClose={() => setShowWarehouse(false)} />
      </BottomSheet>

      {/* Devices & Peripherals */}
      <BottomSheet visible={showDevices} onClose={() => setShowDevices(false)}>
        <PeripheralCenter onClose={() => setShowDevices(false)} />
      </BottomSheet>

      {/* POS Hub — this phone as the main connector */}
      <BottomSheet visible={showPosHub} onClose={() => setShowPosHub(false)}>
        <PosHubScreen onClose={() => setShowPosHub(false)} />
      </BottomSheet>

      {/* §24 Sync Center */}
      <BottomSheet visible={showSyncCenter} onClose={() => setShowSyncCenter(false)}>
        <SyncCenter />
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

// →→→ Theme Card Styles →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

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

// →→→ Main Styles →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

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
    minHeight: 110,
    justifyContent: 'space-between',
  },
  gridItemContent: {
    gap: 0,
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
    paddingHorizontal: 25,
    marginBottom: 30,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    paddingVertical: 5,
    gap: 12,
  },
  ledgerSection: {
    paddingHorizontal: 25,
    marginBottom: 28,
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
  soundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
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
    marginTop: 32,
    paddingHorizontal: 25,
  },
  versionText: {

    fontFamily: Fonts.medium,
  },
});

const resetStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
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
    borderWidth: 1.5,
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