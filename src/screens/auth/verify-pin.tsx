import React, { useState, useEffect } from 'react';
import { Fonts } from '@/constants/theme';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Dimensions,
  Alert,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import { Delete, Lock, ShieldCheck, Fingerprint, LucideIcon, Timer, ShieldAlert } from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import { AppText } from '@/components/ui';
import Animated, { 
  FadeIn, 
  FadeInDown, 
  useAnimatedStyle, 
  withSequence, 
  withTiming, 
  useSharedValue,
  withRepeat,
  interpolateColor
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

interface VerifyPinScreenProps {
  onSuccess: () => void;
}

const VerifyPinScreen: React.FC<VerifyPinScreenProps> = ({ onSuccess }) => {
  const { t } = useSettings();
  const [pin, setPin] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [lockoutTimer, setLockoutTimer] = useState(0);
  const pinLength = 4;
  const maxAttempts = 5;
  
  const shakeOffset = useSharedValue(0);
  const lockdownOpacity = useSharedValue(0);

  useEffect(() => {
    let interval: any;
    if (lockoutTimer > 0) {
      interval = setInterval(() => {
        setLockoutTimer(prev => prev - 1);
      }, 1000);
    } else if (lockoutTimer === 0 && attempts >= maxAttempts) {
      setAttempts(0); // Reset attempts after timer ends
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
      const storedPin = await SecureStore.getItemAsync('user_pin');
      if (inputPin === storedPin) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSuccess();
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        shake();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        
        if (newAttempts >= maxAttempts) {
          setLockoutTimer(60); // 60 second lockdown
          setPin('');
        } else {
          setTimeout(() => setPin(''), 300);
        }
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
        <AppText style={styles.keyText} variant="display" weight="bold" numberOfLines={1}>{num}</AppText>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Background Ambience */}
      <View style={StyleSheet.absoluteFill}>
        <View style={[styles.glowNode, { top: -100, right: -100, backgroundColor: lockoutTimer > 0 ? '#FF3B30' : '#000', opacity: lockoutTimer > 0 ? 0.1 : 0.05 }]} />
      </View>

      <Animated.View entering={FadeIn.duration(800)} style={styles.content}>
        <View style={styles.securityNode}>
          <View style={[styles.shieldRing, lockoutTimer > 0 && { borderColor: '#FF3B30', backgroundColor: 'rgba(255,59,48,0.05)' }]}>
             {lockoutTimer > 0 ? (
               <ShieldAlert size={32} color="#FF3B30" strokeWidth={1.5} />
             ) : (
               <Lock size={32} color="#000" strokeWidth={1.5} />
             )}
          </View>
          <AppText style={[styles.title, lockoutTimer > 0 && { color: '#FF3B30' }]} variant="display" weight="bold" numberOfLines={2}>
            {lockoutTimer > 0 ? 'SYSTEM LOCKDOWN' : t('pin.system_key')}
          </AppText>
          <AppText style={styles.subtitle} variant="body" weight="medium" numberOfLines={3}>
            {lockoutTimer > 0
              ? `Security Protocol Active. Cooling down in ${lockoutTimer}s`
              : t('pin.enter_security')}
          </AppText>
        </View>

        {/* PIN Indicators */}
        <Animated.View style={[styles.dotsNode, animatedShakeStyle]}>
          {lockoutTimer > 0 ? (
            <View style={styles.lockoutBadge}>
               <Timer size={14} color="#FF3B30" />
               <AppText style={styles.lockoutText} variant="caption" weight="bold" transform="uppercase" numberOfLines={1}>PROTOCOL COOL-DOWN ACTIVE</AppText>
            </View>
          ) : (
            [...Array(pinLength)].map((_, i) => {
              const isFilled = pin.length > i;
              return (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    isFilled ? styles.dotFilled : styles.dotEmpty,
                  ]}
                >
                  {isFilled && (
                    <View style={styles.dotPulse} />
                  )}
                </View>
              );
            })
          )}
        </Animated.View>

        {/* Tactical Keypad */}
        <View style={styles.keypadOrchestration}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => renderKey(n))}
          <View style={styles.keyNode}>
             <Fingerprint size={28} color="rgba(0,0,0,0.1)" />
          </View>
          {renderKey(0)}
          {renderKey('del', <Delete size={24} color={lockoutTimer > 0 ? '#CCC' : '#000'} strokeWidth={1.5} />)}
        </View>

        {/* Footer Meta */}
        <View style={styles.footerNode}>
           <AppText style={[styles.footerTag, attempts > 0 && lockoutTimer === 0 && { color: '#FF3B30' }]} variant="caption" weight="bold" transform="uppercase" numberOfLines={2}>
             {lockoutTimer > 0
               ? 'DEVICE TEMPORARILY BRICKED'
               : (attempts > 0 ? `INVALID PROTOCOL: ${maxAttempts - attempts} ATTEMPTS REMAINING` : 'AES-256 SECURE ENCRYPTION ACTIVE')}
           </AppText>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontFamily: Fonts.extrabold,
    fontWeight: '800',
    color: '#000',
  },
  subtitle: {
    color: '#999',
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
    borderColor: 'rgba(0,0,0,0.1)',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: '#000',
  },
  dotPulse: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFF',
  },
  lockoutBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,59,48,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  lockoutText: {
    color: '#FF3B30',
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
    color: '#000',
  },
  footerNode: {
    marginTop: 40,
  },
  footerTag: {
    fontFamily: Fonts.bold,
    color: '#CCC',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
});

export default VerifyPinScreen;
