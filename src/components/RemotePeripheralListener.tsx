import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { ScanBarcode, Camera, MonitorSmartphone, ShieldCheck, X, RefreshCw, Check } from 'lucide-react-native';

import BarcodeScannerView from '@/components/BarcodeScanner'; // default export = BarcodeScanner
import { AppText, AppButton } from '@/components/ui';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/context/ToastContext';
import { wsSyncClient } from '@/services/wsSyncClient';
import { companionService } from '@/services/companionService';
import { getCurrentUserId, getUser, effectivePermissions } from '@/services/businessService';

/**
 * Check if the active mobile user has permissions to respond to a desktop peripheral request.
 *  - Sales scope: sales.create, sales.view, cashier, manager, owner
 *  - Inventory scope: products.create, products.edit, inventory.manage, inventory, manager, owner
 */
function checkPeripheralPermission(scope: 'sales' | 'inventory'): { allowed: boolean; reason?: string } {
  try {
    const uid = getCurrentUserId();
    if (!uid) return { allowed: false, reason: 'No active user account logged in on mobile device.' };
    const user = getUser(uid);
    if (!user) return { allowed: false, reason: 'Mobile user account not found.' };
    if (user.isOwner || user.role === 'owner') return { allowed: true };
    const perms = effectivePermissions(user);
    if (scope === 'sales') {
      const hasSales = perms['sales.create'] === true || perms['sales.view'] === true || user.role === 'cashier' || user.role === 'manager';
      if (!hasSales) return { allowed: false, reason: 'Your mobile account lacks Sales permissions required for Desktop Barcode Scanner.' };
      return { allowed: true };
    } else {
      const hasInventory = perms['products.create'] === true || perms['products.edit'] === true || perms['inventory.manage'] === true || user.role === 'inventory' || user.role === 'manager' || user.role === 'warehouse';
      if (!hasInventory) return { allowed: false, reason: 'Your mobile account lacks Inventory permissions required for scanning barcodes / photos.' };
      return { allowed: true };
    }
  } catch {
    return { allowed: true }; // best effort fallback
  }
}

/**
 * RemotePeripheralListener — mounts app-wide (inside the WS-connected shell).
 *
 * Flow (peripheral spec):
 *  1. Desktop sends SCAN_REQUEST / CAPTURE_REQUEST.
 *  2. Permissions check validates active user role on mobile.
 *  3. A permission card asks the user to Allow or Cancel — camera NEVER opens automatically.
 *  4. On Allow: scanner (stays open for consecutive barcodes) or camera with preview + Retake / Use Photo.
 *  5. Result streams back to Shega Desktop in real time over WS/TCP.
 */
export function RemotePeripheralListener() {
  const { colors, t } = useSettings();
  const { showToast } = useToast();
  const [scanReq, setScanReq] = useState<{ requestId: string; scope: 'sales' | 'inventory' } | null>(null);
  const [photoReq, setPhotoReq] = useState<{ requestId: string; mode: string; scope: 'sales' | 'inventory' } | null>(null);
  const [pendingPermission, setPendingPermission] = useState<null | 'scan' | 'photo'>(null);
  const [activeSession, setActiveSession] = useState<{ kind: 'scan' | 'photo'; requestId: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [shotUri, setShotUri] = useState<string | null>(null);
  const offRef = useRef<Array<() => void>>([]);

  // Keep companion state in sync with requests & socket
  useEffect(() => {
    const offConn = wsSyncClient.onPeripheralEvent('connected', () => companionService.refreshConnection());
    const offDisc = wsSyncClient.onPeripheralEvent('disconnected', () => companionService.refreshConnection());
    return () => { offConn?.(); offDisc?.(); };
  }, []);

  useEffect(() => {
    const offs = [
      wsSyncClient.onPeripheralEvent('peripheralScanRequest', (payload: any) => {
        const scope = (payload?.scope as 'sales' | 'inventory') || 'sales';
        const perm = checkPeripheralPermission(scope);
        if (!perm.allowed) {
          wsSyncClient.sendScanResult(payload.requestId, '', 'denied');
          showToast(perm.reason || 'Permission denied', 'error');
          return;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        companionService.setMode('scanner');
        setPendingPermission('scan');
        setScanReq({ requestId: payload.requestId, scope });
      }),
      wsSyncClient.onPeripheralEvent('peripheralCaptureRequest', (payload: any) => {
        const mode = payload?.mode || 'photo';
        const scope = (payload?.scope as 'sales' | 'inventory') || (mode === 'photo' ? 'inventory' : 'sales');
        const perm = checkPeripheralPermission(scope);
        if (!perm.allowed) {
          wsSyncClient.sendCaptureResult(payload.requestId, { mode, cancelled: true, text: perm.reason });
          showToast(perm.reason || 'Permission denied', 'error');
          return;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (mode === 'photo') {
          companionService.setMode('camera');
          setPendingPermission('photo');
          setPhotoReq({ requestId: payload.requestId, mode: 'photo', scope });
        } else {
          companionService.setMode('scanner');
          setPendingPermission('scan');
          setScanReq({ requestId: payload.requestId, scope });
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

    if (wsSyncClient.isConnected) {
      Promise.resolve(wsSyncClient.registerAsPeripheral()).catch(() => {});
    }
    companionService.refreshConnection();
    return () => offs.forEach((off) => off?.());
  }, [showToast]);

  const cancelAll = useCallback((kind: 'scan' | 'photo') => {
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

  // ---------- Scanner session (stays open for consecutive barcodes) ----------
  const handleScan = useCallback(
    (result: { barcode: string; type?: string }) => {
      if (!scanReq) return;
      setLastScan(result.barcode);
      wsSyncClient.sendScanResult(scanReq.requestId, result.barcode, result.type);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    const shot = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      allowsEditing: true,
      aspect: [1, 1],
      base64: true,
    });
    if (shot.canceled || !shot.assets?.[0]) {
      cancelAll('photo');
      return;
    }
    const asset = shot.assets[0];
    const dataUrl = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
    setShotUri(dataUrl);
  }, [photoReq, cancelAll]);

  const retake = useCallback(() => setShotUri(null), []);

  const usePhoto = useCallback(async () => {
    if (!photoReq || !shotUri) return;
    setSending(true);
    try {
      wsSyncClient.sendCaptureResult(photoReq.requestId, { mode: 'photo', dataUrl: shotUri });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSending(false);
      setPhotoReq(null);
      setShotUri(null);
      setActiveSession(null);
      companionService.setMode('idle');
      showToast('Product photo sent to Shega Desktop', 'success');
    } catch {
      setSending(false);
      setSendError(true);
      setTimeout(() => setSendError(false), 2500);
    }
  }, [photoReq, shotUri, showToast]);

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
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  lastScanChip: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stopBtn: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: '#E74C3C',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  photoBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  photoCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  permIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: {
    width: 260,
    height: 260,
    borderRadius: 16,
    marginBottom: 8,
  },
});
