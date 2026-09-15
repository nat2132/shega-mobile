import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  Building2,
  CheckCircle2,
  Clock,
  Handshake,
  MapPin,
  MonitorUp,
  Package,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Users,
  Wifi,
  WifiOff,
  XCircle,
} from 'lucide-react-native';
import { useToast } from '@/context/ToastContext';
import { useSettings } from '@/context/SettingsContext';
import { useSync } from '@/context/SyncContext';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { AppNumber, AppText } from '@/components/ui';
import { getDashGlass } from '@/screens/dashboard/glass-dashboard';
import {
  approveDevice,
  getActiveBusiness,
  getDefaultBusiness,
  getDevices,
  getLocations,
  getRegisters,
  getUsers,
} from '@/services/businessService';
import {
  getDashboardStats,
  getDebtCustomers,
  getLowStockItems,
} from '@/database/db';

// §38 — Business Overview. One glance at the whole business: sales today,
// low stock, outstanding debt, devices, sync status, employees, registers,
// locations, and pending device approvals with actions.

export default function BusinessOverview() {
  const { colors, featureFlags } = useSettings();
  const G = getDashGlass(colors);
  const { showToast } = useToast();
  const { unifiedStatus } = useSync();
  const { business, user, can } = useBusinessAuth();

  const biz = business ?? getActiveBusiness() ?? getDefaultBusiness();
  const bizId = biz?.id ?? '';

  const [salesToday, setSalesToday] = useState<{ revenue: number; count: number }>({ revenue: 0, count: 0 });
  const [outstandingDebt, setOutstandingDebt] = useState<{ count: number; total: number }>({ count: 0, total: 0 });
  const [lowStock, setLowStock] = useState<number>(0);
  const [users, setUsers] = useState<any[]>([]);
  const [registers, setRegisters] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    try {
      const stats = getDashboardStats();
      setSalesToday({
        revenue: stats?.today?.revenue ?? 0,
        count: stats?.today?.salesCount ?? 0,
      });
      const debt = featureFlags.customersEnabled ? getDebtCustomers() : [];
      setOutstandingDebt({
        count: debt.length,
        total: debt.reduce((s: number, d: any) => s + (Number(d.oweAmount) || 0), 0),
      });
      setLowStock(getLowStockItems().length);
      setUsers(bizId ? getUsers(bizId) : []);
      setRegisters(bizId ? getRegisters(bizId) : []);
      setLocations(bizId ? getLocations(bizId) : []);
      setDevices(bizId ? getDevices(bizId) : []);
    } finally {
      setLoading(false);
    }
  }, [bizId]);

  useEffect(() => {
    load();
  }, [load]);

  const pendingApprovals = useMemo(
    () => devices.filter((d) => d.status === 'pending'),
    [devices]
  );
  const onlineDevices = useMemo(
    () =>
      devices.filter(
        (d) =>
          d.status === 'active' &&
          d.lastSeenAt &&
          Date.now() - new Date(d.lastSeenAt).getTime() < 5 * 60 * 1000
      ),
    [devices]
  );

  const canApproveDevices = can('devices.manage') || !!user?.isOwner;

  const doApprove = (device: any) => {
    if (!bizId || !user) return;
    approveDevice(device.id, user.id, device.role || 'cashier', device.registerId);
    showToast(`${device.name || 'Device'} approved`, 'success');
    load();
  };

  const synced = unifiedStatus?.health === 'synced';
  const isOffline = unifiedStatus?.health === 'offline';
  const transactionCount = unifiedStatus?.pendingOutbound ?? 0;

  type StatDef = { key: string; icon: any; label: string; value: number; isCurrency?: boolean; color: string; onPress?: () => void };
  const stats: StatDef[] = [
    { key: 'sales', icon: ShoppingCart, label: 'Sales today', value: salesToday.revenue, isCurrency: true, color: colors.success || '#2ECC71' },
    ...(featureFlags.customersEnabled ? [{ key: 'debt', icon: Handshake, label: 'Outstanding debt', value: outstandingDebt.total, isCurrency: true, color: colors.error || '#E74C3C' }] : []),
    { key: 'low', icon: Package, label: 'Low stock items', value: lowStock, color: colors.warning || '#FFB020' },
    { key: 'devices', icon: Smartphone, label: 'Devices', value: devices.length, color: G?.fg || '#2F6FED' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Business identity + sync health */}
        <View style={[styles.hero, { backgroundColor: G?.bgCard, borderColor: G?.border }]}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Building2 size={20} color={G?.fg} />
            </View>
            <View style={styles.heroText}>
              <AppText variant="heading" weight="bold" style={{ color: G?.fg }} numberOfLines={2}>
                {biz?.name || 'My Business'}
              </AppText>
              <AppText variant="caption" style={{ color: G?.muted }} numberOfLines={1}>
                {users.length} employee{users.length === 1 ? '' : 's'} · {registers.length} register{registers.length === 1 ? '' : 's'} · {locations.length} location{locations.length === 1 ? '' : 's'}
              </AppText>
            </View>
          </View>

          {/* Sync status chip */}
          <View style={[styles.syncChip, { backgroundColor: synced ? (colors.success + '18') : isOffline ? (colors.error + '18') : (colors.warning + '18') }]}>
            {synced ? (
              <CheckCircle2 size={14} color={colors.success || '#2ECC71'} />
            ) : isOffline ? (
              <XCircle size={14} color={colors.error || '#E74C3C'} />
            ) : (
              <Clock size={14} color={colors.warning || '#FFB020'} />
            )}
            <AppText variant="caption" weight="bold" style={{ color: synced ? (colors.success || '#2ECC71') : isOffline ? (colors.error || '#E74C3C') : (colors.warning || '#FFB020') }}>
              {synced ? 'Everything synchronized' : isOffline ? 'Offline' : `${transactionCount} pending sync`}
            </AppText>
          </View>
        </View>

        {/* Stat grid */}
        <View style={styles.statsGrid}>
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <View key={s.key} style={[styles.statCard, { backgroundColor: G?.bgCard, borderColor: G?.border }]}>
                <View style={[styles.statIcon, { backgroundColor: s.color + '20' }]}>
                  <Icon size={18} color={s.color} />
                </View>
                <AppNumber
                  value={s.value}
                  size="display"
                  showCurrency={s.isCurrency}
                  fallback="—"
                  style={styles.statValue}
                />
                <AppText variant="caption" weight="medium" style={[styles.statLabel, { color: G?.muted }]} numberOfLines={2}>
                  {s.label}
                </AppText>
              </View>
            );
          })}
        </View>

        {/* Pending approvals */}
        <View style={[styles.card, { backgroundColor: G?.bgCard, borderColor: G?.border }]}>
          <View style={styles.cardHead}>
            <ShieldCheck size={16} color={G?.fg} />
            <AppText variant="body" weight="bold" style={{ color: G?.fg, marginLeft: 8 }}>Pending approvals</AppText>
            {pendingApprovals.length > 0 ? (
              <View style={[styles.badge, { backgroundColor: colors.error + '20' }]}>
                <AppText variant="caption" weight="bold" style={{ color: colors.error }}>{pendingApprovals.length}</AppText>
              </View>
            ) : null}
          </View>

          {pendingApprovals.length === 0 ? (
            <AppText variant="caption" style={{ color: G?.muted, marginTop: 8 }}>No pending device approvals</AppText>
          ) : (
            pendingApprovals.map((d) => (
              <View key={d.id} style={[styles.approvalRow, { borderColor: G?.border }]}>
                <Smartphone size={16} color={colors.warning || '#FFB020'} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <AppText variant="body-sm" weight="bold" style={{ color: G?.fg }} numberOfLines={1}>{d.name || d.id.slice(0, 8)}</AppText>
                  <AppText variant="caption" style={{ color: G?.muted }} numberOfLines={1}>
                    {d.platform} device waiting for approval
                  </AppText>
                </View>
                {canApproveDevices ? (
                  <Pressable style={[styles.approveBtn, { backgroundColor: colors.success || '#2ECC71' }]} onPress={() => doApprove(d)}>
                    <AppText variant="caption" weight="bold" style={{ color: '#FFFFFF' }}>Approve</AppText>
                  </Pressable>
                ) : null}
              </View>
            ))
          )}
        </View>

        {/* Devices & sync */}
        <View style={[styles.card, { backgroundColor: G?.bgCard, borderColor: G?.border }]}>
          <View style={styles.cardHead}>
            <Wifi size={16} color={G?.fg} />
            <AppText variant="body" weight="bold" style={{ color: G?.fg, marginLeft: 8 }}>Devices & sync</AppText>
          </View>
          <View style={styles.metaRow}>
            <Smartphone size={14} color={G?.muted} />
            <AppText variant="body-sm" style={{ color: G?.fg, marginLeft: 8 }}>{devices.length} device{devices.length === 1 ? '' : 's'}</AppText>
            <View style={{ flex: 1 }} />
            <AppText variant="caption" weight="bold" style={{ color: colors.success || '#2ECC71' }}>
              {onlineDevices.length} online
            </AppText>
          </View>
          <View style={styles.metaRow}>
            {synced ? <Wifi size={14} color={colors.success || '#2ECC71'} /> : <WifiOff size={14} color={colors.error || '#E74C3C'} />}
            <AppText variant="body-sm" style={{ color: G?.fg, marginLeft: 8 }}>
              Last sync: {unifiedStatus?.lastSyncAt ? new Date(unifiedStatus.lastSyncAt).toLocaleString() : 'never'}
            </AppText>
          </View>
        </View>

        {/* Team */}
        <View style={[styles.card, { backgroundColor: G?.bgCard, borderColor: G?.border }]}>
          <View style={styles.cardHead}>
            <Users size={16} color={G?.fg} />
            <AppText variant="body" weight="bold" style={{ color: G?.fg, marginLeft: 8 }}>Team</AppText>
          </View>
          <View style={styles.metaRow}>
            <Users size={14} color={G?.muted} />
            <AppText variant="body-sm" style={{ color: G?.fg, marginLeft: 8 }}>{users.length} employees</AppText>
          </View>
          <View style={styles.metaRow}>
            <MonitorUp size={14} color={G?.muted} />
            <AppText variant="body-sm" style={{ color: G?.fg, marginLeft: 8 }}>{registers.length} registers</AppText>
          </View>
          <View style={styles.metaRow}>
            <MapPin size={14} color={G?.muted} />
            <AppText variant="body-sm" style={{ color: G?.fg, marginLeft: 8 }}>{locations.length} locations</AppText>
          </View>
        </View>

        {loading && (
          <View style={{ alignItems: 'center', padding: 12 }}>
            <ActivityIndicator color={G?.fg} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 40 },
  hero: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    marginBottom: 14,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center' },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  heroText: { flex: 1 },
  syncChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  statCard: {
    width: '48%',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { fontSize: 24 },
  statLabel: { marginTop: 2 },
  card: { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  badge: {
    marginLeft: 8,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approvalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  approveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
});
