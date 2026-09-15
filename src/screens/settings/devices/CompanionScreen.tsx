/**
 * CompanionScreen — "Connected to Desktop" control panel.
 *
 * Shown when this phone is paired/registered as a desktop peripheral.
 * Deliberately minimal: connection state, current mode, disconnect. Large
 * touch targets, single-purpose — the phone is a peripheral here, not a POS.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  MonitorSmartphone, ScanLine, Camera, Moon, ChevronLeft,
  Wifi, WifiOff, RefreshCw,
} from 'lucide-react-native';
import { AppText, AppButton } from '@/components/ui';
import { useSettings } from '@/context/SettingsContext';
import { getSettingsGlass } from '../glass-settings';
import { companionService } from '@/services/companionService';
type CompanionSnapshot = ReturnType<typeof companionService.get>;
import { wsSyncClient } from '@/services/wsSyncClient';
import { mdnsDiscovery } from '@/services/mdnsDiscovery';
import { getActiveBusiness } from '@/services/businessService';

const STATE_DOT: Record<string, string> = {
  connected: '#2ECC71',
  connecting: '#FFB020',
  disconnected: '#9AA0A6',
};

export function CompanionScreen({ onBack }: { onBack: () => void }) {
  const { t, colors } = useSettings();
  const G = getSettingsGlass(colors);
  const [snap, setSnap] = useState<CompanionSnapshot>(companionService.get());
  const [businessName, setBusinessName] = useState('');

  useEffect(() => {
    const off = companionService.subscribe(setSnap);
    companionService.refreshConnection();
    const t = setInterval(() => companionService.refreshConnection(), 10000);
    setBusinessName(getActiveBusiness()?.name || '');
    return () => { off(); clearInterval(t); };
  }, []);

  const connected = snap.state === 'connected';
  const modeIcon = snap.mode === 'scanner' ? ScanLine : snap.mode === 'camera' ? Camera : Moon;
  const ModeIcon = modeIcon;
  const modeLabel = snap.mode === 'scanner'
    ? 'Barcode Scanner — ready for desktop requests'
    : snap.mode === 'camera'
      ? 'Camera — ready for desktop requests'
      : 'Idle — waiting for desktop requests';

  const disconnect = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await companionService.disconnect();
    onBack();
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack} style={styles.backBar}>
        <ChevronLeft size={22} color={G.fg} />
        <AppText variant="body" weight="bold" style={{ color: G.fg, flex: 1 }}>
          Connected to Desktop
        </AppText>
      </TouchableOpacity>

      {/* Hero status */}
      <View style={[styles.hero, { backgroundColor: G.bgCard, borderColor: G.border }]}>
        <View style={[styles.heroIcon, { backgroundColor: connected ? '#2ECC7118' : '#9AA0A618' }]}>
          <MonitorSmartphone size={30} color={connected ? '#2ECC71' : '#9AA0A6'} />
        </View>
        <AppText variant="title" weight="bold" style={{ color: G.fg, marginTop: 10 }}>
          {businessName || 'Shega Desktop'}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <View style={[styles.dot, { backgroundColor: STATE_DOT[snap.state] }]} />
          <AppText variant="body" weight="bold" style={{ color: G.fg, textTransform: 'capitalize' }}>
            {snap.state}
          </AppText>
        </View>
        <AppText variant="caption" weight="medium" style={{ color: G.muted, marginTop: 4 }}>
          {connected
            ? 'This phone is acting as a POS peripheral'
            : 'Not connected — open the POS link on the same Wi-Fi'}
        </AppText>
      </View>

      {/* Current mode */}
      <View style={[styles.card, { backgroundColor: G.bgCard, borderColor: G.border }]}>
        <View style={[styles.modeIcon, { backgroundColor: G.accentGlass }]}>
          <ModeIcon size={20} color={G.fg} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="body" weight="bold" style={{ color: G.fg }}>Current mode</AppText>
          <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={2}>
            {modeLabel}
          </AppText>
        </View>
      </View>

      {/* Connection detail */}
      <View style={[styles.card, { backgroundColor: G.bgCard, borderColor: G.border }]}>
        <View style={styles.row}>
          {connected ? <Wifi size={17} color="#2ECC71" /> : <WifiOff size={17} color={G.muted} />}
          <AppText variant="body" weight="bold" style={{ color: G.fg, marginLeft: 10, flex: 1 }}>
            Connection
          </AppText>
          <AppText variant="caption" weight="bold" style={{ color: connected ? '#2ECC71' : G.muted }}>
            {connected ? 'LAN · synced' : 'Offline'}
          </AppText>
        </View>
        <TouchableOpacity
          style={[styles.row, { marginTop: 12 }]}
          onPress={() => { Haptics.selectionAsync(); companionService.refreshConnection(); mdnsDiscovery.start(); }}
        >
          <RefreshCw size={17} color={G.fg} />
          <AppText variant="body" weight="bold" style={{ color: G.fg, marginLeft: 10, flex: 1 }}>
            Reconnect
          </AppText>
        </TouchableOpacity>
      </View>

      {/* Availability switch */}
      <View style={[styles.card, { backgroundColor: G.bgCard, borderColor: G.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <View style={{ flex: 1 }}>
            <AppText variant="body" weight="bold" style={{ color: G.fg }}>Available for requests</AppText>
            <AppText variant="caption" weight="medium" style={{ color: G.muted }}>
              Desktop can ask to scan or take photos
            </AppText>
          </View>
          <Switch
            value={connected}
            onValueChange={(v) => {
              Haptics.selectionAsync();
              if (!v) void disconnect();
              else { wsSyncClient.registerAsPeripheral(); companionService.refreshConnection(); }
            }}
            trackColor={{ false: G.border, true: '#2ECC7160' }}
            thumbColor={connected ? '#2ECC71' : G.muted}
          />
        </View>
      </View>

      <AppButton
        label="Disconnect from Desktop"
        variant="danger"
        fullWidth
        onPress={disconnect}
        style={{ marginTop: 18 }}
      />

      <AppText variant="caption" weight="medium" style={{ color: G.muted, textAlign: 'center', marginTop: 14, paddingHorizontal: 20 }}>
        The camera never opens without your approval. You can reject or cancel any request.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 56 },
  backBar: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18 },
  hero: {
    borderRadius: 24, borderWidth: 1, padding: 24, alignItems: 'center', marginBottom: 14,
  },
  heroIcon: {
    width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
  },
  dot: { width: 9, height: 9, borderRadius: 5 },
  card: { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 10 },
  modeIcon: {
    width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
});
