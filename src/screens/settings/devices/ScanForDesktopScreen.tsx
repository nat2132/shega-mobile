/**
 * ScanForDesktopScreen — "Use as Barcode Scanner".
 *
 * The phone-initiated counterpart to the RemotePeripheralListener flow: instead
 * of waiting for the desktop to ask, the user opens this screen, scans a
 * product, and the barcode is pushed straight to the connected Shega Desktop,
 * which looks the product up and appends it to the sales cart it already has
 * open. Nothing is configured on the desktop side.
 *
 * If no checkout is open there, the desktop answers `no_active_sale` and this
 * screen says so — it never starts a sale on the phone.
 *
 * Rendered full-screen by the caller (not inside a bottom sheet): the camera
 * surface swaps in place of the status panel, so there is only ever one modal
 * in the tree.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  MonitorSmartphone, ScanLine, Wifi, WifiOff, RefreshCw, X, ChevronLeft,
  CheckCircle2, AlertTriangle, XCircle,
} from 'lucide-react-native';
import type { PeripheralScanPushResult } from '@shega/shared';

import BarcodeScannerView from '@/components/BarcodeScanner';
import { AppButton, AppText } from '@/components/ui';
import { useSettings } from '@/context/SettingsContext';
import { getSettingsGlass } from '../glass-settings';
import { wsSyncClient } from '@/services/wsSyncClient';
import { companionService } from '@/services/companionService';
import { mdnsDiscovery } from '@/services/mdnsDiscovery';
import { getActiveBusiness } from '@/services/businessService';

const GREEN = '#2ECC71';
const AMBER = '#FFB020';
const RED = '#E74C3C';

type Verdict = 'ok' | 'warn' | 'bad';

/** How a desktop verdict should read on the phone. */
function describe(result: PeripheralScanPushResult | null): { tone: Verdict; title: string; detail: string } | null {
  if (!result) return null;
  switch (result.status) {
    case 'added':
      return { tone: 'ok', title: `Added ${result.productName || 'item'} to the cart`, detail: result.barcode };
    case 'not_found':
      return { tone: 'warn', title: 'No matching product on the desktop', detail: result.message || result.barcode };
    case 'out_of_stock':
      return { tone: 'warn', title: result.productName ? `${result.productName} is out of stock` : 'Out of stock', detail: result.barcode };
    case 'no_active_sale':
      return { tone: 'bad', title: 'No active sale on Shega Desktop', detail: result.message || 'Open a sales cart on the desktop, then scan again.' };
    default:
      return { tone: 'bad', title: 'Could not add to the desktop cart', detail: result.message || 'Check the desktop is connected and try again.' };
  }
}

const TONE_COLOR: Record<Verdict, string> = { ok: GREEN, warn: AMBER, bad: RED };

export function ScanForDesktopScreen({ onClose }: { onClose: () => void }) {
  const { colors } = useSettings();
  const G = getSettingsGlass(colors);

  const [connected, setConnected] = useState(wsSyncClient.isConnected);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<PeripheralScanPushResult | null>(null);
  const [businessName, setBusinessName] = useState('');
  const sendingRef = useRef(false);

  useEffect(() => {
    setBusinessName(getActiveBusiness()?.name || '');
    const refresh = () => setConnected(wsSyncClient.isConnected);
    refresh();
    const timer = setInterval(refresh, 3000);
    companionService.refreshConnection();
    return () => clearInterval(timer);
  }, []);

  // Leaving the screen must not leave the desktop thinking we are mid-scan.
  useEffect(() => () => { companionService.setMode('idle'); }, []);

  const openScanner = useCallback(() => {
    Haptics.selectionAsync();
    setResult(null);
    setScanning(true);
    // Reuses the existing companion beacon so the desktop UI can show that this
    // phone is scanning right now.
    companionService.setMode('scanner');
  }, []);

  const closeScanner = useCallback(() => {
    setScanning(false);
    companionService.setMode('idle');
  }, []);

  const handleScan = useCallback(async (scan: { barcode: string; type?: string }) => {
    // The scanner view already has its own repeat cooldown, but a slow desktop
    // must not queue a second push on top of one still in flight.
    if (sendingRef.current) return;
    sendingRef.current = true;
    try {
      const verdict = await wsSyncClient.pushScan(scan.barcode, scan.type);
      setResult(verdict || { ok: false, status: 'error', barcode: scan.barcode, message: 'Desktop sent no result' });
      Haptics.notificationAsync(
        verdict?.ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
      );
    } catch (e: any) {
      setResult({
        ok: false,
        status: 'unavailable',
        barcode: scan.barcode,
        message: e?.message || 'Could not reach Shega Desktop',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      sendingRef.current = false;
    }
  }, []);

  const reconnect = useCallback(() => {
    Haptics.selectionAsync();
    try { mdnsDiscovery.start(); } catch { /* discovery restart is best-effort */ }
    companionService.refreshConnection();
    setConnected(wsSyncClient.isConnected);
  }, []);

  const view = describe(result);

  // ── Camera surface ──
  if (scanning) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <BarcodeScannerView
          onScan={handleScan as any}
          onClose={closeScanner}
          onManualEntry={() => {}}
          silent
        />

        <View style={styles.remoteBanner} pointerEvents="none">
          <MonitorSmartphone size={18} color="#fff" />
          <AppText variant="caption" weight="bold" style={{ color: '#fff' }} numberOfLines={1}>
            Sending to {businessName || 'Shega Desktop'} · added automatically
          </AppText>
        </View>

        {view ? (
          <View style={[styles.lastScanChip, { backgroundColor: TONE_COLOR[view.tone] + 'CC' }]}>
            {view.tone === 'ok'
              ? <CheckCircle2 size={16} color="#fff" />
              : view.tone === 'warn'
                ? <AlertTriangle size={16} color="#fff" />
                : <XCircle size={16} color="#fff" />}
            <AppText variant="caption" weight="bold" style={{ color: '#fff' }} numberOfLines={1}>
              {view.title}
            </AppText>
          </View>
        ) : null}

        <TouchableOpacity style={styles.stopBtn} onPress={closeScanner}>
          <X size={16} color="#fff" />
          <AppText variant="caption" weight="bold" style={{ color: '#fff' }}>Done</AppText>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Status / setup surface ──
  const ResultIcon = view?.tone === 'ok' ? CheckCircle2 : view?.tone === 'warn' ? AlertTriangle : XCircle;

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onClose} style={styles.backBar}>
        <ChevronLeft size={22} color={G.fg} />
        <AppText variant="body" weight="bold" style={{ color: G.fg, flex: 1 }}>
          Use as Barcode Scanner
        </AppText>
      </TouchableOpacity>

      {/* Connection hero */}
      <View style={[styles.hero, { backgroundColor: G.bgCard, borderColor: G.border }]}>
        <View style={[styles.heroIcon, { backgroundColor: connected ? GREEN + '18' : '#9AA0A618' }]}>
          <MonitorSmartphone size={28} color={connected ? GREEN : '#9AA0A6'} />
        </View>
        <AppText variant="title" weight="bold" style={{ color: G.fg, marginTop: 10 }}>
          {businessName || 'Shega Desktop'}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
          {connected ? <Wifi size={14} color={GREEN} /> : <WifiOff size={14} color={G.muted} />}
          <AppText variant="caption" weight="bold" style={{ color: connected ? GREEN : G.muted }}>
            {connected ? 'Connected' : 'Not connected'}
          </AppText>
        </View>
        <AppText variant="caption" weight="medium" style={{ color: G.muted, marginTop: 6, textAlign: 'center' }}>
          {connected
            ? 'Scan a product barcode — it goes straight to the sales cart on your desktop.'
            : 'Open Shega Desktop on the same Wi-Fi, hotspot or LAN, then reconnect.'}
        </AppText>
      </View>

      {/* Last verdict */}
      {view ? (
        <View style={[styles.resultCard, { backgroundColor: G.bgCard, borderColor: G.border }]}>
          <ResultIcon size={20} color={TONE_COLOR[view.tone]} />
          <View style={{ flex: 1 }}>
            <AppText variant="body" weight="bold" style={{ color: G.fg }} numberOfLines={2}>
              {view.title}
            </AppText>
            <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={2}>
              {view.detail}
            </AppText>
          </View>
        </View>
      ) : null}

      {connected ? (
        <AppButton
          label="Open Scanner"
          variant="primary"
          fullWidth
          leftIcon={<ScanLine size={18} color="#fff" />}
          onPress={openScanner}
          style={{ marginTop: 6 }}
        />
      ) : (
        <AppButton
          label="Reconnect"
          variant="secondary"
          fullWidth
          leftIcon={<RefreshCw size={18} color={G.fg} />}
          onPress={reconnect}
          style={{ marginTop: 6 }}
        />
      )}

      <AppText variant="caption" weight="medium" style={{ color: G.muted, textAlign: 'center', marginTop: 14, paddingHorizontal: 12 }}>
        No setup is needed on the desktop. Scanned items are added to whichever sales cart is open there.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 56 },
  backBar: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  hero: { borderRadius: 24, borderWidth: 1, padding: 20, alignItems: 'center', marginBottom: 12 },
  heroIcon: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  resultCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 12,
  },
  remoteBanner: {
    position: 'absolute', top: 50, left: 20, right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  lastScanChip: {
    position: 'absolute', bottom: 100, alignSelf: 'center',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    maxWidth: '86%',
  },
  stopBtn: {
    position: 'absolute', bottom: 40, alignSelf: 'center',
    backgroundColor: '#E74C3C', borderRadius: 24,
    paddingHorizontal: 24, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
});

export default ScanForDesktopScreen;
