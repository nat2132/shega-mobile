import React, { useState, useEffect, useMemo } from 'react';
import { Fonts } from '@/constants/theme';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Dimensions} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Delete, Lock, Fingerprint, Timer, ShieldAlert, HelpCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import { verifyPinHash } from '@/services/crypto';
import { authenticateWithBiometrics, isBiometricsAvailable, isBiometricsEnabled } from '@/services/biometrics';
import { AppText } from '@/components/ui';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  withSequence,
  withTiming,
  useSharedValue,
} from 'react-native-reanimated';
import { getAuthGlass } from './glass-auth';

const { width } = Dimensions.get('window');

interface VerifyPinScreenProps {
  onSuccess: () => void;
}

const VerifyPinScreen: React.FC<VerifyPinScreenProps> = ({ onSuccess }) => {
  const { t, colors } = useSettings();
  const { authenticate, recordFailedAttempt, resetAttempts, isLocked, lockoutRemaining, attemptsRemaining } = useAuth();
  const G = getAuthGlass(colors);
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [bioEnabled, setBioEnabled] = useState(false);
  const pinLength = 4;
  const maxAttempts = 5;

  const shakeOffset = useSharedValue(0);

  useEffect(() => {
    Promise.all([isBiometricsAvailable(), isBiometricsEnabled()]).then(([avail, enabled]) => {
      setBioEnabled(avail && enabled);
    });
  }, []);

  const handleBiometricUnlock = async () => {
    if (isLocked) return;
    const success = await authenticateWithBiometrics('Authenticate to unlock');
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess();
    }
  };

  useEffect(() => {
    if (isLocked && lockoutRemaining <= 0) {
      resetAttempts();
    }
  }, [isLocked, lockoutRemaining, resetAttempts]);

  const handlePress = async (num: string) => {
    if (isLocked) return;
    if (pin.length < pinLength) {
      const newPin = pin + num;
      setPin(newPin);
      
      if (newPin.length === pinLength) {
        await verify(newPin);
      }
    }
  };

  const handleDelete = () => {
    if (isLocked) return;
    setPin(pin.slice(0, -1));
  };

  const shake = () => {
    shakeOffset.value = withSequence(
      withTiming(-10, { duration: 40 }),
      withTiming(10, { duration: 40 }),
      withTiming(-10, { duration: 40 }),
      withTiming(0, { duration: 40 })
    );
  };

  const animatedShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeOffset.value }]
  }));

  const verify = async (inputPin: string) => {
    try {
      const matched = await verifyPinHash(inputPin);
      if (matched) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await resetAttempts();
        authenticate();
        onSuccess();
        return;
      }

      const newAttempts = await recordFailedAttempt();
      shake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (newAttempts >= maxAttempts) {
        setPin('');
      } else {
        setTimeout(() => setPin(''), 300);
      }
    } catch (error) {
      console.error('PIN Verification Error:', error);
    }
  };

  const renderKey = (num: number | string, icon?: any) => (
    <TouchableOpacity 
      key={num} 
      style={[styles.keyNode, isLocked && { opacity: 0.2 }]} 
      onPress={() => (icon ? handleDelete() : handlePress(num.toString()))}
      activeOpacity={0.6}
      disabled={isLocked}
    >
      {icon ? (
         icon
      ) : (
        <AppText style={[styles.keyText, { color: G.fg }]} variant="display" weight="bold" numberOfLines={1}>{num}</AppText>
      )}
    </TouchableOpacity>
  );

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
    },
    glowNode: {
      position: 'absolute',
      width: 400,
      height: 400,
      borderRadius: 200,
    },
    content: {
      flex: 1,
      paddingHorizontal: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    securityNode: {
      alignItems: 'center',
      marginBottom: 50,
    },
    shieldRing: {
      width: 80,
      height: 80,
      borderRadius: 40,
      borderWidth: 1,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
    },
    title: {
      fontFamily: Fonts.extrabold,
      fontWeight: '800',
    },
    subtitle: {
      fontFamily: Fonts.medium,
      marginTop: 6,
      textAlign: 'center',
    },
    dotsNode: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginBottom: 60,
      height: 30,
      alignItems: 'center',
    },
    dot: {
      width: 16,
      height: 16,
      borderRadius: 8,
      marginHorizontal: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    dotEmpty: {
      borderWidth: 1.5,
      backgroundColor: 'transparent',
    },
    dotFilled: {
    },
    dotPulse: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
    },
    lockoutBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: G.error + '20',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      gap: 6,
    },
    lockoutText: {
      fontFamily: Fonts.bold,
      letterSpacing: 0.5,
    },
    keypadOrchestration: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      width: '100%',
      paddingHorizontal: 10,
    },
    keyNode: {
      width: (width - 160) / 3,
      height: 70,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 25,
      borderRadius: 35,
    },
    keyText: {
      fontFamily: Fonts.bold,
    },
    footerNode: {
      marginTop: 40,
      alignItems: 'center',
    },
    footerTag: {
      fontFamily: Fonts.bold,
      letterSpacing: 1.5,
      textAlign: 'center',
    },
    forgotPinBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 24,
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    forgotPinText: {
      fontFamily: Fonts.bold,
      letterSpacing: 1,
    },
  }), [G]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: G.bg }]}>
      <View style={StyleSheet.absoluteFill}>
        <View style={[styles.glowNode, { top: -100, right: -100, backgroundColor: isLocked ? G.error : G.fg, opacity: isLocked ? 0.1 : 0.05 }]} />
        <View style={[styles.glowNode, { bottom: -60, left: -80, backgroundColor: G.fg, opacity: 0.03 }]} />
        <View style={[styles.glowNode, { top: '40%', left: '30%', backgroundColor: G.fg, opacity: 0.02 }]} />
      </View>

      <Animated.View entering={FadeIn.duration(800)} style={styles.content}>
        <View style={styles.securityNode}>
          <View style={[styles.shieldRing, { backgroundColor: G.border, borderColor: G.border }, isLocked && { borderColor: G.error, backgroundColor: G.error + '20' }]}>
             {isLocked ? (
               <ShieldAlert size={32} color={G.error} strokeWidth={1.5} />
             ) : (
               <Lock size={32} color={G.fg} strokeWidth={1.5} />
             )}
          </View>
          <AppText style={[styles.title, { color: isLocked ? G.error : G.fg }]} variant="display" weight="bold" numberOfLines={2}>
            {isLocked ? 'SYSTEM LOCKDOWN' : t('pin.system_key')}
          </AppText>
          <AppText style={[styles.subtitle, { color: G.fgSecondary }]} variant="body" weight="medium" numberOfLines={3}>
            {isLocked
              ? `Security Protocol Active. Cooling down in ${lockoutRemaining}s`
              : t('pin.enter_security')}
          </AppText>
        </View>

        <Animated.View style={[styles.dotsNode, animatedShakeStyle]}>
          {isLocked ? (
            <View style={styles.lockoutBadge}>
               <Timer size={14} color={G.error} />
               <AppText style={[styles.lockoutText, { color: G.error }]} variant="caption" weight="bold" transform="uppercase" numberOfLines={1}>{t('pin.cool_down_active')}</AppText>
            </View>
          ) : (
            [...Array(pinLength)].map((_, i) => {
              const isFilled = pin.length > i;
              return (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    isFilled
                      ? [styles.dotFilled, { backgroundColor: G.fg }]
                      : [styles.dotEmpty, { borderColor: G.border }],
                  ]}
                >
                  {isFilled && (
                    <View style={[styles.dotPulse, { backgroundColor: G.bg }]} />
                  )}
                </View>
              );
            })
          )}
        </Animated.View>

        <View style={styles.keypadOrchestration}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => renderKey(n))}
          {bioEnabled ? (
            <TouchableOpacity
              style={[styles.keyNode, isLocked && { opacity: 0.2 }]}
              onPress={handleBiometricUnlock}
              activeOpacity={0.6}
              disabled={isLocked}
            >
              <Fingerprint size={28} color={isLocked ? G.fgSecondary : G.fg} strokeWidth={1.5} />
            </TouchableOpacity>
          ) : (
            <View style={styles.keyNode} />
          )}
          {renderKey(0)}
          {renderKey('del', <Delete size={24} color={isLocked ? G.fgSecondary : G.fg} strokeWidth={1.5} />)}
        </View>

        <View style={styles.footerNode}>
            <AppText style={[styles.footerTag, { color: attemptsRemaining < maxAttempts && !isLocked ? G.error : G.fgSecondary }]} variant="caption" weight="bold" transform="uppercase" numberOfLines={2}>
             {isLocked
               ? 'DEVICE TEMPORARILY BRICKED'
               : (attemptsRemaining < maxAttempts ? `INVALID PROTOCOL: ${attemptsRemaining} ATTEMPTS REMAINING` : 'AES-256 SECURE ENCRYPTION ACTIVE')}
           </AppText>

           <TouchableOpacity
             style={styles.forgotPinBtn}
             onPress={() => router.push('/forgot-pin')}
             activeOpacity={0.6}
           >
              <HelpCircle size={14} color={G.fgSecondary} />
              <AppText style={[styles.forgotPinText, { color: G.fgSecondary }]} variant="caption" weight="bold" numberOfLines={1}>
               FORGOT PIN?
             </AppText>
           </TouchableOpacity>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
};

export default VerifyPinScreen;