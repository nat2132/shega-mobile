// Notification settings screen
// Lets the user configure:
//   - Per-category enable / disable
//   - Push notification sound
//   - Vibration
//   - Quiet hours

import React, { useEffect } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import {
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  LineChart,
  Package,
  Shield,
  Volume2,
  Wallet,
} from 'lucide-react-native';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { useNotificationCenter } from '@/context/NotificationContext';
import { AppText } from '@/components/ui';
import { getSettingsGlass } from './glass-settings';
let Notifications: any;
try {
  Notifications = require('expo-notifications');
} catch {
  Notifications = {
    setNotificationHandler: async () => {},
    getPermissionsAsync: async () => ({ status: 'undetermined' }),
    requestPermissionsAsync: async () => ({ status: 'undetermined' }),
  };
}
const NotificationSettings = () => {
  const { notifications, setNotifications, colors, t, featureFlags, soundEnabled, setSoundEnabled } = useSettings();
  const G = getSettingsGlass(colors);
  const { preferences, updatePreference } = useNotificationCenter();

  const getPref = (key: string) =>
    preferences.find((p) => p.key === key) || {
      key,
      enabled: true,
      quietStart: null,
      quietEnd: null,
      sound: 'default',
      vibration: true,
    };

  useEffect(() => {
    const requestPermissions = async () => {
      const isExpoGo = Constants.appOwnership === 'expo';
      if (isExpoGo && Platform.OS === 'android') {
        return;
      }
      Notifications.setNotificationHandler({
        handleNotification: async () =>
          ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          } as any),
      });
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }
    };
    requestPermissions();
  }, []);

  const toggle = (key: keyof typeof notifications) => {
    setNotifications({ ...notifications, [key]: !notifications[key] });
  };

  const AlertCard = ({ title, subtitle, value, onValueChange, icon: Icon }: any) => (
    <View style={[styles.card, { backgroundColor: G.bgCard, borderColor: G.border }]}>
      <View style={[styles.cardIcon, { backgroundColor: G.fg + '08' }]}>
        {Icon ? <Icon size={18} color={G.fg} /> : null}
      </View>
      <View style={styles.cardText}>
        <AppText variant="body" weight="bold" style={[styles.cardTitle, { color: G.fg }]} numberOfLines={1}>{title}</AppText>
        <AppText variant="body-sm" weight="medium" style={[styles.cardSubtitle, { color: G.fgSecondary }]} numberOfLines={2}>{subtitle}</AppText>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#E5E5EA', true: G.fg }}
        thumbColor="#FFF"
      />
    </View>
  );

  const pushPref = getPref('push');
  const soundPref = getPref('sound');
  const vibrationPref = getPref('vibration');
  const quietHoursPref = getPref('quiet_hours');

  return (
    <View style={[styles.container, { backgroundColor: G.bg }]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[styles.glowWash, { backgroundColor: G.mutedLight, top: -80, left: -60, width: 200, height: 200, borderRadius: 100 }]} />
        <View style={[styles.glowWash, { backgroundColor: G.mutedLight, bottom: -40, right: -30, width: 160, height: 160, borderRadius: 80 }]} />
        <View style={[styles.glowWash, { backgroundColor: G.mutedLight, top: '40%', right: -50, width: 140, height: 140, borderRadius: 70 }]} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.headerLabel, { color: G.fgSecondary }]} numberOfLines={2}>
          {t('settings.notification_settings')}
        </AppText>
        <AppText variant="display" weight="bold" style={[styles.mainTitle, { color: G.fg }]} numberOfLines={2}>{t('settings.notifications')}</AppText>

        {/* Global delivery */}
        <View style={styles.sectionHeader}>
          <Shield size={20} color={G.fg} />
          <AppText variant="subtitle" weight="bold" style={[styles.sectionTitle, { color: G.fg }]} numberOfLines={1}>{t('notif.global_delivery')}</AppText>
        </View>
        <AlertCard
          title={t('notif.push_notifications')}
          subtitle={t('notif.push_desc')}
          value={pushPref.enabled}
          onValueChange={(v: boolean) => updatePreference('push', { enabled: v })}
          icon={Bell}
        />
        <AlertCard
          title={t('settings.sound_effects')}
          subtitle={t('settings.sound_desc')}
          value={soundEnabled}
          onValueChange={(v: boolean) => setSoundEnabled(v)}
          icon={Volume2}
        />
        <AlertCard
          title={t('notif.sound')}
          subtitle={t('notif.sound_desc')}
          value={soundPref.enabled}
          onValueChange={(v: boolean) => updatePreference('sound', { enabled: v })}
          icon={Volume2}
        />
        <AlertCard
          title={t('notif.vibration')}
          subtitle={t('notif.vibration_desc')}
          value={vibrationPref.enabled}
          onValueChange={(v: boolean) => updatePreference('vibration', { enabled: v })}
          icon={Clock}
        />
        <AlertCard
          title={t('notif.quiet_hours')}
          subtitle={t('notif.quiet_hours_desc')}
          value={!!quietHoursPref.quietStart}
          onValueChange={(v: boolean) =>
            updatePreference('quiet_hours', { quietStart: v ? '22:00' : null, quietEnd: v ? '07:00' : null })
          }
          icon={Calendar}
        />
        {quietHoursPref.quietStart && (
          <View style={[styles.quietHoursRow, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <AppText variant="caption" weight="bold" style={[styles.quietHoursLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('notif.from')}</AppText>
            <TextInput
              style={[styles.quietHoursInput, { color: G.fg, borderColor: G.border }]}
              value={quietHoursPref.quietStart || ''}
              onChangeText={(v) => updatePreference('quiet_hours', { quietStart: v })}
              placeholder="22:00"
              placeholderTextColor={G.fgSecondary}
            />
            <AppText variant="caption" weight="bold" style={[styles.quietHoursLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('notif.to')}</AppText>
            <TextInput
              style={[styles.quietHoursInput, { color: G.fg, borderColor: G.border }]}
              value={quietHoursPref.quietEnd || ''}
              onChangeText={(v) => updatePreference('quiet_hours', { quietEnd: v })}
              placeholder="07:00"
              placeholderTextColor={G.fgSecondary}
            />
          </View>
        )}

        {/* Per category */}
        <View style={styles.sectionHeader}>
          <Package size={20} color={G.fg} />
          <AppText variant="subtitle" weight="bold" style={[styles.sectionTitle, { color: G.fg }]} numberOfLines={2}>
            {t('settings.inventory_alerts')}
          </AppText>
        </View>
        <AlertCard
          title={t('settings.stock_shortage')}
          subtitle={t('settings.stock_shortage_desc')}
          value={notifications.stock}
          onValueChange={() => toggle('stock')}
          icon={Package}
        />
        <AlertCard
          title={t('settings.expiration_status')}
          subtitle={t('settings.expiration_status_desc')}
          value={notifications.expiration}
          onValueChange={() => toggle('expiration')}
          icon={Clock}
        />

        <View style={styles.sectionHeader}>
          <LineChart size={20} color={G.fg} />
          <AppText variant="subtitle" weight="bold" style={[styles.sectionTitle, { color: G.fg }]} numberOfLines={2}>
            {t('settings.sales_alerts')}
          </AppText>
        </View>
        <AlertCard
          title={t('settings.daily_summary')}
          subtitle={t('settings.daily_summary_desc')}
          value={notifications.daily}
          onValueChange={() => toggle('daily')}
          icon={LineChart}
        />

        <View style={styles.sectionHeader}>
          <Wallet size={20} color={G.fg} />
          <AppText variant="subtitle" weight="bold" style={[styles.sectionTitle, { color: G.fg }]} numberOfLines={2}>
            {t('settings.credit_debt')}
          </AppText>
        </View>
        <AlertCard
          title={t('settings.credit_status')}
          subtitle={t('settings.credit_status_desc')}
          value={notifications.credit}
          onValueChange={() => toggle('credit')}
          icon={Wallet}
        />
        {featureFlags.customersEnabled && (
          <AlertCard
            title={t('settings.debt_status')}
            subtitle={t('settings.debt_status_desc')}
            value={notifications.debt}
            onValueChange={() => toggle('debt')}
            icon={CheckCircle2}
          />
        )}

        <AppText variant="caption" weight="medium" style={[styles.persistNote, { color: G.fgSecondary }]} numberOfLines={2}>
          {t('settings.auto_save')}
        </AppText>
      </ScrollView>
      <View style={{ position: 'absolute', top: 50, right: 20, zIndex: 100 }}>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerLabel: {
    fontFamily: Fonts.bold,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 20,
  },
  mainTitle: {
    fontFamily: Fonts.bold,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 25,
    marginBottom: 12,
  },
  sectionTitle: {

    fontFamily: Fonts.bold,
    fontWeight: '700',
    marginLeft: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    gap: 12,
    overflow: 'hidden',
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 15, fontFamily: Fonts.bold, fontWeight: '700', marginBottom: 3 },
  cardSubtitle: { fontSize: 12, fontFamily: Fonts.medium },
  persistNote: {
    textAlign: 'center',
    fontFamily: Fonts.medium,
    marginTop: 20,
    marginBottom: 20,
  },
  quietHoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    marginTop: -6,
    gap: 8,
    overflow: 'hidden',
  },
  quietHoursLabel: { fontSize: 12, fontFamily: Fonts.medium },
  quietHoursInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,

    fontFamily: Fonts.medium,
  },
  glowWash: { position: 'absolute' },
});

export default NotificationSettings;