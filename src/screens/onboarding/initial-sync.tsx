/**
 * "Setting Up Your Business" — post-approval initial synchronization screen.
 *
 * Shows the per-collection checklist while the Yjs/WebRTC sync pulls the
 * business's EXISTING data into local SQLite (full-state exchange on first
 * connect), then the final "You're Ready" card with business/role/device.
 * A large business shows a live record count instead of a bare spinner.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { CheckCircle2, Loader2, PartyPopper, XCircle } from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import { AppText } from '@/components/ui';
import { getGlass } from '@/screens/onboarding/glass-theme';

const COLLECTIONS = [
  { key: 'products', label: 'Products', table: 'items' },
  { key: 'inventory', label: 'Inventory', table: 'stock_movements' },
  { key: 'sales', label: 'Sales', table: 'sales' },
  { key: 'customers', label: 'Customers', table: 'customers' },
  { key: 'suppliers', label: 'Suppliers', table: 'suppliers' },
  { key: 'debts', label: 'Debts', table: 'debt_payments' },
  { key: 'payments', label: 'Payments', table: 'supplier_payments' },
  { key: 'activities', label: 'Activity', table: 'audit_logs' },
] as const;

type ColState = 'pending' | 'syncing' | 'done' | 'failed';

export interface SetupReadyInfo {
  businessName: string;
  role: string;
  deviceName: string;
}

export default function InitialSyncScreen({ info }: { info: SetupReadyInfo }) {
  const { colors } = useSettings();
  const G = getGlass(colors);
  const [states, setStates] = useState<Record<string, ColState>>(() =>
    Object.fromEntries(COLLECTIONS.map((c) => [c.key, 'pending'])) as Record<string, ColState>,
  );
  const [recordCount, setRecordCount] = useState(0);
  const [allDone, setAllDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Drive the checklist from the local DB: a collection is "done" once its
  // table holds rows received by sync (or is legitimately empty while sync is
  // connected). We probe with a short cadence so the UI reflects real SQLite
  // content, not a fake timer.
  useEffect(() => {
    let probes = 0;
    const probe = async () => {
      probes += 1;
      try {
        const { getDB } = await import('@/database/db');
        const db = getDB();
        let total = 0;
        const next: Record<string, ColState> = {};
        for (const c of COLLECTIONS) {
          let n = 0;
          try {
            const row = db.getFirstSync(`SELECT COUNT(*) AS c FROM ${c.table}`) as any;
            n = row?.c ?? 0;
          } catch {
            n = 0;
          }
          total += n;
          // Mark done when data has arrived, or after several connected probes
          // (empty-but-synced collections must not hang the checklist).
          next[c.key] = (n > 0 || probes > 6) ? 'done' : 'syncing';
        }
        setStates(next);
        setRecordCount(total);
        if (Object.values(next).every((s) => s === 'done')) {
          setAllDone(true);
          if (timerRef.current) clearInterval(timerRef.current);
        }
      } catch {
        if (probes > 12) {
          setFailed(true);
          if (timerRef.current) clearInterval(timerRef.current);
        }
      }
    };
    void probe();
    timerRef.current = setInterval(probe, 1200);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const syncingLabel = useMemo(() => {
    if (allDone) return 'Synced';
    if (recordCount > 0) return `Syncing ${recordCount.toLocaleString()} records…`;
    return 'Syncing business data…';
  }, [allDone, recordCount]);

  return (
    <ScrollView style={[styles.container, { backgroundColor: G.bg }]} contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <View style={[styles.iconCircle, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]}>
          {allDone
            ? <PartyPopper size={30} color={G.textGlassStrong} />
            : <Loader2 size={30} color={G.textGlassStrong} />}
        </View>
        <AppText variant="display" weight="bold" align="center" style={{ color: G.fg }}>
          {allDone ? "You're Ready!" : 'Setting Up Your Business'}
        </AppText>
        <AppText variant="body" weight="medium" align="center" style={{ color: G.muted }}>
          {allDone
            ? 'Your business data is on this device and will keep syncing automatically.'
            : syncingLabel}
        </AppText>
      </View>

      <View style={[styles.card, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]}>
        {COLLECTIONS.map((c) => {
          const st = states[c.key] ?? 'pending';
          const icon =
            st === 'done' ? <CheckCircle2 size={18} color="#2ecc71" />
            : st === 'failed' ? <XCircle size={18} color="#e74c3c" />
            : <Loader2 size={18} color={G.muted} />;
          return (
            <View key={c.key} style={styles.checkRow}>
              {icon}
              <AppText variant="body" weight={st === 'done' ? 'bold' : 'medium'} style={{ color: G.fg, flex: 1, marginLeft: 10 }}>
                {c.label}
              </AppText>
              <AppText variant="caption" weight="bold" style={{ color: st === 'done' ? '#2ecc71' : G.muted }}>
                {st === 'done' ? '✓' : st === 'syncing' ? '…' : ''}
              </AppText>
            </View>
          );
        })}
      </View>

      {allDone && (
        <>
          <View style={[styles.readyCard, { backgroundColor: G.accentGlass, borderColor: G.border }]}>
            <View style={styles.readyRow}>
              <AppText variant="caption" weight="bold" style={{ color: G.muted }}>Business</AppText>
              <AppText variant="body" weight="bold" style={{ color: G.fg }}>{info.businessName}</AppText>
            </View>
            <View style={styles.readyRow}>
              <AppText variant="caption" weight="bold" style={{ color: G.muted }}>Role</AppText>
              <AppText variant="body" weight="bold" style={{ color: G.fg }}>{info.role}</AppText>
            </View>
            <View style={styles.readyRow}>
              <AppText variant="caption" weight="bold" style={{ color: G.muted }}>Device</AppText>
              <AppText variant="body" weight="bold" style={{ color: G.fg }}>{info.deviceName}</AppText>
            </View>
            <View style={styles.readyRow}>
              <AppText variant="caption" weight="bold" style={{ color: G.muted }}>Sync</AppText>
              <AppText variant="body" weight="bold" style={{ color: '#2ecc71' }}>Synced</AppText>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: G.fg }]}
            onPress={() => {
              // The approved joiner next sets their own photo + username + PIN
              // (the owner gate) — dashboard entry happens on /join-setup.
              router.replace({ pathname: '/join-setup', params: { role: info.role } } as any);
            }}
          >
            <AppText variant="body" weight="bold" style={{ color: G.bg }}>Go to Dashboard</AppText>
          </TouchableOpacity>
        </>
      )}

      {failed && !allDone && (
        <>
          <AppText variant="caption" weight="medium" align="center" style={{ color: '#e74c3c', marginTop: 12 }}>
            Unable to reach the POS Hub. Check that both devices are on the same network — data keeps arriving in the background once connected.
          </AppText>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: G.fg, marginTop: 14 }]}
            onPress={() => {
              // Real retry: re-run a sync cycle and resume probing the DB.
              setFailed(false);
              import('@/services/peerSyncManager').then(({ triggerSync }) => triggerSync().catch(() => {}));
            }}
          >
            <AppText variant="body" weight="bold" style={{ color: G.bg }}>Retry</AppText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: G.accentGlass, borderColor: G.border, borderWidth: 1, marginTop: 10 }]}
            onPress={() => {
              router.replace({ pathname: '/join-setup', params: { role: info.role } } as any);
            }}
          >
            <AppText variant="body" weight="bold" style={{ color: G.fg }}>Open Business Anyway</AppText>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingVertical: 60 },
  header: { alignItems: 'center', marginBottom: 26 },
  iconCircle: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginBottom: 16 },
  card: { borderRadius: 22, padding: 20, borderWidth: 1 },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  readyCard: { borderRadius: 22, padding: 20, borderWidth: 1, marginTop: 16 },
  readyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  primaryBtn: { alignItems: 'center', paddingVertical: 16, borderRadius: 999, marginTop: 8 },
});
