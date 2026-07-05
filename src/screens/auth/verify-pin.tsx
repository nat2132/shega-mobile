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
  const G = getAuthGlass(colors);
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [lockoutTimer, setLockoutTimer] = useState(0);
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
    if (lockoutTimer > 0) return;
    const success = await authenticateWithBiometrics('Authenticate to unlock');
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess();
    }
  };

  useEffect(() => {
    let interval: any;
    if (lockoutTimer > 0) {
      interval = setInterval(() => {
        setLockoutTimer(prev => prev - 1);
      }, 1000);
    } else if (lockoutTimer === 0 && attempts >= maxAttempts) {
      setAttempts(0);
    }
    return () => clearInterval(interval);
  }, [lockoutTimer, attempts]);

  const handlePress = async (num: string) => {
    if (lockoutTimer > 0) return;
    if (pin.length < pinLength) {
      const newPin = pin + num;
      setPin(newPin);
      
      if (newPin.length === pinLength) {
        await verify(newPin);
      }
    }
  };

  const handleDelete = () => {
    if (lockoutTimer > 0) return;
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
        onSuccess();
        return;
      }

      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      shake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (newAttempts >= maxAttempts) {
        setLockoutTimer(60);
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
      style={[styles.keyNode, lockoutTimer > 0 && { opacity: 0.2 }]} 
      onPress={() => (icon ? handleDelete() : handlePress(num.toString()))}
      activeOpacity={0.6}
      disabled={lockoutTimer > 0}
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
        <View style={[styles.glowNode, { top: -100, right: -100, backgroundColor: lockoutTimer > 0 ? G.error : G.fg, opacity: lockoutTimer > 0 ? 0.1 : 0.05 }]} />
        <View style={[styles.glowNode, { bottom: -60, left: -80, backgroundColor: G.fg, opacity: 0.03 }]} />
        <View style={[styles.glowNode, { top: '40%', left: '30%', backgroundColor: G.fg, opacity: 0.02 }]} />
      </View>

      <Animated.View entering={FadeIn.duration(800)} style={styles.content}>
        <View style={styles.securityNode}>
          <View style={[styles.shieldRing, { backgroundColor: G.border, borderColor: G.border }, lockoutTimer > 0 && { borderColor: G.error, backgroundColor: G.error + '20' }]}>
             {lockoutTimer > 0 ? (
               <ShieldAlert size={32} color={G.error} strokeWidth={1.5} />
             ) : (
               <Lock size={32} color={G.fg} strokeWidth={1.5} />
             )}
          </View>
          <AppText style={[styles.title, { color: lockoutTimer > 0 ? G.error : G.fg }]} variant="display" weight="bold" numberOfLines={2}>
            {lockoutTimer > 0 ? 'SYSTEM LOCKDOWN' : t('pin.system_key')}
          </AppText>
          <AppText style={[styles.subtitle, { color: G.fgSecondary }]} variant="body" weight="medium" numberOfLines={3}>
            {lockoutTimer > 0
              ? `Security Protocol Active. Cooling down in ${lockoutTimer}s`
              : t('pin.enter_security')}
          </AppText>
        </View>

        <Animated.View style={[styles.dotsNode, animatedShakeStyle]}>
          {lockoutTimer > 0 ? (
            <View style={styles.lockoutBadge}>
               <Timer size={14} color={G.error} />
               <AppText style={[styles.lockoutText, { color: G.error }]} variant="caption" weight="bold" transform="uppercase" numberOfLines={1}>PROTOCOL COOL-DOWN ACTIVE</AppText>
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
              style={[styles.keyNode, lockoutTimer > 0 && { opacity: 0.2 }]}
              onPress={handleBiometricUnlock}
              activeOpacity={0.6}
              disabled={lockoutTimer > 0}
            >
              <Fingerprint size={28} color={lockoutTimer > 0 ? G.fgSecondary : G.fg} strokeWidth={1.5} />
            </TouchableOpacity>
          ) : (
            <View style={styles.keyNode} />
          )}
          {renderKey(0)}
          {renderKey('del', <Delete size={24} color={lockoutTimer > 0 ? G.fgSecondary : G.fg} strokeWidth={1.5} />)}
        </View>

        <View style={styles.footerNode}>
            <AppText style={[styles.footerTag, { color: attempts > 0 && lockoutTimer === 0 ? G.error : G.fgSecondary }]} variant="caption" weight="bold" transform="uppercase" numberOfLines={2}>
             {lockoutTimer > 0
               ? 'DEVICE TEMPORARILY BRICKED'
               : (attempts > 0 ? `INVALID PROTOCOL: ${maxAttempts - attempts} ATTEMPTS REMAINING` : 'AES-256 SECURE ENCRYPTION ACTIVE')}
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