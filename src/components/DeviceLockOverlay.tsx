import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ShieldX, Lock, MinusCircle } from 'lucide-react-native';
import { AppText } from '@/components/ui';
import { useSettings } from '@/context/SettingsContext';
import { getSettingsGlass } from '@/screens/settings/glass-settings';
import { useDeviceEnforcement } from '@/hooks/useDeviceEnforcement';

/**
 * Full-screen, non-dismissible blocker side of remote device control (spec
 * §17/§18). When THIS device's status synced from the business is locked /
 * disabled / removed, this overlay covers the whole app so the user cannot
 * sign in, transact, or reach management screens. Clearing requires the owner
 * or manager to change the status remotely, which the next sync applies and
 * lifts the overlay.
 */
export function DeviceLockOverlay() {
  const { colors } = useSettings();
  const G = getSettingsGlass(colors);
  const { blocked, status, reason } = useDeviceEnforcement();

  if (!blocked) return null;

  const Icon = status === 'locked' ? Lock : status === 'removed' ? MinusCircle : ShieldX;
  const accent = status === 'locked' ? G.warning : G.error;

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: G.bg }]}>
      <View style={[styles.card, { backgroundColor: G.bgCard, borderColor: G.border }]}>
        <View style={[styles.iconWrap, { backgroundColor: status === 'locked' ? '#FF950022' : '#FF3B3022' }]}>
          <Icon size={34} color={accent} />
        </View>
        <AppText variant="heading-lg" weight="bold" align="center" style={[styles.title, { color: G.fg }]}>
          {status === 'locked' ? 'Device Locked' : status === 'disabled' ? 'Device Disabled' : 'Device Removed'}
        </AppText>
        <AppText variant="body" weight="medium" align="center" style={[styles.subtitle, { color: G.fgSecondary }]}>
          {reason}
        </AppText>
        <AppText variant="caption" weight="medium" align="center" style={[styles.hint, { color: G.muted }]}>
          Access will be restored automatically by the owner when this device is re-enabled.
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { zIndex: 9999, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { alignItems: 'center', padding: 28, borderRadius: 24, borderWidth: 1, maxWidth: 420, width: '100%' },
  iconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  title: { marginBottom: 10 },
  subtitle: { marginBottom: 16, lineHeight: 20 },
  hint: { lineHeight: 18 },
});
