import React, { useState } from 'react';
import {
  View, Text as RNText, Text, StyleSheet, Image, TouchableOpacity,
  ScrollView, Switch, Modal, Dimensions, Alert,
  TextInput, ActivityIndicator, Platform
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, { 
  FadeIn, 
  FadeInDown, 
  FadeInUp 
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Lock, Bell, Languages, Calendar, MessageSquare,
  CloudDownload, FilePlus, ChevronRight, BadgeCheck,
  Trash2, Palette, Shield, User, HelpCircle,
  LogOut, Database, Sparkles, ExternalLink, ArrowUpRight
} from 'lucide-react-native';
import { Fonts } from '@/constants/theme';
import { useSettings, PROFILE_IMAGES } from '@/context/SettingsContext';
import { clearDatabase } from '@/database/db';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';

import ProfileSettingsScreen from './profile-settings';
import SecuritySettingsScreen from './security';
import TranslationSettingsScreen from './translation';
import CalendarSettingsScreen from './calendar';
import SupportScreen from './support';
import NotificationSettingsScreen from './notification';
import DataSuccessModal from '@/components/DataSuccessModal';

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
      <RNText style={[styles.gridTitle, { color: colors.text }]}>{title}</RNText>
      <ChevronRight size={14} color={colors.textSecondary} style={styles.gridChevron} />
    </TouchableOpacity>
  );
};

const SettingLedgerItem = ({ icon: Icon, title, subtitle, onPress, danger }: SettingItemProps) => {
  const { colors } = useSettings();
  return (
    <TouchableOpacity 
      style={[styles.ledgerItem, { borderBottomColor: colors.border }]} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.ledgerIconBox, { backgroundColor: danger ? '#FF3B3015' : colors.surface }]}>
        <Icon size={18} color={danger ? '#FF3B30' : colors.text} strokeWidth={2.5} />
      </View>
      <View style={{ flex: 1 }}>
        <RNText style={[styles.ledgerTitle, { color: danger ? '#FF3B30' : colors.text }]}>{title}</RNText>
        {subtitle && <RNText style={[styles.ledgerSub, { color: colors.textSecondary }]}>{subtitle}</RNText>}
      </View>
      <ChevronRight size={16} color={colors.textSecondary} />
    </TouchableOpacity>
  );
};

// ─── Theme Data ──────────────────────────────────────────────────────────────

const THEME_OPTIONS = (t: any) => [
  {
    id: 'light' as const,
    label: t('theme.light'),
    subtitle: t('theme.light_sub'),
    bg: '#FFFFFF',
    card: '#F9F9F9',
    accent: '#000000',
    highlight: '#FFC107',
    text: '#000000',
  },
  {
    id: 'dark' as const,
    label: t('theme.dark'),
    subtitle: t('theme.dark_sub'),
    bg: '#000000',
    card: '#1C1C1E',
    accent: '#FFFFFF',
    highlight: '#FF9500',
    text: '#FFFFFF',
  },
  {
    id: 'midnight' as const,
    label: t('theme.midnight'),
    subtitle: t('theme.midnight_sub'),
    bg: '#0B1220',
    card: '#172033',
    accent: '#2F6FED',
    highlight: '#E6B85C',
    text: '#EAF1FF',
  },
  {
    id: 'emerald' as const,
    label: t('theme.emerald'),
    subtitle: t('theme.emerald_sub'),
    bg: '#0E1A16',
    card: '#16241F',
    accent: '#1F8A70',
    highlight: '#EAD2A6',
    text: '#F3F7F6',
  },
  {
    id: 'charcoal' as const,
    label: t('theme.charcoal'),
    subtitle: t('theme.charcoal_sub'),
    bg: '#121212',
    card: '#1E1E1E',
    accent: '#B23A48',
    highlight: '#F4A261',
    text: '#F1F1F1',
  },
  {
    id: 'slate' as const,
    label: t('theme.slate'),
    subtitle: t('theme.slate_sub'),
    bg: '#0F0F14',
    card: '#1A1A22',
    accent: '#7C5CFF',
    highlight: '#F2C14E',
    text: '#EAEAF0',
  },
  {
    id: 'cocoa' as const,
    label: t('theme.cocoa'),
    subtitle: t('theme.cocoa_sub'),
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
  item: typeof THEME_OPTIONS[0];
  isActive: boolean;
  onPress: () => void;
}) => {
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
        {/* Fake top bar */}
        <View style={[themeCardStyles.topBar, { backgroundColor: item.card }]}>
          <View style={[themeCardStyles.dot, { backgroundColor: item.accent }]} />
          <View style={[themeCardStyles.barLine, { backgroundColor: item.text, opacity: 0.25 }]} />
        </View>

        {/* Fake content area */}
        <View style={[themeCardStyles.contentArea, { backgroundColor: item.card }]}>
          <View style={[themeCardStyles.accentLine, { backgroundColor: item.accent }]} />
          <View style={{ flexDirection: 'row', gap: 4, marginTop: 5 }}>
            <View style={[themeCardStyles.smallBlock, { backgroundColor: item.highlight, opacity: 0.9 }]} />
            <View style={[themeCardStyles.smallBlock, { backgroundColor: item.text, opacity: 0.15 }]} />
          </View>
          <View style={[themeCardStyles.textLine, { backgroundColor: item.text, opacity: 0.12 }]} />
        </View>

        {/* Fake bottom stat row */}
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
          <View style={[themeCardStyles.statBlock, { backgroundColor: item.card }]}>
            <View style={[themeCardStyles.statDot, { backgroundColor: item.accent }]} />
          </View>
          <View style={[themeCardStyles.statBlock, { backgroundColor: item.card }]}>
            <View style={[themeCardStyles.statDot, { backgroundColor: item.highlight }]} />
          </View>
        </View>
      </View>

      {/* Label */}
      <Text style={[themeCardStyles.label, { color: item.text }]}>{item.label}</Text>
      <Text style={[themeCardStyles.subtitle, { color: item.text, opacity: 0.5 }]}>{item.subtitle}</Text>

      {/* Active indicator */}
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
  const [enteredPin, setEnteredPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (pin && enteredPin !== pin) {
      Alert.alert(t('common.error'), t('settings.pin_invalid'));
      return;
    }
    if (!pin) {
      Alert.alert(
        t('settings.no_pin'),
        t('settings.reset_msg'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.delete'), style: 'destructive', onPress: doReset }
        ]
      );
      return;
    }
    doReset();
  };

  const doReset = async () => {
    setLoading(true);
    const success = clearDatabase();
    setLoading(false);
    if (success) {
      setEnteredPin('');
      onClose();
      Alert.alert(`✅ ${t('settings.reset_success')}`, t('settings.reset_fresh'));
    } else {
      Alert.alert(t('common.error'), t('common.error'));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={resetStyles.overlay}>
        <View style={[resetStyles.box, { backgroundColor: colors.card }]}>
          <View style={resetStyles.iconCircle}>
            <Trash2 size={28} color="#FF3B30" />
          </View>
          <Text style={[resetStyles.title, { color: colors.text }]}>{t('settings.reset_title')}</Text>
          <Text style={[resetStyles.message, { color: colors.textSecondary }]}>
            {t('settings.reset_msg')}{'\n'}
            {pin ? t('settings.reset_confirm_pin') : ''}
          </Text>

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
              : <Text style={resetStyles.confirmBtnText}>{t('settings.reset_btn')}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={resetStyles.cancelBtn} onPress={onClose}>
            <Text style={resetStyles.cancelBtnText}>{t('common.cancel')}</Text>
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
  const [showSupport, setShowSupport] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [successType, setSuccessType] = useState<'export'|'import'|'reset'|null>(null);
  const [pendingImport, setPendingImport] = useState<any>(null);

  const handleExport = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setExporting(true);
      
      // On some platforms/versions, SQLite files might be in different subfolders.
      // We check the most common one first.
      const dbDir = `${FileSystem.documentDirectory}SQLite/`;
      const dbPath = `${dbDir}shegabe.db`;
      
      const info = await FileSystem.getInfoAsync(dbPath);
      if (!info.exists) {
        // Fallback for some Android versions or different Expo SQLite configurations
        const altPath = `${FileSystem.documentDirectory}../databases/shegabe.db`;
        const altInfo = await FileSystem.getInfoAsync(altPath);
        if (!altInfo.exists) {
          Alert.alert(t('common.error'), "Database file not found. Ensure you have some data first.");
          return;
        }
        // Use the alt path if it exists
        var finalDbPath = altPath;
      } else {
        var finalDbPath = dbPath;
      }

      const exportPath = `${FileSystem.cacheDirectory}shegabe_backup_${Date.now()}.db`;
      
      // Using the legacy export for stability as per user's system warning
      await FileSystem.copyAsync({ from: finalDbPath, to: exportPath });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(exportPath, {
          mimeType: 'application/octet-stream',
          dialogTitle: t('settings.export_data'),
        });
        setSuccessType('export');
      } else {
        Alert.alert(t('settings.sharing_unavailable'), `${t('settings.backup_restore')}:\n${exportPath}`);
      }
    } catch (e) {
      console.error('Export Error:', e);
      Alert.alert(t('settings.export_failed'), t('settings.export_failed_msg'));
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setImporting(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) {
        setImporting(false);
        return;
      }
      const file = result.assets[0];
      
      // Basic extension check
      if (!file.name.toLowerCase().endsWith('.db')) {
        Alert.alert(t('settings.import_invalid'), t('settings.import_invalid_msg'));
        setImporting(false);
        return;
      }

      // Deeper validation: Check SQLite header
      try {
        const header = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8, length: 15 });
        if (!header.startsWith('SQLite format 3')) {
          Alert.alert(t('settings.import_invalid'), t('settings.import_invalid_msg'));
          setImporting(false);
          return;
        }
      } catch (e) {
        // Fallback if read fails but extension is okay
      }

      setPendingImport(file);
    } catch (e) {
      console.error('Outer Import Error:', e);
      Alert.alert(t('settings.import_failed'), t('settings.import_failed_msg'));
    } finally {
      setImporting(false);
    }
  };

  const executeImport = async () => {
    if (!pendingImport) return;
    try {
      setImporting(true);
      const dbDir = `${FileSystem.documentDirectory}SQLite/`;
      const dbPath = `${dbDir}shegabe.db`;
      
      // Ensure the SQLite directory exists
      const dirInfo = await FileSystem.getInfoAsync(dbDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dbDir, { intermediates: true });
      }

      await FileSystem.copyAsync({ from: pendingImport.uri, to: dbPath });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPendingImport(null);
      setSuccessType('import');
    } catch (err) {
      console.error('Import Execution Error:', err);
      Alert.alert(t('settings.import_failed'), t('settings.import_failed_msg'));
    } finally {
      setImporting(false);
    }
  };

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
            <RNText style={[styles.headerLabel, { color: colors.textSecondary }]}>{t('settings.system_pref')}</RNText>
            <RNText style={[styles.headerTitle, { color: colors.text }]}>{t('settings.configuration')}</RNText>
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
              <Image source={PROFILE_IMAGES[userProfile.avatarIndex]} style={styles.bannerAvatar} />
              <View style={[styles.badgeOverlay, { backgroundColor: colors.text }]}>
                <BadgeCheck size={16} color={colors.background} fill={colors.background} />
              </View>
            </View>
            <View style={styles.bannerInfo}>
              <RNText style={[styles.bannerName, { color: colors.text }]}>{userProfile.name}</RNText>
              <RNText style={[styles.bannerBusiness, { color: colors.textSecondary }]}>{userProfile.businessName}</RNText>
              <View style={[styles.profileLinkBtn, { backgroundColor: colors.text + '10' }]}>
                <RNText style={[styles.profileLinkText, { color: colors.text }]}>{t('profile.edit')}</RNText>
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
          </View>
        </View>

        {/* The Palette — Theme Selection */}
        <View style={styles.paletteSection}>
          <View style={styles.sectionHead}>
            <View>
              <RNText style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.palette')}</RNText>
              <RNText style={[styles.sectionSub, { color: colors.textSecondary }]}>{t('settings.theme_subtitle')}</RNText>
            </View>
            <Palette size={20} color={colors.textSecondary} />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.paletteScrollContent}
          >
            {THEME_OPTIONS(t).map((item) => (
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
          <RNText style={[styles.ledgerHeader, { color: colors.textSecondary }]}>{t('settings.advanced')}</RNText>
          <View style={[styles.ledgerGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
             <SettingLedgerItem 
                icon={Database} 
                title={t('settings.export_data')} 
                subtitle={t('settings.export_desc')}
                onPress={handleExport}
             />
             <SettingLedgerItem 
                icon={CloudDownload} 
                title={t('settings.import_data')} 
                subtitle={t('settings.import_desc')}
                onPress={handleImport}
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
           <RNText style={[styles.versionText, { color: colors.textSecondary }]}>{t('settings.version_info', { version: '1.0.4' })}</RNText>
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
      <BottomSheet visible={showSupport} onClose={() => setShowSupport(false)}>
        <SupportScreen />
      </BottomSheet>

      {/* Reset Modal */}
      <ResetModal 
         visible={showReset} 
         onClose={() => setShowReset(false)} 
         pin={pin} 
      />

      {/* Import Confirmation Modal */}
      <Modal visible={!!pendingImport} transparent animationType="fade">
        <View style={resetStyles.overlay}>
          <View style={[resetStyles.box, { backgroundColor: colors.card }]}>
            <View style={[resetStyles.iconCircle, { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}>
              <CloudDownload size={28} color={colors.primary} />
            </View>
            <Text style={[resetStyles.title, { color: colors.text }]}>{t('settings.import_title')}</Text>
            <Text style={[resetStyles.message, { color: colors.textSecondary }]}>
              {t('settings.import_msg')}{'\n'}
              <Text style={{ fontFamily: Fonts.bold }}>{pendingImport?.name}</Text>
            </Text>

            <TouchableOpacity
              style={[resetStyles.confirmBtn, { backgroundColor: colors.primary }]}
              onPress={executeImport}
              disabled={importing}
            >
              {importing
                ? <ActivityIndicator color="#FFF" />
                : <Text style={resetStyles.confirmBtnText}>{t('settings.replace').toUpperCase()}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={resetStyles.cancelBtn} onPress={() => setPendingImport(null)}>
              <Text style={resetStyles.cancelBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal visible={!!successType} transparent animationType="fade">
        <DataSuccessModal 
          type={successType as any} 
          onClose={() => setSuccessType(null)} 
        />
      </Modal>
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
    fontSize: 13,
    fontFamily: Fonts.bold,
    marginBottom: 1,
  },
  subtitle: {
    fontSize: 10,
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
    filter: 'blur(80px)',
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
    fontSize: 12,
    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
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
    fontSize: 20,
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  bannerBusiness: {
    fontSize: 13,
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
    fontSize: 12,
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
    fontSize: 14,
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
    fontSize: 20,
    fontFamily: Fonts.bold,
  },
  sectionSub: {
    fontSize: 13,
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
    fontSize: 12,
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
    fontSize: 15,
    fontFamily: Fonts.bold,
  },
  ledgerSub: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    marginTop: 2,
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 25,
  },
  versionText: {
    fontSize: 11,
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
    fontSize: 20,
    fontFamily: Fonts.bold,
    marginBottom: 10,
  },
  message: {
    fontSize: 14,
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
    fontSize: 22,
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
    fontSize: 16,
    fontFamily: Fonts.bold,
  },
  cancelBtn: {
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#888',
    fontSize: 15,
    fontFamily: Fonts.medium,
  },
});

export default SettingsScreen;