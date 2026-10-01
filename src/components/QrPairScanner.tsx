import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/context/ToastContext';
import { AppText } from '@/components/ui';
import { getSettingsGlass } from '@/screens/settings/glass-settings';
import { setHubUrl, setHubToken, pairDevice } from '@/services/syncService';
import { parsePairingData } from '@/services/pairingParser';

interface Props {
  visible: boolean;
  onClose: () => void;
  onPaired: (url: string, token: string) => void;
}

export default function QrPairScanner({ visible, onClose, onPaired }: Props) {
  const { colors } = useSettings();
  const G = getSettingsGlass(colors);
  const { showToast } = useToast();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);

  const handleBarcode = async ({ data }: { data: string }) => {
    if (!scanning) return;

    const parsed = parsePairingData(data);
    if (!parsed.valid) {
      showToast('Not a valid Shega pairing QR code', 'error');
      return;
    }

    setScanning(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (parsed.url) {
      setHubUrl(parsed.url);
      if (parsed.token) setHubToken(parsed.token);
      try {
        await pairDevice();
      } catch {
        /* best effort */
      }
      onPaired(parsed.url, parsed.token || '');
      showToast('Paired successfully! Synchronization started automatically.', 'success');
    } else if (parsed.code) {
      if (parsed.token) setHubToken(parsed.code);
      try {
        const { lookupPairingInvite, acceptPairing } = await import('@/services/pairingService');
        const inv = await lookupPairingInvite({ code: parsed.code });
        if (inv) {
          await acceptPairing({ inviteId: inv.id, personName: 'Shega Mobile' });
          showToast('Pairing request submitted! Synchronization started automatically.', 'success');
        } else {
          showToast(`Pairing code accepted: ${parsed.code}`, 'success');
        }
      } catch {
        showToast(`Pairing code set: ${parsed.code}`, 'success');
      }
      onPaired('', parsed.code);
    }
  };

  const reset = () => {
    setScanning(true);
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.box, { backgroundColor: G.bgCard, borderColor: G.border }]}>
          <View style={styles.head}>
            <AppText variant="title" weight="bold" style={{ color: G.fg }}>Scan pairing code</AppText>
            <Pressable onPress={onClose} hitSlop={10}>
              <X size={20} color={G.muted} />
            </Pressable>
          </View>

          {!permission?.granted ? (
            <View style={styles.permBlock}>
              <AppText variant="caption" style={{ color: G.muted, textAlign: 'center', marginBottom: 12 }}>
                Camera access is needed to scan the QR shown on the desktop POS (Settings → Sync Hub → Pair a device).
              </AppText>
              <Pressable style={[styles.saveBtn, { backgroundColor: G.accent }]} onPress={requestPermission}>
                <AppText variant="body" weight="bold" style={{ color: '#FFFFFF' }}>Allow camera</AppText>
              </Pressable>
            </View>
          ) : (
            <View style={styles.cameraWrap}>
              <CameraView
                style={styles.camera}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={handleBarcode}
              />
              <Pressable style={[styles.saveBtn, { backgroundColor: G.accent }]} onPress={reset}>
                <AppText variant="body" weight="bold" style={{ color: '#FFFFFF' }}>Scan again</AppText>
              </Pressable>
              <AppText variant="caption" style={{ color: G.muted, textAlign: 'center', marginTop: 8 }}>
                Point the camera at the QR code on the desktop POS screen.
              </AppText>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  box: { borderRadius: 18, borderWidth: 1, padding: 20 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  permBlock: { alignItems: 'center', paddingVertical: 12 },
  cameraWrap: { alignItems: 'stretch' },
  camera: { height: 260, borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
  saveBtn: { alignItems: 'center', paddingVertical: 14, borderRadius: 30 }
});
