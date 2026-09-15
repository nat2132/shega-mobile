/**
 * RemoteLockListener — listens for a "force-lock" control message from the
 * business owner (relayed via P2P signaling or arriving on the sync data
 * channel) and immediately signs the device out with a clear explanation.
 *
 * This enforces owner decisions (device revoked / user deactivated) instantly,
 * instead of waiting for the next permission check on the device.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ShieldOff } from 'lucide-react-native';
import { useAccount } from '@/context/AccountContext';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/context/ToastContext';
import { wsSyncClient } from '@/services/wsSyncClient';
import { mobileWebRtc } from '@/services/webrtc-manager';
import { AppText } from '@/components/ui';
import { AppButton } from '@/components/AppButton';

export default function RemoteLockListener() {
  const { logout } = useAccount();
  const { colors } = useSettings();
  const { showToast } = useToast();
  const [locked, setLocked] = useState<string | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    const trigger = (reason: string) => {
      if (handled.current) return;
      handled.current = true;
      setLocked(reason);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      // Sign out locally; local data stays on the device but the session ends
      // and the sync context stops for this business.
      logout().catch(() => {});
    };

    // Control frames can arrive as signaling payloads…
    const offSignal = wsSyncClient.onSignal((msg: any) => {
      if (msg?.t === 'error' && msg?.reason === 'device-revoked') {
        trigger('You were removed from this business by the owner.');
      }
    });

    // …or as a marked control message on the Yjs data channel. Yjs updates are
    // binary Y documents; control frames are JSON with a marker key.
    const offUpdate = mobileWebRtc.on('update', (_biz, _from, update: Uint8Array) => {
      try {
        const text = typeof update === 'object' && update !== null
          ? new TextDecoder().decode(update)
          : String(update);
        if (text.startsWith('{') && text.includes('__shega_control__')) {
          const parsed = JSON.parse(text);
          if (parsed.__shega_control__ === 'force-lock') {
            trigger(parsed.reason || 'Your access was revoked by the owner.');
          }
          // Control frames are not Yjs updates — swallow them so Yjs never
          // tries to parse JSON as a document update.
          mobileWebRtc.suppressLastUpdate();
        }
      } catch { /* binary Yjs update — normal path */ }
    });

    return () => { offSignal(); offUpdate(); };
  }, [logout]);

  const G = colors as any;

  return (
    <Modal visible={locked !== null} transparent animationType="fade">
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
        <View style={[styles.card, { backgroundColor: G?.bgCard ?? '#fff' }]}>
          <View style={[styles.iconWrap, { backgroundColor: '#FF3B3018' }]}>
            <ShieldOff size={26} color="#FF3B30" />
          </View>
          <AppText variant="title" weight="bold" align="center" style={{ color: G?.fg ?? '#111' }}>
            Access removed
          </AppText>
          <AppText variant="body" align="center" style={{ color: G?.muted ?? '#666', marginTop: 6 }}>
            {locked}
          </AppText>
          <AppButton
            label="Sign in again"
            onPress={() => { setLocked(null); handled.current = false; }}
            fullWidth
            style={{ marginTop: 18 }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: { borderRadius: 24, padding: 24, width: '100%', alignItems: 'center' },
  iconWrap: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
});
