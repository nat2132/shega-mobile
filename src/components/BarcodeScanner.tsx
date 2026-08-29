import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { playNice, playBad } from '@/services/soundService';
import { useSettings } from '@/context/SettingsContext';
import { getSalesGlass } from '@/screens/sales/glass-sales';
import { AppText } from '@/components/ui';
import { Camera as CameraIcon, X, Flashlight, FlashlightOff, RotateCcw, Barcode as BarcodeIcon } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, interpolate } from 'react-native-reanimated';

export interface BarcodeScanResult {
  barcode: string;
  type: string;
  bounds?: { x: number; y: number; width: number; height: number };
}

interface BarcodeScannerProps {
  onScan: (result: BarcodeScanResult) => void;
  onClose: () => void;
  onManualEntry: () => void;
  onError?: (error: Error) => void;
  torchEnabled?: boolean;
  scanInterval?: number;
  barcodeTypes?: string[];
  showTorchToggle?: boolean;
  showCameraFlip?: boolean;
  showManualEntry?: boolean;
  silent?: boolean;
}

const SUPPORTED_BARCODE_TYPES = [
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code128',
  'code39',
  'code93',
  'codabar',
  'itf',
  'qr_code',
  'pdf417',
  'aztec',
  'data_matrix',
];

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onScan,
  onClose,
  onManualEntry,
  onError,
  torchEnabled = false,
  scanInterval = 100,
  barcodeTypes = SUPPORTED_BARCODE_TYPES,
  showTorchToggle = true,
  showCameraFlip = true,
  showManualEntry = true,
  silent = false,
}) => {
  const { colors, t } = useSettings();
  const SALES_GLASS = getSalesGlass(colors);
  const [permission, requestPermission] = useCameraPermissions();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [torchOn, setTorchOn] = useState(torchEnabled);
  const [cameraType, setCameraType] = useState<'front' | 'back'>('back');
  const [error, setError] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');

  const lastScanTime = useRef<number>(0);
  const scanCooldown = useRef<number>(1500);
  const isMounted = useRef(true);
  const scanCount = useRef(0);

  const scanLineAnim = useSharedValue(0);
  const scannerFrameAnim = useSharedValue(0);

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(scanLineAnim.value, [0, 1], [-120, 120]) }],
  }));
  const frameStyle = useAnimatedStyle(() => ({
    opacity: scannerFrameAnim.value,
  }));

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (permission?.granted) {
      setHasPermission(true);
      startScanLineAnimation();
    } else if (permission?.canAskAgain === false) {
      setHasPermission(false);
      setError(t('barcode.camera_permission_denied') || 'Camera permission denied');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission]);

  const startScanLineAnimation = () => {
    scanLineAnim.value = 0;
    scannerFrameAnim.value = 0;
    const animate = () => {
      if (!isMounted.current) return;
      scanLineAnim.value = withTiming(1, { duration: 2000, easing: (t) => t }, () => {
        if (isMounted.current) {
          scanLineAnim.value = 0;
          animate();
        }
      });
      scannerFrameAnim.value = withTiming(1, { duration: 1000, easing: (t) => t }, () => {
        if (isMounted.current) {
          scannerFrameAnim.value = 0;
        }
      });
    };
    animate();
  };

  const handleBarcodeScanned = useCallback(({ data, type, bounds }: { data: string; type: string; bounds?: any }) => {
    const now = Date.now();
    if (now - lastScanTime.current < scanCooldown.current) {
      return;
    }
    if (scanned) return;

    const barcode = data.trim();
    if (!barcode || barcode.length < 4) return;

    lastScanTime.current = now;
    scanCount.current += 1;

    if (scanCount.current > 1 && now - lastScanTime.current < 3000) {
      return;
    }

    setScanned(true);
    if (!silent) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      playNice();
    }

    onScan({
      barcode,
      type: type.toUpperCase(),
      bounds,
    });

    setTimeout(() => {
      if (isMounted.current) {
        setScanned(false);
      }
    }, 500);
  }, [onScan, scanned, silent]);

  const handlePermissionRequest = async () => {
    const { status } = await requestPermission();
    if (status === 'granted') {
      setHasPermission(true);
      setError(null);
      startScanLineAnimation();
    } else {
      setHasPermission(false);
      setError(t('barcode.camera_permission_denied') || 'Camera permission denied');
    }
  };

  const toggleTorch = () => {
    setTorchOn((prev) => !prev);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const flipCamera = () => {
    setCameraType((prev) => (prev === 'back' ? 'front' : 'back'));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleManualSubmit = () => {
    const barcode = manualBarcode.trim();
    if (!barcode) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      playBad();
      return;
    }
    if (barcode.length < 4) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      playBad();
      Alert.alert(
        t('barcode.invalid_title') || 'Invalid Barcode',
        t('barcode.invalid_message') || 'Barcode must be at least 4 characters'
      );
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playNice();
    onScan({
      barcode,
      type: 'MANUAL',
    });
    setShowManualInput(false);
    setManualBarcode('');
  };

  const renderScannerUI = () => {
    if (hasPermission === false) {
      return (
        <View style={styles.permissionContainer}>
          <View style={[styles.permissionCard, { backgroundColor: SALES_GLASS.bgCard, borderColor: SALES_GLASS.border }]}>
            <CameraIcon size={48} color={SALES_GLASS.muted} style={styles.permissionIcon} />
            <AppText variant="heading" weight="bold" style={[styles.permissionTitle, { color: SALES_GLASS.fg }]} numberOfLines={2}>
              {t('barcode.camera_access_required') || 'Camera Access Required'}
            </AppText>
            <AppText variant="body" style={[styles.permissionMessage, { color: SALES_GLASS.fgSecondary }]} numberOfLines={3}>
              {t('barcode.camera_permission_message') || 'Please enable camera permission in settings to scan barcodes.'}
            </AppText>
            <TouchableOpacity
              style={[styles.permissionButton, { backgroundColor: SALES_GLASS.fg }]}
              onPress={handlePermissionRequest}
            >
              <AppText variant="body" weight="bold" style={{ color: SALES_GLASS.bg }} numberOfLines={1}>
                {t('barcode.grant_permission') || 'Grant Permission'}
              </AppText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.permissionCancelButton}
              onPress={onClose}
            >
              <AppText variant="body" weight="medium" style={{ color: SALES_GLASS.fgSecondary }} numberOfLines={1}>
                {t('common.cancel') || 'Cancel'}
              </AppText>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (hasPermission === null) {
      return (
        <View style={styles.loadingContainer}>
          <AppText variant="body" style={{ color: SALES_GLASS.fgSecondary }} numberOfLines={1}>
            {t('barcode.requesting_permission') || 'Requesting camera permission...'}
          </AppText>
        </View>
      );
    }

    return (
      <>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing={cameraType}
          onBarcodeScanned={handleBarcodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: barcodeTypes as any,
          }}
        >
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={styles.scannerOverlay}>
              <Animated.View
                style={[
                  styles.scanLine,
                  {
                    backgroundColor: colors.primary,
                  },
                  scanLineStyle,
                ]}
              />
              <Animated.View
                style={[
                  styles.scannerFrame,
                  {
                    borderColor: colors.primary,
                  },
                  frameStyle,
                ]}
              />
            </View>

            <View style={styles.topBar}>
              <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
                <X size={24} color={SALES_GLASS.fg} />
              </TouchableOpacity>
              <AppText variant="caption" weight="bold" transform="uppercase" style={{ color: SALES_GLASS.fg, letterSpacing: 1 }} numberOfLines={1}>
                {t('barcode.scanning') || 'SCANNING'}
              </AppText>
              <View style={{ width: 40 }} />
            </View>

            <View style={styles.bottomBar}>
              {showTorchToggle && (
                <TouchableOpacity
                  style={[styles.controlButton, torchOn && { backgroundColor: colors.warning + '30' }]}
                  onPress={toggleTorch}
                  activeOpacity={0.7}
                >
                  {torchOn ? (
                    <Flashlight size={24} color={colors.warning} />
                  ) : (
                    <FlashlightOff size={24} color={SALES_GLASS.fgSecondary} />
                  )}
                </TouchableOpacity>
              )}

              {showCameraFlip && (
                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={flipCamera}
                  activeOpacity={0.7}
                >
                  <RotateCcw size={24} color={SALES_GLASS.fg} />
                </TouchableOpacity>
              )}

              {showManualEntry && (
                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={() => setShowManualInput(true)}
                  activeOpacity={0.7}
                >
                  <BarcodeIcon size={24} color={SALES_GLASS.fg} />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.hintContainer}>
              <AppText variant="caption" weight="medium" style={{ color: SALES_GLASS.fgSecondary, textAlign: 'center' }} numberOfLines={2}>
                {t('barcode.align_hint') || 'Align barcode within the frame'}
              </AppText>
            </View>
          </View>
        </CameraView>
      </>
    );
  };

  if (showManualInput) {
    return (
      <View style={styles.manualContainer}>
        <View style={[styles.manualCard, { backgroundColor: SALES_GLASS.bgCard, borderColor: SALES_GLASS.border }]}>
          <View style={styles.manualHeader}>
            <AppText variant="heading" weight="bold" style={[styles.manualTitle, { color: SALES_GLASS.fg }]} numberOfLines={1}>
              {t('barcode.manual_entry') || 'Manual Barcode Entry'}
            </AppText>
            <TouchableOpacity onPress={() => { setShowManualInput(false); setManualBarcode(''); }} style={styles.manualClose}>
              <X size={20} color={SALES_GLASS.fgSecondary} />
            </TouchableOpacity>
          </View>
          <AppText variant="body" style={[styles.manualHint, { color: SALES_GLASS.fgSecondary }]} numberOfLines={2}>
            {t('barcode.manual_hint') || 'Enter the barcode number manually'}
          </AppText>
          <TextInput
            style={[
              styles.manualInput,
              { color: SALES_GLASS.fg, backgroundColor: SALES_GLASS.bg, borderColor: SALES_GLASS.border },
            ]}
            placeholder={t('barcode.placeholder') || 'Enter barcode...'}
            placeholderTextColor={SALES_GLASS.fgSecondary}
            value={manualBarcode}
            onChangeText={setManualBarcode}
            keyboardType="numeric"
            autoFocus
            maxLength={64}
            onSubmitEditing={handleManualSubmit}
          />
          <View style={styles.manualActions}>
            <TouchableOpacity
              style={[styles.manualCancelBtn, { borderColor: SALES_GLASS.border }]}
              onPress={() => { setShowManualInput(false); setManualBarcode(''); }}
            >
              <AppText variant="body" weight="medium" style={{ color: SALES_GLASS.fgSecondary }} numberOfLines={1}>
                {t('common.cancel') || 'Cancel'}
              </AppText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.manualSubmitBtn, { backgroundColor: SALES_GLASS.fg }]}
              onPress={handleManualSubmit}
            >
              <AppText variant="body" weight="bold" style={{ color: SALES_GLASS.bg }} numberOfLines={1}>
                {t('common.confirm') || 'Confirm'}
              </AppText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: 'black' }]}>
      {renderScannerUI()}
      {error && (
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.errorOverlay}>
            <AppText variant="body" weight="medium" style={{ color: colors.error, textAlign: 'center', paddingHorizontal: 20 }} numberOfLines={3}>
              {error}
            </AppText>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'black',
  },
  permissionCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
  },
  permissionIcon: {
    marginBottom: 16,
  },
  permissionTitle: {
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 12,
  },
  permissionMessage: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  permissionButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  permissionCancelButton: {
    paddingVertical: 12,
  },
  scannerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanLine: {
    position: 'absolute',
    width: 260,
    height: 2,
    borderRadius: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  scannerFrame: {
    width: 280,
    height: 160,
    borderWidth: 3,
    borderRadius: 16,
    borderColor: 'transparent',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 30,
    paddingBottom: 50,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hintContainer: {
    position: 'absolute',
    bottom: 140,
    left: 20,
    right: 20,
  },
  errorOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 100,
  },
  manualContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  manualCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    width: '100%',
    maxWidth: 380,
  },
  manualHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  manualTitle: {
    fontSize: 20,
  },
  manualClose: {
    padding: 4,
  },
  manualHint: {
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 22,
  },
  manualInput: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 20,
    fontSize: 18,
    fontFamily: 'monospace',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 20,
  },
  manualActions: {
    flexDirection: 'row',
    gap: 12,
  },
  manualCancelBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  manualSubmitBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
});

export default BarcodeScanner;