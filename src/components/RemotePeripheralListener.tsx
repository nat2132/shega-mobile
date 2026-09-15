import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { ScanBarcode, Camera, MonitorSmartphone, ShieldCheck, X, RefreshCw, Check } from 'lucide-react-native';

import BarcodeScannerView from '@/components/BarcodeScanner'; // default export = BarcodeScanner
import { AppText, AppButton } from '@/components/ui';
import { useSettings } from '@/context/SettingsContext';
import { wsSyncClient } from '@/services/wsSyncClient';
import { companionService } from '@/services/companionService';

/**
 * RemotePeripheralListener — mounts app-wide (inside the WS-connected shell).
 *
 * Flow (peripheral spec):
 *  1. Desktop sends SCAN_REQUEST / CAPTURE_REQUEST.
 *  2. A permission card asks the user to Allow or Cancel — the camera NEVER
 *     opens automatically on a desktop request.
 *  3. On Allow: scanner (stays open for the next barcode until cancelled)
 *     or camera with preview + Retake / Use Photo.
 *  4. Result streams back over the LAN socket. Companion mode is reported.
 */
export function RemotePeripheralListener() {
  const { colors, t } = useSettings();
  const [scanReq, setScanReq] = useState<{ requestId: string } | null>(null);
  const [photoReq, setPhotoReq] = useState<{ requestId: string; mode: string } | null>(null);
  // Explicit user approval stage — camera never opens before this.
  const [pendingPermission, setPendingPermission] = useState<null | 'scan' | 'photo'>(null);
  const [activeSession, setActiveSession] = useState<{ kind: 'scan' | 'photo'; requestId: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [shotUri, setShotUri] = useState<string | null>(null);
  const offRef = useRef<Array<() => void>>([]);

  // Keep companion state in sync with requests & the socket.
  useEffect(() => {
    const offConn = wsSyncClient.onPeripheralEvent('connected', () => companionService.refreshConnection());
    const offDisc = wsSyncClient.onPeripheralEvent('disconnected', () => companionService.refreshConnection());
    return () => { offConn?.(); offDisc?.(); };
  }, []);

  useEffect(() => {
    const offs = [
      wsSyncClient.onPeripheralEvent('peripheralScanRequest', (payload: any) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        companionService.setMode('scanner');
        setPendingPermission('scan');
        setScanReq({ requestId: payload.requestId });
      }),
      wsSyncClient.onPeripheralEvent('peripheralCaptureRequest', (payload: any) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (payload.mode === 'photo') {
          companionService.setMode('camera');
          setPendingPermission('photo');
          setPhotoReq({ requestId: payload.requestId, mode: 'photo' });
        } else {
          companionService.setMode('scanner');
          setPendingPermission('scan');
          setScanReq({ requestId: payload.requestId });
        }
      }),
      wsSyncClient.onPeripheralEvent('peripheralCancel', (payload: any) => {
        setScanReq((r) => (r?.requestId === payload.requestId ? null : r));
        setPhotoReq((r) => (r?.requestId === payload.requestId ? null : r));
        setPendingPermission(null);
        setActiveSession(null);
        setShotUri(null);
        companionService.setMode('idle');
      }),
    ];
    offRef.current = offs;
    // Announce ourselves whenever the socket is live.
    if (wsSyncClient.isConnected) {
      Promise.resolve(wsSyncClient.registerAsPeripheral()).catch(() => {});
    }
    companionService.refreshConnection();
    return () => offs.forEach((off) => off?.());
  }, []);

  const cancelAll = useCallback((kind: 'scan' | 'photo', requestId?: string) => {
    if (kind === 'scan') {
      if (scanReq) wsSyncClient.sendScanResult(scanReq.requestId, '', 'cancelled');
      setScanReq(null);
    } else {
      if (photoReq) wsSyncClient.sendCaptureResult(photoReq.requestId, { mode: 'photo', cancelled: true });
      setPhotoReq(null);
    }
    setPendingPermission(null);
    setActiveSession(null);
    setShotUri(null);
    companionService.setMode('idle');
  }, [scanReq, photoReq]);

  // ---------- Scanner session (stays open for the next barcode) ----------
  const handleScan = useCallback(
    (result: { barcode: string; type?: string }) => {
      if (!scanReq) return;
      setLastScan(result.barcode);
      wsSyncClient.sendScanResult(scanReq.requestId, result.barcode, result.type);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Keep scanning — desktop decides when the request ends (per spec,
      // "keep the scanner ready for the next barcode unless finished").
    },
    [scanReq],
  );

  // ---------- Photo flow ----------
  const openCameraForPhoto = useCallback(async () => {
    if (!photoReq) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      cancelAll('photo');
      return;
    }
    const shot = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: false, exif: false });
    if (shot.canceled || !shot.assets?.[0]?.uri) {
      cancelAll('photo');
      return;
    }
    setShotUri(shot.assets[0].uri);
  }, [photoReq, cancelAll]);

  const retake = useCallback(() => setShotUri(null), []);

  const usePhoto = useCallback(async () => {
    if (!photoReq || !shotUri) return;
    setSending(true);
    try {
      // Read the file as base64 through the bundler-safe fetch path.
      const resp = await fetch(shotUri);
      const blob = await resp.blob();
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      wsSyncClient.sendCaptureResult(photoReq.requestId, { mode: 'photo', dataUrl });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSending(false);
      setPhotoReq(null);
      setShotUri(null);
      setActiveSession(null);
      companionService.setMode('idle');
    } catch {
      setSending(false);
      setSendError(true);
      setTimeout(() => setSendError(false), 2500);
    }
  }, [photoReq, shotUri]);

  const G = colors as any;

  const permissionCard = (kind: 'scan' | 'photo') => (
    <View style={[styles.photoCard, { backgroundColor: G.card }]}>
      <View style={[styles.permIcon, { backgroundColor: G.primary + '18' }]}>
        {kind === 'scan'
          ? <ScanBarcode size={30} color={G.primary} />
          : <Camera size={30} color={G.primary} />}
      </View>
      <AppText variant="title" weight="bold" style={{ color: G.text, marginTop: 12, textAlign: 'center' }}>
        {kind === 'scan'
          ? 'Use this phone as a barcode scanner?'
          : 'Use this phone camera to take a product photo?'}
      </AppText>
      <AppText variant="body-sm" weight="medium" style={{ color: G.textSecondary, textAlign: 'center', marginTop: 6 }}>
        {'Shega Desktop on your network wants to '}
        {kind === 'scan' ? 'scan a barcode' : 'capture a product image'}.
        Nothing opens without your approval.
      </AppText>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 20, alignSelf: 'stretch' }}>
        <View style={{ flex: 1 }}>
          <AppButton
            label="Cancel"
            variant="secondary"
            fullWidth
            onPress={() => cancelAll(kind)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <AppButton
            label="Allow"
            variant="primary"
            fullWidth
            onPress={() => {
              const req = kind === 'scan' ? scanReq : photoReq;
              if (!req) return;
              setPendingPermission(null);
              setActiveSession({ kind, requestId: req.requestId });
              Haptics.selectionAsync();
              if (kind === 'photo') void openCameraForPhoto();
            }}
          />
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 }}>
        <ShieldCheck size={13} color={G.textSecondary} />
        <AppText variant="micro" weight="medium" style={{ color: G.textSecondary }}>
          Only your paired desktop can send requests. You can disconnect anytime.
        </AppText>
      </View>
    </View>
  );

  return (
    <>
      {/* Permission gate */}
      <Modal visible={!!pendingPermission} transparent animationType="fade">
        <View style={styles.photoBackdrop}>
          {pendingPermission === 'scan' ? permissionCard('scan') : pendingPermission === 'photo' ? permissionCard('photo') : null}
        </View>
      </Modal>

      {/* Scanner session */}
      <Modal visible={!!scanReq && !pendingPermission} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <BarcodeScannerView
            onScan={handleScan as any}
            onClose={() => cancelAll('scan')}
            onManualEntry={() => {}}
            silent
          />
          <View style={styles.remoteBanner} pointerEvents="none">
            <MonitorSmartphone size={18} color="#fff" />
            <AppText variant="caption" weight="bold" style={{ color: '#fff' }} numberOfLines={1}>
              Scanning for desktop · results sent automatically
            </AppText>
          </View>
          {lastScan ? (
            <View style={[styles.lastScanChip, { backgroundColor: '#2ECC71CC' }]}>
              <Check size={16} color="#fff" />
              <AppText variant="caption" weight="bold" style={{ color: '#fff' }} numberOfLines={1}>
                {lastScan}
              </AppText>
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.stopBtn}
            onPress={() => cancelAll('scan')}
          >
            <X size={16} color="#fff" />
            <AppText variant="caption" weight="bold" style={{ color: '#fff' }}>Done</AppText>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Photo preview / transfer */}
      <Modal visible={(!photoReq ? false : !pendingPermission) || sending || sendError} transparent animationType="fade">
        <View style={styles.photoBackdrop}>
          {sendError ? (
            <View style={[styles.photoCard, { backgroundColor: G.card }]}>
              <AppText variant="title" weight="bold" style={{ color: G.error }}>
                Could not send the photo
              </AppText>
              <AppText variant="body-sm" style={{ color: G.textSecondary, textAlign: 'center', marginTop: 6 }}>
                The desktop may have disconnected. Try again.
              </AppText>
              <AppButton label="OK" fullWidth style={{ marginTop: 16 }} onPress={() => { setSendError(false); cancelAll('photo'); }} />
            </View>
          ) : shotUri ? (
            <View style={[styles.photoCard, { backgroundColor: G.card }]}>
              <Image source={{ uri: shotUri }} style={styles.preview} resizeMode="cover" />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, alignSelf: 'stretch' }}>
                <View style={{ flex: 1 }}>
                  <AppButton label="Retake" variant="secondary" fullWidth onPress={retake} leftIcon={<RefreshCw size={15} color={G.text} />} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppButton label="Use Photo" variant="primary" fullWidth onPress={usePhoto} loading={sending} />
                </View>
              </View>
            </View>
          ) : (
            <View style={[styles.photoCard, { backgroundColor: G.card, alignItems: 'center' }]}>
              <ActivityIndicator size="large" color={G.primary} />
              <AppText variant="body" weight="bold" style={{ color: G.text, marginTop: 12 }}>
                Preparing camera…
              </AppText>
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  remoteBanner: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  lastScanChip: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  stopBtn: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
  },
  photoBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  photoCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 22,
    padding: 24,
  },
  permIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  preview: {
    width: '100%',
    height: 220,
    borderRadius: 14,
    backgroundColor: '#000',
  },
});
