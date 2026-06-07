// Notification settings screen
// Lets the user configure:
//   - Per-category enable / disable
//   - Push notification sound
//   - Vibration
//   - Quiet hours
//   - Test push + test toast

import React, { useEffect } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import {
  Bell,
  BellRing,
  Calendar,
  CheckCircle2,
  Clock,
  LineChart,
  MessageSquare,
  Package,
  Shield,
  Truck,
  Volume2,
  Wallet,
} from 'lucide-react-native';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/context/ToastContext';
import { useNotificationCenter } from '@/context/NotificationContext';
import { useRouter } from 'expo-router';
import { AppText, AppCard, AppButton, AppListItem, AppRow } from '@/components/ui';
const NotificationSettings = () => {
  const { notifications, setNotifications, colors, t } = useSettings();
  const { showToast } = useToast();
  const { preferences, updatePreference, reminders } = useNotificationCenter();
  const router = useRouter();

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
      const Notifications = require('expo-notifications');
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
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

  const triggerPushNotification = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const isExpoGo = Constants.appOwnership === 'expo';
    if (isExpoGo && Platform.OS === 'android') {
      showToast('Push notifications are disabled in Expo Go on Android.', 'error');
      return;
    }
    const Notifications = require('expo-notifications');
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'System Alert 🔔',
        body: 'This is a test push notification from Shega OS.',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 2,
      },
    });
    showToast('Test push scheduled (2s)', 'success');
  };

  const triggerPopupNotification = () => {
    showToast('This is a global pop-up notification!', 'info');
  };

  const AlertCard = ({ title, subtitle, value, onValueChange, icon: Icon }: any) => (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.cardIcon, { backgroundColor: colors.text + '08' }]}>
        {Icon ? <Icon size={18} color={colors.text} /> : null}
      </View>
      <View style={styles.cardText}>
        <AppText variant="body" weight="bold" style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>{title}</AppText>
        <AppText variant="body-sm" weight="medium" style={[styles.cardSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>{subtitle}</AppText>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#E5E5EA', true: colors.text }}
        thumbColor="#FFF"
      />
    </View>
  );

  const pushPref = getPref('push');
  const soundPref = getPref('sound');
  const vibrationPref = getPref('vibration');
  const quietHoursPref = getPref('quiet_hours');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.headerLabel, { color: colors.textSecondary }]} numberOfLines={2}>
          {t('settings.notification_settings')}
        </AppText>
        <AppText variant="display" weight="bold" style={[styles.mainTitle, { color: colors.text }]} numberOfLines={2}>{t('settings.notifications')}</AppText>

        {/* Test buttons */}
        <View style={styles.testButtonsContainer}>
          <TouchableOpacity
            style={[styles.testButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={triggerPopupNotification}
          >
            <MessageSquare size={18} color={colors.text} />
            <AppText variant="body" weight="bold" style={[styles.testButtonText, { color: colors.text }]} numberOfLines={1}>Test Pop-up</AppText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.testButton, { backgroundColor: colors.text, borderColor: colors.text }]}
            onPress={triggerPushNotification}
          >
            <BellRing size={18} color={colors.background} />
            <AppText variant="body" weight="bold" style={[styles.testButtonText, { color: colors.background }]} numberOfLines={1}>Test Push</AppText>
          </TouchableOpacity>
        </View>

        {/* Global delivery */}
        <View style={styles.sectionHeader}>
          <Shield size={20} color={colors.text} />
          <AppText variant="subtitle" weight="bold" style={[styles.sectionTitle, { color: colors.text }]} numberOfLines={1}>Global Delivery</AppText>
        </View>
        <AlertCard
          title="Push Notifications"
          subtitle="Send notifications to your device"
          value={pushPref.enabled}
          onValueChange={(v: boolean) => updatePreference('push', { enabled: v })}
          icon={Bell}
        />
        <AlertCard
          title="Sound"
          subtitle="Play a sound when a notification arrives"
          value={soundPref.enabled}
          onValueChange={(v: boolean) => updatePreference('sound', { enabled: v })}
          icon={Volume2}
        />
        <AlertCard
          title="Vibration"
          subtitle="Vibrate on new notifications"
          value={vibrationPref.enabled}
          onValueChange={(v: boolean) => updatePreference('vibration', { enabled: v })}
          icon={Clock}
        />
        <AlertCard
          title="Quiet Hours"
          subtitle="Mute notifications during set times"
          value={!!quietHoursPref.quietStart}
          onValueChange={(v: boolean) =>
            updatePreference('quiet_hours', { quietStart: v ? '22:00' : null, quietEnd: v ? '07:00' : null })
          }
          icon={Calendar}
        />
        {quietHoursPref.quietStart && (
          <View style={[styles.quietHoursRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <AppText variant="caption" weight="bold" style={[styles.quietHoursLabel, { color: colors.textSecondary }]} numberOfLines={1}>From</AppText>
            <TextInput
              style={[styles.quietHoursInput, { color: colors.text, borderColor: colors.border }]}
              value={quietHoursPref.quietStart || ''}
              onChangeText={(v) => updatePreference('quiet_hours', { quietStart: v })}
              placeholder="22:00"
              placeholderTextColor={colors.textSecondary}
            />
            <AppText variant="caption" weight="bold" style={[styles.quietHoursLabel, { color: colors.textSecondary }]} numberOfLines={1}>To</AppText>
            <TextInput
              style={[styles.quietHoursInput, { color: colors.text, borderColor: colors.border }]}
              value={quietHoursPref.quietEnd || ''}
              onChangeText={(v) => updatePreference('quiet_hours', { quietEnd: v })}
              placeholder="07:00"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
        )}

        {/* Per category */}
        <View style={styles.sectionHeader}>
          <Package size={20} color={colors.text} />
          <AppText variant="subtitle" weight="bold" style={[styles.sectionTitle, { color: colors.text }]} numberOfLines={2}>
            {t('settings.inventory_alerts')}
          </AppText>
        </View>
        <AlertCard
          title={t('settings.stock_shortage')}
          subtitle={t('settings.stock_shortage_desc')}
          value={notifications.stock}
          onValueChange={() => toggle('stock')}
        />
        <AlertCard
          title={t('settings.expiration_status')}
          subtitle={t('settings.expiration_status_desc')}
          value={notifications.expiration}
          onValueChange={() => toggle('expiration')}
        />

        <View style={styles.sectionHeader}>
          <LineChart size={20} color={colors.text} />
          <AppText variant="subtitle" weight="bold" style={[styles.sectionTitle, { color: colors.text }]} numberOfLines={2}>
            {t('settings.sales_alerts')}
          </AppText>
        </View>
        <AlertCard
          title={t('settings.daily_summary')}
          subtitle={t('settings.daily_summary_desc')}
          value={notifications.daily}
          onValueChange={() => toggle('daily')}
        />

        <View style={styles.sectionHeader}>
          <Wallet size={20} color={colors.text} />
          <AppText variant="subtitle" weight="bold" style={[styles.sectionTitle, { color: colors.text }]} numberOfLines={2}>
            {t('settings.credit_debt')}
          </AppText>
        </View>
        <AlertCard
          title={t('settings.credit_status')}
          subtitle={t('settings.credit_status_desc')}
          value={notifications.credit}
          onValueChange={() => toggle('credit')}
        />
        <AlertCard
          title={t('settings.debt_status')}
          subtitle={t('settings.debt_status_desc')}
          value={notifications.debt}
          onValueChange={() => toggle('debt')}
        />

        <AppText variant="caption" weight="medium" style={[styles.persistNote, { color: colors.textSecondary }]} numberOfLines={2}>
          {t('settings.auto_save')}
        </AppText>

        {/* Scheduled reminders shortcut */}
        <TouchableOpacity
          style={[styles.remindersBtn, { backgroundColor: colors.text, borderColor: colors.text }]}
          onPress={() => router.push('/reminders' as any)}
        >
          <Calendar size={18} color={colors.background} />
          <AppText variant="body" weight="bold" style={[styles.remindersBtnText, { color: colors.background }]} numberOfLines={1}>
            Manage Reminders
          </AppText>
          {reminders.length > 0 && (
            <View style={[styles.reminderBadge, { backgroundColor: colors.background }]}>
              <AppText variant="caption" weight="bold" style={[styles.reminderBadgeText, { color: colors.text }]} numberOfLines={1}>
                {reminders.length}
              </AppText>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF', paddingHorizontal: 25 },
  headerLabel: {

    fontFamily: Fonts.bold,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 20,
    color: '#888',
  },
  mainTitle: {

    fontFamily: Fonts.bold,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 20,
  },
  testButtonsContainer: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  testButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  testButtonText: { fontSize: 14, fontFamily: Fonts.bold, fontWeight: '700' },
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
    backgroundColor: '#FAFAFA',
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F2F2F7',
    gap: 12,
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
  cardSubtitle: { fontSize: 12, color: '#8E8E93', fontFamily: Fonts.medium },
  persistNote: {
    textAlign: 'center',
    color: '#C0C0C0',

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
  remindersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 18,
    gap: 8,
  },
  remindersBtnText: {

    fontFamily: Fonts.bold,
  },
  reminderBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  reminderBadgeText: {

    fontFamily: Fonts.bold,
    lineHeight: 14,
  },
});

export default NotificationSettings;
