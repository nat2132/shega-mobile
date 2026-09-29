import React, { useCallback, useEffect, useState } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ArrowLeft, Smartphone, Monitor, Loader2, CheckCircle, XCircle, Wifi, WifiOff, RefreshCw, Trash2, Copy } from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import { AppText } from '@/components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { fetchMyPayment, fetchDeviceEntitlements, resolveLicenseId } from '@/services/api';
import { handleApiError } from '@/services/api';
import { isOfflineError, OFFLINE_MESSAGE } from '@/services/connectivity';
import { safeBackOrFallback } from '@/services/navigation';

interface Device {
  id: number;
  device_id: string;
  device_name: string | null;
  operating_system: string | null;
  device_type: 'MOBILE' | 'DESKTOP';
  is_active: boolean;
  last_seen: string | null;
  activation_date: string;
  ip_address: string | null;
}

export default function ConnectedDevicesScreen() {
  const { colors, t } = useSettings();

  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const licenseId = await resolveLicenseId();
      if (!licenseId) {
        setDevices([]);
        setError('No active license for this account.');
        return;
      }
      const entitlements = await fetchDeviceEntitlements(licenseId);
      // Transform entitlements to device list
      const deviceList = entitlements.map((e) => ({
        id: e.id,
        device_id: e.device_type + '-' + e.id,
        device_name: e.device_type + ' Device',
        operating_system: 'Mobile',
        device_type: e.device_type,
        // Server vocabulary is available | assigned | expired; `used` is what
        // older cached payloads carried. Anything not `available` is consumed.
        is_active: e.status !== 'available',
        last_seen: e.updated_at || e.created_at,
        activation_date: e.created_at,
        ip_address: '0.0.0.0',
      }));
      setDevices(deviceList);
    } catch (err: any) {
      const handled = handleApiError(err);
      if (isOfflineError(err)) setError(OFFLINE_MESSAGE);
      else setError(handled.message || 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const copyDeviceId = (id: string) => {
    Alert.alert('Copied', 'Device ID copied to clipboard');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const formatLastSeen = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getStatusBadge = (device: Device) => {
    if (!device.is_active) {
      return (
        <View style={styles.badgeInactive}>
          <WifiOff size={10} color={colors.textSecondary} />
          <AppText variant="micro" weight="bold" style={{ color: colors.textSecondary }}>Disconnected</AppText>
        </View>
      );
    }
    return (
      <View style={styles.badgeActive}>
        <Wifi size={10} color={colors.success} />
        <AppText variant="micro" weight="bold" style={{ color: colors.success }}>Active</AppText>
      </View>
    );
  };

  const renderIcon = (type: string) => type === 'MOBILE' ? <Smartphone size={20} color={colors.text} /> : <Monitor size={20} color={colors.text} />;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeBackOrFallback('/subscription/manage')} style={styles.backButton}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <AppText variant="heading" weight="bold" style={{ color: colors.text }}>{t('subscription.connected_devices')}</AppText>
        <TouchableOpacity onPress={loadData} disabled={loading} style={styles.refreshButton}>
          <RefreshCw size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View style={styles.centerBox}>
            <Loader2 size={28} color={colors.textSecondary} />
            <AppText variant="body" weight="medium" style={{ color: colors.textSecondary, marginTop: 12 }}>Loading devices…</AppText>
          </View>
        ) : error ? (
          <View style={styles.centerBox}>
            <XCircle size={28} color={colors.error} />
            <AppText variant="body" weight="medium" style={{ color: colors.error, marginTop: 12 }}>{error}</AppText>
            <TouchableOpacity onPress={loadData} style={styles.retryButton} activeOpacity={0.7}>
              <AppText variant="body" weight="bold" style={{ color: colors.primary }}>Retry</AppText>
            </TouchableOpacity>
          </View>
        ) : devices.length === 0 ? (
          <View style={styles.centerBox}>
            <Smartphone size={48} color={colors.textSecondary} />
            <AppText variant="body" weight="medium" style={{ color: colors.textSecondary, marginTop: 12 }}>No devices connected</AppText>
            <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary, marginTop: 4 }}>Register a device from the Subscription page</AppText>
          </View>
        ) : (
          <View style={styles.deviceList}>
            {devices.map((device) => (
              <TouchableOpacity
                key={device.id}
                style={[styles.deviceCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                activeOpacity={0.85}
              >
                <View style={[styles.deviceIcon, { backgroundColor: colors.primary + '15' }]}>
                  {renderIcon(device.device_type)}
                </View>
                <View style={styles.deviceInfo}>
                  <AppText variant="body" weight="bold" style={{ color: colors.text }} numberOfLines={1}>
                    {device.device_name || device.device_id}
                  </AppText>
                  <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary, marginTop: 2 }}>
                    {device.device_type} · Last seen {formatLastSeen(device.last_seen)}
                  </AppText>
                  <AppText variant="micro" weight="medium" style={{ color: colors.textSecondary, marginTop: 2 }}>
                    ID: {device.device_id}
                  </AppText>
                </View>
                <View style={styles.deviceActions}>
                  {getStatusBadge(device)}
                  <TouchableOpacity onPress={() => copyDeviceId(device.device_id)} style={styles.actionBtn}>
                    <Copy size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  backButton: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  refreshButton: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  centerBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  retryButton: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.1)' },
  deviceList: { gap: 12 },
  deviceCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  deviceIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  deviceInfo: { flex: 1, minWidth: 0 },
  deviceActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.05)' },
  badgeActive: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: '#34C75915' },
  badgeInactive: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.08)' },
});