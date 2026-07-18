import React, { useState, useMemo } from 'react';
import { Fonts } from '@/constants/theme';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Dimensions} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Delete, ChevronRight, ArrowLeft, ShieldAlert } from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import { AppText } from '@/components/ui';
import { getAccountGlass } from './glass-account';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

interface CreatePinScreenProps {
  onConfirm?: () => void;
  onSkip?: () => void;
}

const WEAK_PINS = new Set([
  '0123', '1234', '2345', '3456', '4567', '5678', '6789',
  '4321', '8765',
  '2468', '1357',
]);

const validatePin = (pin: string, t: any): string | null => {
  if (pin.length !== 4) return t('account.pin_length');
  if (WEAK_PINS.has(pin)) return t('account.pin_too_common');
  if (/^(\d)\1{3}$/.test(pin)) return t('account.pin_repeating');
  if (/^(\d)\1{2}(\d)\2$/.test(pin)) return t('account.pin_pattern');
  return null;
};

const CreatePinScreen: React.FC<CreatePinScreenProps> = ({ onConfirm, onSkip }) => {
  const { colors, setPin, t } = useSettings();
  const G = getAccountGlass(colors);
  const [pin, setPinLocal] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinPhase, setPinPhase] = useState<'create' | 'confirm'>('create');
  const [pinError, setPinError] = useState<string | null>(null);
  const pinLength = 4;
  const shakeOffset = useSharedValue(0);
  const shakeConfirmOffset = useSharedValue(0);

  const handlePress = (num: string) => {
    setPinError(null);
    if (pinPhase === 'create') {
      if (pin.length < pinLength) {
        setPinLocal(pin + num);
      }
    } else {
      if (confirmPin.length < pinLength) {
        setConfirmPin(confirmPin + num);
      }
    }
  };

  const handleDelete = () => {
    setPinError(null);
    if (pinPhase === 'create') {
      setPinLocal(pin.slice(0, -1));
    } else {
      setConfirmPin(confirmPin.slice(0, -1));
    }
  };

  const shake = (target: 'create' | 'confirm' = 'create') => {
    const offset = target === 'create' ? shakeOffset : shakeConfirmOffset;
    offset.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-10, { duration: 50 }),
      withTiming(0, { duration: 50 })
    );
  };

  const animatedShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeOffset.value }]
  }));

  const animatedConfirmShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeConfirmOffset.value }]
  }));

  const renderKey = (num: number | string, icon?: any) => (
    <TouchableOpacity 
      key={num} 
      style={styles.keyNode} 
      onPress={() => (icon ? handleDelete() : handlePress(num.toString()))}
      activeOpacity={0.6}
    >
      {icon ? (
        icon
      ) : (
        <AppText style={styles.keyText} variant="display" weight="bold" numberOfLines={1}>{num}</AppText>
      )}
    </TouchableOpacity>
  );

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: G.bg,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 25,
      paddingTop: 10,
    },
    backBtn: {
      padding: 8,
    },
    skipArea: {
      padding: 8,
    },
    skipText: {
      fontFamily: Fonts.bold,
      letterSpacing: 1.5,
    },
    content: {
      flex: 1,
      paddingHorizontal: 30,
      alignItems: 'center',
    },
    titleNode: {
      alignItems: 'center',
      marginTop: 40,
      marginBottom: 50,
    },
    title: {
      fontFamily: Fonts.extrabold,
      fontWeight: '800',
    },
    subtitle: {
      fontFamily: Fonts.medium,
      marginTop: 6,
    },
    dotsNode: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginBottom: 60,
    },
    dot: {
      width: 18,
      height: 18,
      borderRadius: 9,
      marginHorizontal: 15,
      justifyContent: 'center',
      alignItems: 'center',
    },
    dotEmpty: {
      borderWidth: 1.5,
      borderColor: G.border,
      backgroundColor: 'transparent',
    },
    dotFilled: {
      backgroundColor: G.fg,
    },
    dotPulse: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: G.bg,
    },
    keypadOrchestration: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      width: '100%',
      paddingHorizontal: 20,
      flex: 1,
    },
    keyNode: {
      width: (width - 150) / 3,
      height: 70,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
      borderRadius: 35,
    },
    keyText: {
      fontFamily: Fonts.bold,
      color: G.fg,
    },
    footerNode: {
      width: '100%',
      paddingBottom: 40,
    },
    phaseIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 30,
    },
    phaseDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: G.border,
    },
    phaseDotActive: {
      backgroundColor: G.fg,
      width: 24,
      borderRadius: 5,
      height: 10,
    },
    phaseLine: {
      width: 30,
      height: 2,
      backgroundColor: G.border,
      borderRadius: 1,
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: G.bgCard,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      marginBottom: 20,
      gap: 10,
    },
    errorBannerText: {
      fontFamily: Fonts.semibold,
      flex: 1,
    },
    dotError: {
      backgroundColor: G.error,
    },
    confirmActionBtn: {
      flexDirection: 'row',
      height: 68,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
    },
    confirmBtnText: {
      fontFamily: Fonts.bold,
      letterSpacing: 1.2,
    },
    glowWash: {
      position: 'absolute',
      borderRadius: 200,
    },
  }), [G]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Ambient Glass Glow */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[styles.glowWash, { top: -120, left: -60, width: 300, height: 300, opacity: 0.12 }]} />
        <View style={[styles.glowWash, { bottom: -80, right: -40, width: 250, height: 250, opacity: 0.08 }]} />
      </View>
      {/* Header Orchestration */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onSkip}>
          <ArrowLeft size={22} color={G.fg} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onSkip} style={styles.skipArea}>
           <AppText style={[styles.skipText, { color: G.fgSecondary }]} variant="caption" weight="bold" transform="uppercase" numberOfLines={1}>{t('account.later')}</AppText>
        </TouchableOpacity>
      </View>

      <Animated.View entering={FadeIn.duration(800)} style={styles.content}>
        <View style={styles.titleNode}>
            <AppText style={[styles.title, { color: G.fg }]} variant="display" weight="bold" numberOfLines={2}>{t('account.secure_access')}</AppText>
            <AppText style={[styles.subtitle, { color: G.fgSecondary }]} variant="body" weight="medium" numberOfLines={3}>
            {pinPhase === 'create'
              ? t('account.pin_create_hint')
              : t('account.pin_confirm_hint')
            }
          </AppText>
        </View>

        {/* PIN Phase Indicator */}
        <View style={styles.phaseIndicator}>
          <View style={[styles.phaseDot, pinPhase === 'create' && styles.phaseDotActive]} />
          <View style={styles.phaseLine} />
          <View style={[styles.phaseDot, pinPhase === 'confirm' && styles.phaseDotActive]} />
        </View>

        {/* PIN Error */}
        {pinError && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.errorBanner}>
            <ShieldAlert size={16} color={colors.error} />
            <AppText style={[styles.errorBannerText, { color: colors.error }]} variant="body-sm" weight="semibold" numberOfLines={2}>{pinError}</AppText>
          </Animated.View>
        )}

        {/* PIN Indicators */}
        <Animated.View style={[styles.dotsNode, pinPhase === 'create' ? animatedShakeStyle : animatedConfirmShakeStyle]}>
          {[...Array(pinLength)].map((_, i) => {
            const currentPin = pinPhase === 'create' ? pin : confirmPin;
            const isFilled = currentPin.length > i;
            const showError = pinError && pinPhase === 'create';
            return (
              <View
                key={i}
                style={[
                  styles.dot,
                  isFilled ? styles.dotFilled : styles.dotEmpty,
                  showError && isFilled && { backgroundColor: colors.error },
                ]}
              >
                {isFilled && (
                  <Animated.View entering={FadeIn.duration(200)} style={styles.dotPulse} />
                )}
              </View>
            );
          })}
        </Animated.View>

        {/* Tactical Keypad */}
        <View style={styles.keypadOrchestration}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => renderKey(n))}
          <View style={styles.keyNode} />
          {renderKey(0)}
          {renderKey('del', <Delete size={24} color={G.fg} strokeWidth={1.5} />)}
        </View>

        {/* Confirmation Node */}
        <View style={styles.footerNode}>
          <TouchableOpacity
            style={[
              styles.confirmActionBtn,
              { backgroundColor: (pinPhase === 'create' ? pin.length : confirmPin.length) === pinLength ? G.fg : G.bgCardStrong }
            ]}
            disabled={(pinPhase === 'create' ? pin.length : confirmPin.length) !== pinLength}
            onPress={async () => {
              try {
                if (pinPhase === 'create') {
                  // Validate the pin
                   const validationError = validatePin(pin, t);
                  if (validationError) {
                    setPinError(validationError);
                    shake('create');
                    setPinLocal('');
                    return;
                  }
                  // Move to confirm phase
                  setPinPhase('confirm');
                } else {
                  // Confirming - check match
                  if (pin !== confirmPin) {
                    setPinError(t('account.pin_mismatch'));
                    shake('confirm');
                    setConfirmPin('');
                    setPinPhase('create');
                    setPinLocal('');
                    return;
                  }
                  
                  await setPin(pin);
                  onConfirm?.();
                }
              } catch {
                shake('create');
                setPinError(t('account.pin_encryption_failure'));
                setPinLocal('');
                setConfirmPin('');
                setPinPhase('create');
              }
            }}
          >
            <AppText style={[styles.confirmBtnText, { color: (pinPhase === 'create' ? pin.length : confirmPin.length) === pinLength ? G.bg : G.muted }]} variant="body" weight="bold" numberOfLines={1}>
              {pinPhase === 'create' ? t('account.confirm_protocol') : t('account.verify_pin')}
            </AppText>
            {(pinPhase === 'create' ? pin.length : confirmPin.length) === pinLength && (
               <ChevronRight size={18} color={G.bg} />
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
};

export default CreatePinScreen;