import { Fonts } from '@/constants/theme';
import { useAccount } from '@/context/AccountContext';
import { AppText } from '@/components/ui';
import { Image } from 'expo-image';
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

interface RegisterScreenProps {
  onBack: () => void;
  onSuccess: () => void;
}

export default function RegisterScreen({ onBack, onSuccess }: RegisterScreenProps) {
  const { register } = useAccount();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const validate = (): string | null => {
    if (!name.trim()) return 'Full name is required';
    if (name.trim().length < 2) return 'Name must be at least 2 characters.';
    if (!email.trim()) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Enter a valid email address.';
    if (!businessName.trim()) return 'Business name is required.';
    if (!password) return 'Password is required.';
    if (password.length < 6) return 'Password must be at least 6 characters.';
    if (password !== confirm) return 'Passwords do not match.';
    return null;
  };

  const handleSubmit = async () => {
    if (loading) return;
    const validation = validate();
    if (validation) {
      setFieldError(validation);
      return;
    }
    setFieldError(null);
    setError(null);
    setLoading(true);
    try {
      const ok = await register({
        name: name.trim(),
        email: email.trim(),
        business_name: businessName.trim(),
        password,
      });
      if (ok) {
        onSuccess();
      } else {
        setError('Registration failed. The email may already be in use.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create your account. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const bg = '#ffffff';
  const fg = '#000000';
  const fgSecondary = '#666666';
  const border = '#e5e5e5';
  const card = '#f9f9f9';
  const errorColor = '#FF3B30';

  const showError = error || fieldError;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={onBack} style={styles.back}>
            <AppText variant="body" weight="semibold" style={{ color: fgSecondary }}>
              ‹ Back
            </AppText>
          </TouchableOpacity>

          <View style={styles.header}>
            <Image source={require('@/assets/images/logo.svg')} style={styles.logo} contentFit="contain" />
            <AppText variant="display" weight="bold" style={[styles.title, { color: fg }]}>
              Create your account
            </AppText>
            <AppText variant="body" weight="medium" style={[styles.subtitle, { color: fgSecondary }]}>
              Set up your account to start using Shega.
            </AppText>
          </View>

          <View style={styles.form}>
            <Label color={fgSecondary}>Full Name</Label>
            <TextInput
              style={[styles.input, { color: fg, borderColor: border, backgroundColor: card }]}
              placeholder="e.g. Abebe"
              placeholderTextColor={fgSecondary}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />

            <Label color={fgSecondary}>Email</Label>
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

            <Label color={fgSecondary}>Business Name</Label>
            <TextInput
              style={[styles.input, { color: fg, borderColor: border, backgroundColor: card }]}
              placeholder="e.g. Abebe Trading"
              placeholderTextColor={fgSecondary}
              value={businessName}
              onChangeText={setBusinessName}
              autoCapitalize="words"
            />

            <Label color={fgSecondary}>Password</Label>
            <TextInput
              style={[styles.input, { color: fg, borderColor: border, backgroundColor: card }]}
              placeholder="At least 6 characters"
              placeholderTextColor={fgSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <Label color={fgSecondary}>Confirm Password</Label>
            <TextInput
              style={[styles.input, { color: fg, borderColor: border, backgroundColor: card }]}
              placeholder="Re-enter your password"
              placeholderTextColor={fgSecondary}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              onSubmitEditing={handleSubmit}
            />

            {showError ? (
              <AppText variant="body-sm" weight="semibold" style={[styles.error, { color: errorColor }]}>
                {showError}
              </AppText>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: fg }, loading && styles.disabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              <AppText variant="heading" weight="bold" style={{ color: bg }}>
                {loading ? 'Creating account…' : 'Create Account'}
              </AppText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Label({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <AppText variant="caption" weight="bold" style={[styles.label, { color }]}>
      {children}
    </AppText>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 20 },
  back: { marginBottom: 12 },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: { width: 64, height: 64, marginBottom: 16 },
  title: { marginBottom: 8, textAlign: 'center' },
  subtitle: { textAlign: 'center', lineHeight: 22 },
  form: { width: '100%' },
  label: { marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  input: {
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: Fonts.medium,
    marginBottom: 16,
  },
  primaryBtn: {
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  disabled: { opacity: 0.6 },
  error: { marginBottom: 8 },
});