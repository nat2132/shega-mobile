import React, { useState, useEffect } from 'react';
import { Fonts } from '@/constants/theme';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { KeyRound, ArrowLeft, Fingerprint, ShieldAlert } from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import { AppText } from '@/components/ui';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { verifyRecoveryCode, hasRecoveryCode } from '@/services/recovery';
import { authenticateWithBiometrics, getBiometricType, isBiometricsAvailable, isBiometricsEnabled } from '@/services/biometrics';
import { getAuthGlass } from './glass-auth';

interface ForgotPinScreenProps {
  onVerified: () => void;
  onBack: () => void;
}

const ForgotPinScreen: React.FC<ForgotPinScreenProps> = ({ onVerified, onBack }) => {
  const { colors, t } = useSettings();
  const G = getAuthGlass(colors);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [recoveryAvailable, setRecoveryAvailable] = useState(false);

  useEffect(() => {
    Promise.all([
      isBiometricsAvailable(),
      isBiometricsEnabled(),
      hasRecoveryCode(),
    ]).then(([bioAvail, bioEn, recAvail]) => {
      setBioAvailable(bioAvail && bioEn);
      setRecoveryAvailable(recAvail);
    });
  }, []);

  const handleVerifyCode = async () => {
    setError(null);
    const normalized = code.replace(/-/g, '').toUpperCase();
    if (normalized.length < 8) {
      setError('Please enter a valid recovery code');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setLoading(true);
    try {
      const valid = await verifyRecoveryCode(code);
      if (valid) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onVerified();
      } else {
        setError('Invalid recovery code. Please check and try again.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricAuth = async () => {
    setError(null);
    try {
      const biometricType = await getBiometricType();
      const success = await authenticateWithBiometrics(
        `Verify identity to reset PIN using ${biometricType}`
      );
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onVerified();
      }
    } catch {
      setError('Biometric authentication failed');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: G.bg }]}>
      <View style={StyleSheet.absoluteFill}>
        <View style={[styles.glowNode, { top: -100, right: -100, backgroundColor: G.fg, opacity: 0.05 }]} />
        <View style={[styles.glowNode, { bottom: -60, left: -80, backgroundColor: G.fg, opacity: 0.03 }]} />
        <View style={[styles.glowNode, { top: '40%', left: '30%', backgroundColor: G.fg, opacity: 0.02 }]} />
      </View>

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ArrowLeft size={22} color={G.fg} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <Animated.View entering={FadeIn.duration(800)} style={styles.innerContent}>
          <View style={styles.iconNode}>
            <View style={[styles.shieldRing, { backgroundColor: G.border, borderColor: G.border }]}>
              <KeyRound size={40} color={G.fg} strokeWidth={1.5} />
            </View>
          </View>

          <Animated.View entering={FadeInDown.delay(200).duration(800)} style={styles.textNode}>
            <AppText style={[styles.title, { color: G.fg }]} variant="display" weight="bold" numberOfLines={2}>
              Forgot PIN
            </AppText>
            <AppText style={[styles.subtitle, { color: G.fgSecondary }]} variant="body" weight="medium" numberOfLines={3}>
              Enter your recovery code or use biometrics to verify your identity and reset your PIN.
            </AppText>
          </Animated.View>

          {error && (
            <Animated.View entering={FadeIn.duration(300)} style={[styles.errorBanner, { backgroundColor: G.bgCard }]}>
              <ShieldAlert size={16} color={G.fgSecondary} />
              <AppText style={[styles.errorText, { color: G.fgSecondary }]} variant="body-sm" weight="semibold" numberOfLines={2}>{error}</AppText>
            </Animated.View>
          )}

          {recoveryAvailable && (
            <Animated.View entering={FadeInDown.delay(400).duration(800)} style={styles.inputSection}>
              <View style={[styles.inputWrapper, { borderColor: error ? G.fgSecondary : G.border }]}>
                <TextInput
                  style={[styles.codeInput, { color: G.fg }]}
                  value={code}
                  onChangeText={(text) => {
                    setCode(text.toUpperCase());
                    setError(null);
                  }}
                  placeholder="XXXX-XXXX-XXXX"
                  placeholderTextColor={G.fgSecondary}
                  autoCapitalize="characters"
                  maxLength={14}
                />
              </View>
              <TouchableOpacity
                style={[styles.verifyBtn, { backgroundColor: code.length >= 11 ? G.fg : G.border }]}
                onPress={handleVerifyCode}
                disabled={code.length < 11 || loading}
                activeOpacity={0.8}
              >
                <AppText
                  style={[styles.verifyBtnText, { color: code.length >= 11 ? G.bg : G.fgSecondary }]}
                  variant="body"
                  weight="bold"
                  numberOfLines={1}
                >
                  {loading ? 'Verifying...' : 'Verify Recovery Code'}
                </AppText>
              </TouchableOpacity>
            </Animated.View>
          )}

          {bioAvailable && (
            <Animated.View entering={FadeInDown.delay(600).duration(800)} style={styles.bioSection}>
              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: G.border }]} />
                <AppText variant="caption" weight="bold" style={[styles.dividerText, { color: G.fgSecondary }]}>{t('common.or')}</AppText>
                <View style={[styles.dividerLine, { backgroundColor: G.border }]} />
              </View>

              <TouchableOpacity style={[styles.bioBtn, { borderColor: G.fg }]} onPress={handleBiometricAuth} activeOpacity={0.8}>
                <Fingerprint size={24} color={G.fg} />
                <AppText variant="body" weight="bold" style={[styles.bioBtnText, { color: G.fg }]} numberOfLines={1}>
                  Use Fingerprint / Face ID
                </AppText>
              </TouchableOpacity>
            </Animated.View>
          )}

          {!recoveryAvailable && !bioAvailable && (
            <Animated.View entering={FadeInDown.delay(400).duration(800)} style={[styles.noOptionsSection, { backgroundColor: G.bgCard }]}>
              <AppText variant="body" weight="medium" style={[styles.noOptionsText, { color: G.fgSecondary }]} numberOfLines={4}>
                No recovery options available. If you forgot your PIN, you will need to reset the app to regain access.
              </AppText>
            </Animated.View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  glowNode: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 25,
    paddingTop: 10,
  },
  backBtn: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  innerContent: {
    flex: 1,
    paddingHorizontal: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconNode: {
    marginBottom: 30,
  },
  shieldRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textNode: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontFamily: Fonts.extrabold,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: Fonts.medium,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 20,
    gap: 10,
    width: '100%',
  },
  errorText: {
    fontFamily: Fonts.semibold,
    flex: 1,
  },
  inputSection: {
    width: '100%',
    marginBottom: 20,
  },
  inputWrapper: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  codeInput: {
    paddingVertical: 16,
    fontSize: 22,
    letterSpacing: 6,
    fontFamily: Fonts.bold,
    textAlign: 'center',
  },
  verifyBtn: {
    flexDirection: 'row',
    height: 58,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  verifyBtnText: {
    fontFamily: Fonts.bold,
    letterSpacing: 1.2,
  },
  bioSection: {
    width: '100%',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontFamily: Fonts.bold,
  },
  bioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    borderRadius: 24,
    borderWidth: 1.5,
    width: '100%',
  },
  bioBtnText: {
    fontFamily: Fonts.bold,
  },
  noOptionsSection: {
    padding: 20,
    borderRadius: 16,
    width: '100%',
  },
  noOptionsText: {
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: Fonts.medium,
  },
});

export default ForgotPinScreen;