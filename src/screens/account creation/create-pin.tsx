import React, { useState } from 'react';
import { Fonts } from '@/constants/theme';
import {
  StyleSheet,
  Text as RNText,
  View,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  Alert,
  Platform
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Delete, ChevronRight, ShieldCheck, ArrowLeft } from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import Animated, { 
  FadeIn, 
  FadeInDown, 
  Layout, 
  useAnimatedStyle, 
  withSpring, 
  useSharedValue,
  withSequence,
  withTiming
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

interface CreatePinScreenProps {
  onConfirm?: () => void;
  onSkip?: () => void;
}

const CreatePinScreen: React.FC<CreatePinScreenProps> = ({ onConfirm, onSkip }) => {
  const { setPin } = useSettings();
  const [pin, setPinLocal] = useState('');
  const pinLength = 4;
  const shakeOffset = useSharedValue(0);

  const handlePress = (num: string) => {
    if (pin.length < pinLength) {
      setPinLocal(pin + num);
    }
  };

  const handleDelete = () => {
    setPinLocal(pin.slice(0, -1));
  };

  const shake = () => {
    shakeOffset.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-10, { duration: 50 }),
      withTiming(0, { duration: 50 })
    );
  };

  const animatedShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeOffset.value }]
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
        <RNText style={styles.keyText}>{num}</RNText>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Orchestration */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onSkip}>
          <ArrowLeft size={22} color="#000" />
        </TouchableOpacity>
        <TouchableOpacity onPress={onSkip} style={styles.skipArea}>
          <RNText style={styles.skipText}>LATER</RNText>
        </TouchableOpacity>
      </View>

      <Animated.View entering={FadeIn.duration(800)} style={styles.content}>
        <View style={styles.titleNode}>
          <RNText style={styles.title}>Secure Access</RNText>
          <RNText style={styles.subtitle}>Define a 4-digit protocol for terminal entry</RNText>
        </View>

        {/* PIN Indicators */}
        <Animated.View style={[styles.dotsNode, animatedShakeStyle]}>
          {[...Array(pinLength)].map((_, i) => {
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
          {renderKey('del', <Delete size={24} color="#000" strokeWidth={1.5} />)}
        </View>

        {/* Confirmation Node */}
        <View style={styles.footerNode}>
          <TouchableOpacity
            style={[
              styles.confirmActionBtn,
              { backgroundColor: pin.length === pinLength ? '#000000' : 'rgba(0,0,0,0.05)' }
            ]}
            disabled={pin.length !== pinLength}
            onPress={async () => {
              try {
                await setPin(pin);
                onConfirm?.();
              } catch (error) {
                shake();
                Alert.alert('System Error', 'Encryption failure. Please try again.');
              }
            }}
          >
            <RNText style={[styles.confirmBtnText, { color: pin.length === pinLength ? '#FFF' : '#BBB' }]}>
              CONFIRM PROTOCOL
            </RNText>
            {pin.length === pinLength && (
               <ChevronRight size={18} color="#FFF" />
            )}
          </TouchableOpacity>
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
    fontSize: 11,
    color: '#999',
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
    fontSize: 32,
    fontFamily: Fonts.extrabold,
    fontWeight: '800',
    color: '#000',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
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
    borderColor: 'rgba(0,0,0,0.1)',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: '#000',
  },
  dotPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFF',
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
    fontSize: 28,
    fontFamily: Fonts.bold,
    color: '#000',
  },
  footerNode: {
    width: '100%',
    paddingBottom: 40,
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
    fontSize: 14,
    fontFamily: Fonts.bold,
    letterSpacing: 1.2,
  },
});

export default CreatePinScreen;