import { Fonts } from '@/constants/theme';
import { useAccount } from '@/context/AccountContext';
import { AppText } from '@/components/ui';
import { isOfflineError, OFFLINE_MESSAGE } from '@/services/connectivity';
import { Image } from 'expo-image';
import { Eye, EyeOff } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface LoginScreenProps {
  onCreateAccount: () => void;
  onSuccess: () => void;
}

export default function LoginScreen({ onCreateAccount, onSuccess }: LoginScreenProps) {
  const { login } = useAccount();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = email.trim().length > 0 && password.length > 0;

  const handleLogin = async () => {
    if (!valid || loading) return;
    setLoading(true);
    setError(null);
    try {
      const ok = await login(email.trim(), password);
      if (ok) {
        onSuccess();
      } else {
        setError('Invalid email or password.');
      }
    } catch (e) {
      setError(isOfflineError(e) ? OFFLINE_MESSAGE : 'Unable to log in. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const bg = '#ffffff';
  const fg = '#000000';
  const fgSecondary = '#666666';
  const border = '#e5e5e5';
  const card = '#f9f9f9';
  const accent = '#000000';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Image source={require('@/assets/images/logo.svg')} style={styles.logo} contentFit="contain" />
            <AppText variant="display" weight="bold" style={[styles.title, { color: fg }]}>
              Welcome back
            </AppText>
            <AppText variant="body" weight="medium" style={[styles.subtitle, { color: fgSecondary }]}>
              Log in to continue to Shega.
            </AppText>
          </View>

          <View style={styles.form}>
            <AppText variant="caption" weight="bold" style={[styles.label, { color: fgSecondary }]}>
              Email
            </AppText>
            <TextInput
              style={[styles.input, { color: fg, borderColor: border, backgroundColor: card }]}
              placeholder="you@example.com"
              placeholderTextColor={fgSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <AppText variant="caption" weight="bold" style={[styles.label, { color: fgSecondary }]}>
              Password
            </AppText>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={[styles.input, { color: fg, borderColor: border, backgroundColor: card }, styles.passwordInput]}
                placeholder="Enter your password"
                placeholderTextColor={fgSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((v) => !v)}
                style={styles.eyeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {showPassword ? (
                  <EyeOff size={20} color={fgSecondary} />
                ) : (
                  <Eye size={20} color={fgSecondary} />
                )}
              </TouchableOpacity>
            </View>

            {error ? (
              <AppText variant="body-sm" weight="semibold" style={[styles.error, { color: error }]}>
                {error}
              </AppText>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: fg }, (!valid || loading) && styles.disabled]}
              onPress={handleLogin}
              disabled={!valid || loading}
              activeOpacity={0.85}
            >
              <AppText variant="heading" weight="bold" style={{ color: bg }}>
                {loading ? 'Logging in…' : 'Log In'}
              </AppText>
            </TouchableOpacity>

            <View style={styles.footerRow}>
              <AppText variant="body" weight="medium" style={{ color: fgSecondary }}>
                Don&apos;t have an account?
              </AppText>
              <TouchableOpacity onPress={onCreateAccount}>
                <AppText variant="body" weight="bold" style={{ color: accent }}>
                  Create Account
                </AppText>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 40 },
  header: { alignItems: 'center', marginBottom: 40 },
  logo: { width: 80, height: 80, marginBottom: 24 },
  title: { marginBottom: 8, textAlign: 'center' },
  subtitle: { textAlign: 'center', lineHeight: 22 },
  form: { width: '100%' },
  label: { marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  input: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: Fonts.medium,
    marginBottom: 20,
  },
  passwordWrapper: { position: 'relative', marginBottom: 20 },
  passwordInput: { marginBottom: 0, paddingRight: 48 },
  eyeButton: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  primaryBtn: {
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  disabled: { opacity: 0.6 },
  error: { marginBottom: 12 },
  footerRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 24 },
});