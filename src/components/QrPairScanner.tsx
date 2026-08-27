import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { X } from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/context/ToastContext';
import { AppText } from '@/components/ui';
import { getSettingsGlass } from '@/screens/settings/glass-settings';
import { setHubUrl, setHubToken } from '@/services/syncService';

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

  const handleBarcode = ({ data }: { data: string }) => {
    if (!scanning) return;
    const m = /shega:\/\/pair\?url=([^&]+)&token=([^&]+)/.exec(data);
    if (!m) {
      showToast('Not a Shega pairing QR', 'error');
      return;
    }
    const url = decodeURIComponent(m[1]);
    const token = decodeURIComponent(m[2]);
    setScanning(false);
    setHubUrl(url);
    setHubToken(token);
    onPaired(url, token);
    showToast('Paired! Verify with Sync now', 'success');
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
