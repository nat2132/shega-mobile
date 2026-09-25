import React, { useState } from 'react';
import { Fonts } from '@/constants/theme';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Delete, ShieldCheck, ShieldAlert } from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import { AppText } from '@/components/ui';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  withSequence,
  withTiming,
  useSharedValue,
} from 'react-native-reanimated';
import { storePinHash } from '@/services/crypto';
import { getAuthGlass } from './glass-auth';

const { width } = Dimensions.get('window');

const WEAK_PINS = new Set([
  '012345', '123456', '234567', '345678', '456789',
  '654321', '987654', '111111', '000000',
]);

const validatePin = (pin: string): string | null => {
  if (pin.length !== 6) return 'PIN must be exactly 6 digits';
  if (WEAK_PINS.has(pin)) return 'This PIN is too common. Please choose a stronger one.';
  if (/^(\d)\1{5}$/.test(pin)) return 'Repeating digits are not allowed.';
  return null;
};

interface ResetPinScreenProps {
  onComplete: () => void;
}

const ResetPinScreen: React.FC<ResetPinScreenProps> = ({ onComplete }) => {
  const { setPin, colors } = useSettings();
  const G = getAuthGlass(colors);
  const [pin, setPinLocal] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [phase, setPhase] = useState<'create' | 'confirm'>('create');
  const [error, setError] = useState<string | null>(null);
  const pinLength = 6;

  const shakeCreate = useSharedValue(0);
  const shakeConfirm = useSharedValue(0);

  const handlePress = (num: string) => {
    setError(null);
    if (phase === 'create') {
      if (pin.length < pinLength) setPinLocal(pin + num);
    } else {
      if (confirmPin.length < pinLength) setConfirmPin(confirmPin + num);
    }
  };

  const handleDelete = () => {
    setError(null);
    if (phase === 'create') {
      setPinLocal(pin.slice(0, -1));
    } else {
      setConfirmPin(confirmPin.slice(0, -1));
    }
  };

  const shake = (target: 'create' | 'confirm') => {
    const offset = target === 'create' ? shakeCreate : shakeConfirm;
    offset.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-10, { duration: 50 }),
      withTiming(0, { duration: 50 })
    );
  };

  const animCreate = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeCreate.value }],
  }));

  const animConfirm = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeConfirm.value }],
  }));

  const renderKey = (num: number | string, icon?: any) => (
    <TouchableOpacity
      key={num}
      style={styles.keyNode}
      onPress={() => (icon ? handleDelete() : handlePress(num.toString()))}
      activeOpacity={0.6}
    >
      {icon ? icon : (
        <AppText style={[styles.keyText, { color: G.fg }]} variant="display" weight="bold" numberOfLines={1}>{num}</AppText>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: G.bg }]}>
      <View style={StyleSheet.absoluteFill}>
        <View style={[styles.glowNode, { top: -100, right: -100, backgroundColor: G.fg, opacity: 0.05 }]} />
        <View style={[styles.glowNode, { bottom: -60, left: -80, backgroundColor: G.fg, opacity: 0.03 }]} />
        <View style={[styles.glowNode, { top: '40%', left: '30%', backgroundColor: G.fg, opacity: 0.02 }]} />
      </View>

      <Animated.View entering={FadeIn.duration(800)} style={styles.content}>
        <View style={styles.titleNode}>
          <View style={[styles.shieldRing, { backgroundColor: G.border, borderColor: G.border }]}>
            <ShieldCheck size={32} color={G.fg} strokeWidth={1.5} />
          </View>
          <AppText style={[styles.title, { color: G.fg }]} variant="display" weight="bold" numberOfLines={2}>
            Create New PIN
          </AppText>
          <AppText style={[styles.subtitle, { color: G.fgSecondary }]} variant="body" weight="medium" numberOfLines={3}>
            {phase === 'create'
              ? 'Enter a new 6-digit PIN'
              : 'Re-enter your new PIN to confirm'}
          </AppText>
        </View>

        {/* Phase Indicator */}
        <View style={styles.phaseIndicator}>
          <View style={[styles.phaseDot, { backgroundColor: phase === 'create' ? G.fg : G.border }, phase === 'create' && styles.phaseDotActive]} />
          <View style={[styles.phaseLine, { backgroundColor: G.border }]} />
          <View style={[styles.phaseDot, { backgroundColor: phase === 'confirm' ? G.fg : G.border }, phase === 'confirm' && styles.phaseDotActive]} />
        </View>

        {error && (
          <Animated.View entering={FadeIn.duration(300)} style={[styles.errorBanner, { backgroundColor: G.bgCard }]}>
            <ShieldAlert size={16} color={G.fgSecondary} />
            <AppText style={[styles.errorBannerText, { color: G.fgSecondary }]} variant="body-sm" weight="semibold" numberOfLines={2}>{error}</AppText>
          </Animated.View>
        )}

        {/* PIN Dots */}
        <Animated.View style={[styles.dotsNode, phase === 'create' ? animCreate : animConfirm]}>
           {[...Array(pinLength)].map((_, i) => {
            const current = phase === 'create' ? pin : confirmPin;
            const filled = current.length > i;
            return (
              <View key={i} style={[styles.dot, filled ? [styles.dotFilled, { backgroundColor: G.fg }] : [styles.dotEmpty, { borderColor: G.border }]]}>
                {filled && <Animated.View entering={FadeIn.duration(200)} style={[styles.dotPulse, { backgroundColor: G.bg }]} />}
              </View>
            );
          })}
        </Animated.View>

        {/* Keypad */}
        <View style={styles.keypadOrchestration}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => renderKey(n))}
          <View style={styles.keyNode} />
          {renderKey(0)}
          {renderKey('del', <Delete size={24} color={G.fg} strokeWidth={1.5} />)}
        </View>

        {/* Footer */}
        <View style={styles.footerNode}>
          <TouchableOpacity
            style={[
              styles.confirmActionBtn,
              { backgroundColor: (phase === 'create' ? pin.length : confirmPin.length) === pinLength ? G.fg : G.border }
            ]}
            disabled={(phase === 'create' ? pin.length : confirmPin.length) !== pinLength}
            onPress={async () => {
              if (phase === 'create') {
                const validationError = validatePin(pin);
                if (validationError) {
                  setError(validationError);
                  shake('create');
                  setPinLocal('');
                  return;
                }
                setPhase('confirm');
              } else {
                if (pin !== confirmPin) {
                  setError('PINs do not match. Please try again.');
                  shake('confirm');
                  setConfirmPin('');
                  setPhase('create');
                  setPinLocal('');
                  return;
                }

                await storePinHash(pin);
                await setPin(pin);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                onComplete();
              }
            }}
          >
            <AppText
              style={[styles.confirmBtnText, { color: (phase === 'create' ? pin.length : confirmPin.length) === pinLength ? G.bg : G.fgSecondary }]}
              variant="body" weight="bold" numberOfLines={1}
            >
              {phase === 'create' ? 'CONTINUE' : 'RESET PIN'}
            </AppText>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  glowNode: { position: 'absolute', width: 400, height: 400, borderRadius: 200 },
  content: { flex: 1, paddingHorizontal: 30, alignItems: 'center' },
  titleNode: { alignItems: 'center', marginTop: 40, marginBottom: 40 },
  shieldRing: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  title: { fontFamily: Fonts.extrabold, fontWeight: '800' },
  subtitle: { fontFamily: Fonts.medium, marginTop: 6, textAlign: 'center' },
  phaseIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 },
  phaseDot: { width: 10, height: 10, borderRadius: 5 },
  phaseDotActive: { width: 24, borderRadius: 5, height: 10 },
  phaseLine: { width: 30, height: 2, borderRadius: 1 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 12, marginBottom: 20, gap: 10, width: '100%',
  },
  errorBannerText: { fontFamily: Fonts.semibold, flex: 1 },
  dotsNode: { flexDirection: 'row', justifyContent: 'center', marginBottom: 50 },
  dot: { width: 18, height: 18, borderRadius: 9, marginHorizontal: 15, justifyContent: 'center', alignItems: 'center' },
  dotEmpty: { borderWidth: 1.5, backgroundColor: 'transparent' },
  dotFilled: {  },
  dotPulse: { width: 6, height: 6, borderRadius: 3 },
  keypadOrchestration: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between',
    width: '100%', paddingHorizontal: 20, flex: 1,
  },
  keyNode: { width: (width - 150) / 3, height: 70, alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderRadius: 35 },
  keyText: { fontFamily: Fonts.bold },
  footerNode: { width: '100%', paddingBottom: 40 },
  confirmActionBtn: {
    flexDirection: 'row', height: 68, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center', gap: 12,
  },
  confirmBtnText: { fontFamily: Fonts.bold, letterSpacing: 1.2 },
});

export default ResetPinScreen;