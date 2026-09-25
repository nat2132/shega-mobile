import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  withSequence,
  withTiming,
  useSharedValue,
} from 'react-native-reanimated';
import { Camera, Delete, ImagePlus, Lock, Shield, ShieldAlert, Timer, UserRound, UserPlus, KeyRound, Copy, CheckCircle2, ChevronRight } from 'lucide-react-native';

import { AppText } from '@/components/ui';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { getAuthGlass } from './glass-auth';
import {
  getActiveBusiness,
  getDefaultBusiness,
  getUsers,
  getUser,
  getCurrentUserId,
  setCurrentUserId,
  setUserUsername,
  setUserPin,
  setUserAvatar,
  verifyUserPin,
  hasModernScryptPin,
  needsUserSetup,
} from '@/services/businessService';
import {
  generateRecoveryCode,
  storeRecoveryCodeHash,
  verifyRecoveryCode,
} from '@/services/recovery';
import type { User } from '@shega/shared';

const { width } = Dimensions.get('window');
const PIN_LENGTH = 6;
const MAX_ATTEMPTS = 5;

/**
 * Business-user sign-in gate. Replaces the old device-wide PIN: a member of the
 * active business signs in with username+PIN. Members created by the owner have
 * no credentials yet, so the first sign-in prompts them to create username+PIN
 * and save a Recovery Code (the "setup" mode). Includes a complete Forgot PIN flow.
 */
export default function UserSigninScreen() {
  const { colors, t } = useSettings();
  const { showToast } = useToast();
  const { authenticate, recordFailedAttempt, resetAttempts, isLocked, lockoutRemaining, attemptsRemaining } = useAuth();
  const G = getAuthGlass(colors);

  type Mode = 'booting' | 'list' | 'pin' | 'setup' | 'recovery-setup' | 'recovery' | 'reset-pin';
  const [mode, setMode] = useState<Mode>('booting');
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState<User | null>(null);
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [pin, setPin] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [username, setUsername] = useState('');
  const [pendingPin, setPendingPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Recovery Code state
  const [generatedCode, setGeneratedCode] = useState('');
  const [inputRecoveryCode, setInputRecoveryCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [savedCodeConfirmed, setSavedCodeConfirmed] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [recoveryAttempts, setRecoveryAttempts] = useState(0);
  const [recoveryLockout, setRecoveryLockout] = useState(0);

  // Reset PIN keypad state
  const [newPinPhase, setNewPinPhase] = useState<'create' | 'confirm'>('create');
  const [resetNewPin, setResetNewPin] = useState('');
  const [resetConfirmPin, setResetConfirmPin] = useState('');

  const shakeOffset = useSharedValue(0);
  const bootedRef = useRef(false);
  const doneRef = useRef(false);

  const shake = () => {
    shakeOffset.value = withSequence(
      withTiming(-10, { duration: 40 }),
      withTiming(10, { duration: 40 }),
      withTiming(-10, { duration: 40 }),
      withTiming(0, { duration: 40 }),
    );
  };

  const animatedShakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeOffset.value }] }));

  const business = useMemo(() => getActiveBusiness() ?? getDefaultBusiness(), []);
  const businessId = business?.id ?? null;

  const refresh = useCallback(() => {
    if (!businessId) return;
    setUsers(getUsers(businessId));
  }, [businessId]);

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    refresh();
    const currentId = getCurrentUserId();
    const needsSetup = users.find((u) => u.isActive && needsUserSetup(u.id));
    if (needsSetup) {
      setTargetUser(needsSetup);
      setUsername(needsSetup.username ?? '');
      setAvatar(needsSetup.avatar ?? null);
      setMode('setup');
    } else if (currentId) {
      const me = getUser(currentId);
      if (me && me.isActive) {
        setSelected(me);
        setMode('pin');
      } else {
        setMode('list');
      }
    } else {
      setMode('list');
    }
  }, [users, refresh]);

  // Recovery lockout cooldown timer
  useEffect(() => {
    if (recoveryLockout <= 0) return;
    const timer = setInterval(() => {
      setRecoveryLockout((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setRecoveryAttempts(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [recoveryLockout]);

  const gotoApp = useCallback(async () => {
    try {
      const { resolvePostAuthRoute } = await import('@/services/postAuthRouter');
      const target = await resolvePostAuthRoute();
      router.replace((target || '/(tabs)/dashboard') as any);
    } catch {
      router.replace('/(tabs)/dashboard' as any);
    }
  }, []);

  const completeSignIn = useCallback(
    (userId: string) => {
      if (doneRef.current) return;
      doneRef.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      resetAttempts();
      setCurrentUserId(userId);
      authenticate();
      gotoApp();
    },
    [resetAttempts, authenticate, gotoApp],
  );

  const handleUserPress = (user: User) => {
    if (isLocked) return;
    if (!user.isActive) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(t('signin.account_inactive'));
      return;
    }
    Haptics.selectionAsync();
    setSelected(user);
    setPin('');
    setError('');
    if (needsUserSetup(user.id)) {
      setTargetUser(user);
      setUsername(user.username ?? '');
      setAvatar(user.avatar ?? null);
      setMode('setup');
    } else {
      setMode('pin');
    }
  };

  const handlePinPress = async (num: string) => {
    if (isLocked || verifying || !selected || doneRef.current) return;
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + num;
    setPin(next);

    if (next.length === 4 && !hasModernScryptPin(selected.id)) {
      const ok4 = await verifyUserPin(selected.id, next);
      if (ok4) {
        completeSignIn(selected.id);
        return;
      }
    }

    if (next.length === PIN_LENGTH) {
      setVerifying(true);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      try {
        const ok = await verifyUserPin(selected.id, next);
        if (ok) {
          completeSignIn(selected.id);
        } else {
          setPin('');
          shake();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          await recordFailedAttempt();
        }
      } catch (error) {
        console.error('PIN verification error:', error);
        setPin('');
      } finally {
        setVerifying(false);
      }
    }
  };

  // Setup mode submit: generates recovery code and transitions to recovery-setup step
  const setupSubmit = async () => {
    if (!targetUser) return;
    const trimmed = username.trim();
    if (trimmed.length < 3) {
      setError(t('signin.username_min_length'));
      return;
    }
    if (pendingPin.length < 6) {
      setError('PIN must be exactly 6 digits.');
      return;
    }
    if (pendingPin !== confirmPin) {
      setError(t('signin.pins_mismatch'));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (!setUserUsername(targetUser.id, trimmed)) {
      setError(t('signin.username_taken'));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    const code = await generateRecoveryCode();
    setGeneratedCode(code);
    setSavedCodeConfirmed(false);
    setMode('recovery-setup');
  };

  // Complete setup after user confirms saving their recovery code
  const finishRecoverySetup = async () => {
    if (!targetUser || !generatedCode) return;
    await storeRecoveryCodeHash(generatedCode, targetUser.id);
    setCurrentUserId(targetUser.id);
    setUserPin(targetUser.id, pendingPin);
    if (avatar && avatar !== targetUser.avatar) setUserAvatar(avatar);
    setUsername('');
    setPendingPin('');
    setConfirmPin('');
    setError('');
    showToast('Recovery Code and PIN configured successfully', 'success');
    completeSignIn(targetUser.id);
  };

  // Forgot PIN: Verify Recovery Code
  const handleVerifyRecoveryCode = async () => {
    if (!selected || !inputRecoveryCode.trim()) return;
    if (recoveryLockout > 0) {
      setRecoveryError(`Too many attempts. Please wait ${recoveryLockout}s.`);
      return;
    }
    setRecoveryLoading(true);
    setRecoveryError('');
    try {
      const valid = await verifyRecoveryCode(inputRecoveryCode.trim(), selected.id);
      if (valid) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setResetNewPin('');
        setResetConfirmPin('');
        setNewPinPhase('create');
        setRecoveryError('');
        setMode('reset-pin');
      } else {
        const nextAttempts = recoveryAttempts + 1;
        setRecoveryAttempts(nextAttempts);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        if (nextAttempts >= MAX_ATTEMPTS) {
          setRecoveryLockout(60);
          setRecoveryError('Too many failed recovery attempts. Locked out for 60 seconds.');
        } else {
          setRecoveryError(`Invalid recovery code. ${MAX_ATTEMPTS - nextAttempts} attempts remaining.`);
        }
      }
    } catch {
      setRecoveryError('Verification failed. Try again.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  // Reset PIN Keypad handler
  const handleResetPinKeypress = (num: string) => {
    if (!selected) return;
    setRecoveryError('');
    if (newPinPhase === 'create') {
      if (resetNewPin.length < PIN_LENGTH) {
        const next = resetNewPin + num;
        setResetNewPin(next);
        if (next.length === PIN_LENGTH) {
          setNewPinPhase('confirm');
          Haptics.selectionAsync();
        }
      }
    } else {
      if (resetConfirmPin.length < PIN_LENGTH) {
        const next = resetConfirmPin + num;
        setResetConfirmPin(next);
        if (next.length === PIN_LENGTH) {
          if (next !== resetNewPin) {
            setRecoveryError('PINs do not match. Try again.');
            setResetConfirmPin('');
            shake();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          } else {
            setUserPin(selected.id, next);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showToast('PIN updated successfully. You can now sign in.', 'success');
            setResetNewPin('');
            setResetConfirmPin('');
            setPin('');
            setRecoveryError('');
            setMode('pin');
          }
        }
      }
    }
  };

  const pickAvatar = async (mode: 'camera' | 'library') => {
    if (!targetUser) return;
    try {
      if (mode === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { setError('Camera permission is needed to take a photo.'); return; }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { setError('Photo access is needed to choose a profile picture.'); return; }
      }
      const options = {
        mediaTypes: ['images'] as const,
        allowsEditing: true,
        aspect: [1, 1] as [number, number],
        quality: 0.6,
      };
      const result = mode === 'camera'
        ? await ImagePicker.launchCameraAsync(options as any)
        : await ImagePicker.launchImageLibraryAsync(options as any);
      if (result.canceled || !result.assets?.length) return;
      setAvatar(result.assets[0].uri);
      setError('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      setError('Could not access the photo.');
    }
  };

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    setCopiedCode(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const renderKey = (label: string | number, opts?: { icon?: any; onPress?: () => void }) => (
    <TouchableOpacity
      key={String(label)}
      style={[styles.keyNode, (isLocked || verifying) && { opacity: 0.2 }]}
      onPress={opts?.onPress ?? (() => handlePinPress(String(label)))}
      disabled={isLocked || verifying}
      activeOpacity={0.6}
    >
      {opts?.icon ?? (
        <AppText style={[styles.keyText, { color: G.fg }]} variant="display" weight="bold" numberOfLines={1}>
          {label}
        </AppText>
      )}
    </TouchableOpacity>
  );

  const roleLabel = (u: User) => {
    if (u.isOwner || u.role === 'owner') return t('signin.role_owner');
    if (u.role === 'manager') return t('signin.role_manager');
    if (u.role === 'cashier') return t('signin.role_cashier');
    return u.roleName || u.role || t('signin.role_member');
  };

  if (mode === 'booting') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: G.bg }]}>
        <View style={styles.center}>
          <Lock size={32} color={G.fg} strokeWidth={1.5} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: G.bg }]}>
      <View style={StyleSheet.absoluteFill}>
        <View style={[styles.glowNode, { top: -100, right: -100, backgroundColor: G.fg, opacity: 0.05 }]} />
        <View style={[styles.glowNode, { bottom: -60, left: -80, backgroundColor: G.fg, opacity: 0.03 }]} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.head}>
          <View style={[styles.shieldRing, { backgroundColor: G.border, borderColor: G.border }]}>
            <Shield size={28} color={G.fg} strokeWidth={1.5} />
          </View>
          <AppText style={[styles.title, { color: G.fg }]} variant="display" weight="bold" numberOfLines={2}>
            {mode === 'setup' ? t('signin.setup_title') : mode === 'recovery' ? 'Forgot PIN' : mode === 'reset-pin' ? 'Reset PIN' : t('signin.list_title')}
          </AppText>
          <AppText style={[styles.subtitle, { color: G.fgSecondary }]} variant="body" weight="medium" numberOfLines={3}>
            {mode === 'setup'
              ? t('signin.setup_subtitle')
              : mode === 'recovery'
                ? `Enter Recovery Code for ${selected?.name ?? ''}`
                : mode === 'reset-pin'
                  ? 'Set your new 6-digit PIN'
                  : mode === 'pin'
                    ? t('signin.enter_pin', { name: selected?.name ?? t('signin.your') })
                    : t('signin.choose_account')}
          </AppText>
        </View>

        <Animated.View entering={FadeIn.duration(600)} style={styles.content}>
          {mode === 'list' && (
            <View style={styles.listWrap}>
              {error ? (
                <AppText variant="caption" weight="bold" style={{ color: colors.error, textAlign: 'center', marginBottom: 4 }}>
                  {error}
                </AppText>
              ) : null}
              {users.filter((u) => u.isActive).length === 0 ? (
                <View style={styles.emptyState}>
                  <UserRound size={40} color={G.fgSecondary} />
                  <AppText variant="body" weight="medium" style={{ color: G.fgSecondary, textAlign: 'center' }}>
                    {t('signin.no_active_members')}
                  </AppText>
                  <TouchableOpacity style={[styles.ghostBtn, { borderColor: G.border }]} onPress={() => router.replace('/setup-wizard' as any)}>
                    <AppText variant="body" weight="bold" style={{ color: G.fg }}>
                      {t('signin.finish_setup')}
                    </AppText>
                  </TouchableOpacity>
                </View>
              ) : (
                users.map((u) => {
                  const accent = u.isOwner || u.role === 'owner' ? colors.warning : colors.primary;
                  return (
                    <TouchableOpacity
                      key={u.id}
                      style={[styles.userRow, { backgroundColor: G.bgCard, borderColor: G.border }]}
                      onPress={() => handleUserPress(u)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.userAvatar, { backgroundColor: accent + '1A' }]}>
                        {u.avatar ? (
                          <Image source={{ uri: u.avatar }} style={[styles.userAvatar, { backgroundColor: accent + '1A' }]} />
                        ) : (
                          <AppText variant="body" weight="bold" style={{ color: accent }} numberOfLines={1}>
                            {u.name.slice(0, 1).toUpperCase()}
                          </AppText>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <AppText variant="body" weight="bold" style={{ color: G.fg }} numberOfLines={1}>
                          {u.name}
                        </AppText>
                        <AppText variant="caption" weight="medium" style={{ color: G.fgSecondary }} numberOfLines={1}>
                          {roleLabel(u)}
                          {u.username ? ` · ${u.username}` : ''}
                          {needsUserSetup(u.id) ? t('signin.setup_badge') : ''}
                        </AppText>
                      </View>
                      {u.isActive ? null : <Shield size={16} color={G.fgSecondary} />}
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}

          {mode === 'pin' && selected && (
            <View style={{ alignItems: 'center' }}>
              <View style={[styles.userAvatar, { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary + '1A' }]}>
                {selected.avatar ? (
                  <Image source={{ uri: selected.avatar }} style={{ width: 72, height: 72, borderRadius: 36 }} />
                ) : (
                  <AppText variant="display" weight="bold" style={{ color: colors.primary }}>
                    {selected.name.slice(0, 1).toUpperCase()}
                  </AppText>
                )}
              </View>
              <AppText variant="title" weight="bold" style={{ color: G.fg, marginTop: 12 }} numberOfLines={1}>
                {selected.name}
              </AppText>

              <Animated.View style={[styles.dotsNode, animatedShakeStyle]}>
                {[...Array(PIN_LENGTH)].map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      pin.length > i ? [styles.dotFilled, { backgroundColor: G.fg }] : [styles.dotEmpty, { borderColor: G.border }],
                    ]}
                  >
                    {pin.length > i && <View style={[styles.dotPulse, { backgroundColor: G.bg }]} />}
                  </View>
                ))}
              </Animated.View>
              {verifying && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <ActivityIndicator size="small" color={G.fg} />
                  <AppText variant="caption" weight="bold" style={{ color: G.fgSecondary, marginLeft: 8 }}>
                    {t('signin.verifying')}
                  </AppText>
                </View>
              )}

              {error ? (
                <AppText variant="caption" weight="bold" style={{ color: colors.error, marginBottom: 12 }}>
                  {error}
                </AppText>
              ) : null}

              {isLocked ? (
                <View style={[styles.lockoutCard, { backgroundColor: colors.error + '14', borderColor: colors.error + '55' }]}>
                  <ShieldAlert size={20} color={colors.error} strokeWidth={1.8} />
                  <AppText variant="body" weight="bold" style={{ color: colors.error, textAlign: 'center' }}>
                    Too many attempts
                  </AppText>
                  <AppText variant="caption" weight="medium" style={{ color: colors.error, textAlign: 'center' }}>
                    You&apos;ve tried more than {MAX_ATTEMPTS} times. Please wait {lockoutRemaining}s and try again.
                  </AppText>
                  <View style={[styles.lockoutBar, { backgroundColor: colors.error + '33' }]}>
                    <View style={[styles.lockoutBarFill, { backgroundColor: colors.error, width: `${Math.min(100, (lockoutRemaining / 60) * 100)}%` }]} />
                  </View>
                </View>
              ) : (
                attemptsRemaining < MAX_ATTEMPTS && (
                  <View style={[styles.lockoutCard, { backgroundColor: colors.warning + '14', borderColor: colors.warning + '55' }]}>
                    <Timer size={16} color={colors.warning} strokeWidth={1.8} />
                    <AppText variant="caption" weight="bold" style={{ color: colors.warning }}>
                      Wrong PIN — {attemptsRemaining} {attemptsRemaining === 1 ? 'attempt' : 'attempts'} remaining before lockout
                    </AppText>
                  </View>
                )
              )}

              <View style={styles.keypad}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => renderKey(n))}
                <View style={[styles.keyNode, (isLocked || verifying) && { opacity: 0.2 }]} />
                {renderKey(0)}
                {renderKey('del', { icon: <Delete size={24} color={G.fg} strokeWidth={1.5} />, onPress: () => setPin(pin.slice(0, -1)) })}
              </View>

              <TouchableOpacity
                style={{ marginTop: 14, paddingVertical: 6, paddingHorizontal: 12 }}
                onPress={() => {
                  setInputRecoveryCode('');
                  setRecoveryError('');
                  setMode('recovery');
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <KeyRound size={15} color={G.fgSecondary} />
                  <AppText variant="caption" weight="bold" style={{ color: colors.primary }}>
                    Forgot PIN?
                  </AppText>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.backLink} onPress={() => { setMode('list'); setSelected(null); setPin(''); }}>
                <AppText variant="caption" weight="bold" style={{ color: G.fgSecondary }}>
                  {t('signin.switch_account')}
                </AppText>
              </TouchableOpacity>
            </View>
          )}

          {/* Recovery verification mode */}
          {mode === 'recovery' && selected && (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <View style={styles.setupCard}>
                <View style={[styles.userAvatar, { alignSelf: 'center', backgroundColor: colors.primary + '1A', width: 64, height: 64, borderRadius: 32 }]}>
                  {selected.avatar ? (
                    <Image source={{ uri: selected.avatar }} style={{ width: 64, height: 64, borderRadius: 32 }} />
                  ) : (
                    <AppText variant="title" weight="bold" style={{ color: colors.primary }}>
                      {selected.name.slice(0, 1).toUpperCase()}
                    </AppText>
                  )}
                </View>
                <AppText variant="title" weight="bold" style={{ color: G.fg, textAlign: 'center', marginTop: 10 }}>
                  Forgot PIN?
                </AppText>
                <AppText variant="caption" weight="medium" style={{ color: G.fgSecondary, textAlign: 'center', marginBottom: 16 }}>
                  Enter the Recovery Code for {selected.name} to verify your identity.
                </AppText>

                {recoveryError ? (
                  <AppText variant="caption" weight="bold" style={{ color: colors.error, marginBottom: 12, textAlign: 'center' }}>
                    {recoveryError}
                  </AppText>
                ) : null}

                <View style={styles.inputGroup}>
                  <TextInput
                    style={[styles.input, { color: G.fg, borderColor: G.border, backgroundColor: G.bgCard, textAlign: 'center', letterSpacing: 2, fontSize: 18, fontFamily: Fonts.bold }]}
                    placeholder="REC-849230"
                    placeholderTextColor={G.fgSecondary}
                    value={inputRecoveryCode}
                    onChangeText={(v) => { setInputRecoveryCode(v); setRecoveryError(''); }}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: recoveryLoading || inputRecoveryCode.trim().length < 6 ? 0.5 : 1, marginTop: 12 }]}
                  disabled={recoveryLoading || inputRecoveryCode.trim().length < 6}
                  onPress={handleVerifyRecoveryCode}
                >
                  {recoveryLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <AppText variant="body" weight="bold" style={{ color: '#FFFFFF' }}>
                      Verify Recovery Code
                    </AppText>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.backLink} onPress={() => { setMode('pin'); setRecoveryError(''); }}>
                  <AppText variant="caption" weight="bold" style={{ color: G.fgSecondary }}>
                    Back to Login
                  </AppText>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          )}

          {/* Reset PIN keypad mode */}
          {mode === 'reset-pin' && selected && (
            <View style={{ alignItems: 'center' }}>
              <AppText variant="title" weight="bold" style={{ color: G.fg, marginTop: 10 }}>
                {newPinPhase === 'create' ? 'Create New PIN' : 'Confirm New PIN'}
              </AppText>
              <AppText variant="caption" weight="medium" style={{ color: G.fgSecondary, textAlign: 'center', marginTop: 4, marginBottom: 16 }}>
                {newPinPhase === 'create' ? 'Enter a new 6-digit PIN' : 'Re-enter your new 6-digit PIN'}
              </AppText>

              <Animated.View style={[styles.dotsNode, animatedShakeStyle]}>
                {[...Array(PIN_LENGTH)].map((_, i) => {
                  const val = newPinPhase === 'create' ? resetNewPin : resetConfirmPin;
                  return (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        val.length > i ? [styles.dotFilled, { backgroundColor: G.fg }] : [styles.dotEmpty, { borderColor: G.border }],
                      ]}
                    />
                  );
                })}
              </Animated.View>

              {recoveryError ? (
                <AppText variant="caption" weight="bold" style={{ color: colors.error, marginBottom: 12 }}>
                  {recoveryError}
                </AppText>
              ) : null}

              <View style={styles.keypad}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={styles.keyNode}
                    onPress={() => handleResetPinKeypress(String(n))}
                    activeOpacity={0.6}
                  >
                    <AppText style={[styles.keyText, { color: G.fg }]} variant="display" weight="bold">
                      {n}
                    </AppText>
                  </TouchableOpacity>
                ))}
                <View style={styles.keyNode} />
                <TouchableOpacity
                  style={styles.keyNode}
                  onPress={() => handleResetPinKeypress('0')}
                  activeOpacity={0.6}
                >
                  <AppText style={[styles.keyText, { color: G.fg }]} variant="display" weight="bold">0</AppText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.keyNode}
                  onPress={() => {
                    if (newPinPhase === 'create') setResetNewPin((v) => v.slice(0, -1));
                    else setResetConfirmPin((v) => v.slice(0, -1));
                  }}
                  activeOpacity={0.6}
                >
                  <Delete size={24} color={G.fg} strokeWidth={1.5} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.backLink} onPress={() => { setMode('pin'); setResetNewPin(''); setResetConfirmPin(''); }}>
                <AppText variant="caption" weight="bold" style={{ color: G.fgSecondary }}>
                  Cancel
                </AppText>
              </TouchableOpacity>
            </View>
          )}

          {/* Recovery Code Setup step during initial setup */}
          {mode === 'recovery-setup' && targetUser && (
            <View style={styles.setupCard}>
              <View style={[styles.shieldRing, { alignSelf: 'center', backgroundColor: G.border, borderColor: G.border, marginBottom: 12 }]}>
                <KeyRound size={32} color={colors.primary} />
              </View>

              <AppText variant="title" weight="bold" style={{ color: G.fg, textAlign: 'center' }}>
                Save Your Recovery Code
              </AppText>
              <AppText variant="caption" weight="medium" style={{ color: G.fgSecondary, textAlign: 'center', marginTop: 6, marginBottom: 16 }}>
                Store this recovery code in a safe place. You will need it to reset your PIN if you ever forget it.
              </AppText>

              <View style={[styles.codeCard, { backgroundColor: G.bgCard, borderColor: G.border }]}>
                <AppText variant="display" weight="bold" style={{ color: G.fg, letterSpacing: 2 }}>
                  {generatedCode}
                </AppText>
                <TouchableOpacity
                  style={[styles.pickBtn, { backgroundColor: G.bg, borderColor: G.border, marginTop: 10 }]}
                  onPress={() => copyToClipboard(generatedCode)}
                >
                  <Copy size={14} color={G.fg} />
                  <AppText variant="caption" weight="bold" style={{ color: G.fg, marginLeft: 6 }}>
                    {copiedCode ? 'Copied to Clipboard' : 'Copy Code'}
                  </AppText>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 16 }}
                onPress={() => setSavedCodeConfirmed(!savedCodeConfirmed)}
              >
                <View style={[styles.checkbox, { borderColor: savedCodeConfirmed ? colors.primary : G.border, backgroundColor: savedCodeConfirmed ? colors.primary : 'transparent' }]}>
                  {savedCodeConfirmed && <CheckCircle2 size={14} color="#FFFFFF" />}
                </View>
                <AppText variant="caption" weight="medium" style={{ color: G.fg, flex: 1 }}>
                  I have saved my Recovery Code in a safe place.
                </AppText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: savedCodeConfirmed ? 1 : 0.5 }]}
                disabled={!savedCodeConfirmed}
                onPress={finishRecoverySetup}
              >
                <AppText variant="body" weight="bold" style={{ color: '#FFFFFF' }}>
                  Finish Setup
                </AppText>
                <ChevronRight size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}

          {mode === 'setup' && targetUser && (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
              <View style={styles.setupCard}>
                <View style={[styles.userAvatar, { alignSelf: 'center', backgroundColor: colors.primary + '1A' }]}>
                  {(avatar || targetUser.avatar) ? (
                    <Image source={{ uri: avatar || targetUser.avatar }} style={styles.userAvatar} />
                  ) : (
                    <AppText variant="body" weight="bold" style={{ color: colors.primary }}>
                      {targetUser.name.slice(0, 1).toUpperCase()}
                    </AppText>
                  )}
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 10 }}>
                  <TouchableOpacity
                    onPress={() => { Haptics.selectionAsync(); pickAvatar('camera'); }}
                    style={[styles.pickBtn, { backgroundColor: G.bgCard, borderColor: G.border }]}
                  >
                    <Camera size={14} color={G.fg} />
                    <AppText variant="caption" weight="bold" style={{ color: G.fg, marginLeft: 5 }}>Take photo</AppText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { Haptics.selectionAsync(); pickAvatar('library'); }}
                    style={[styles.pickBtn, { backgroundColor: G.bgCard, borderColor: G.border }]}
                  >
                    <ImagePlus size={14} color={G.fg} />
                    <AppText variant="caption" weight="bold" style={{ color: G.fg, marginLeft: 5 }}>Choose image</AppText>
                  </TouchableOpacity>
                </View>
                <AppText variant="title" weight="bold" style={{ color: G.fg, textAlign: 'center', marginTop: 10 }}>
                  {targetUser.name}
                </AppText>
                <AppText variant="caption" weight="medium" style={{ color: G.fgSecondary, textAlign: 'center', marginBottom: 16 }}>
                  {roleLabel(targetUser)}
                </AppText>

                <View style={styles.inputGroup}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <UserPlus size={15} color={G.fgSecondary} />
                    <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.fgSecondary, letterSpacing: 1 }}>
                      {t('signin.username_label')}
                    </AppText>
                  </View>
                  <TextInput
                    style={[styles.input, { color: G.fg, borderColor: G.border, backgroundColor: G.bgCard }]}
                    placeholder={t('signin.username_placeholder')}
                    placeholderTextColor={G.fgSecondary}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <KeyRound size={15} color={G.fgSecondary} />
                    <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.fgSecondary, letterSpacing: 1 }}>
                      {t('signin.pin')}
                    </AppText>
                  </View>
                  <TextInput
                    style={[styles.input, { color: G.fg, borderColor: G.border, backgroundColor: G.bgCard }]}
                    placeholder={t('signin.pin_placeholder')}
                    placeholderTextColor={G.fgSecondary}
                    value={pendingPin}
                    onChangeText={(v) => setPendingPin(v.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    secureTextEntry
                  />
                </View>

                <View style={styles.inputGroup}>
                  <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.fgSecondary, letterSpacing: 1 }}>
                    {t('signin.confirm_pin')}
                  </AppText>
                  <TextInput
                    style={[styles.input, { color: G.fg, borderColor: G.border, backgroundColor: G.bgCard }]}
                    placeholder={t('signin.repeat_pin')}
                    placeholderTextColor={G.fgSecondary}
                    value={confirmPin}
                    onChangeText={(v) => setConfirmPin(v.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    secureTextEntry
                  />
                </View>

                {error ? (
                  <AppText variant="caption" weight="bold" style={{ color: colors.error, marginBottom: 10, textAlign: 'center' }}>
                    {error}
                  </AppText>
                ) : null}

                <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.primary }]} onPress={setupSubmit}>
                  <AppText variant="body" weight="bold" style={{ color: '#FFFFFF' }}>
                    {t('signin.save_sign_in')}
                  </AppText>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  glowNode: { position: 'absolute', width: 220, height: 220, borderRadius: 110 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 20 },
  head: { alignItems: 'center', marginBottom: 20 },
  shieldRing: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontSize: 24, textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', marginTop: 4 },
  content: { width: '100%' },
  listWrap: { gap: 10 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14 },
  userAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  ghostBtn: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  dotsNode: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginVertical: 20 },
  dot: { width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  dotEmpty: { borderWidth: 1.5, backgroundColor: 'transparent' },
  dotFilled: {},
  dotPulse: { width: 6, height: 6, borderRadius: 3 },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', width: 260, gap: 14, marginTop: 12 },
  keyNode: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontSize: 28 },
  lockoutCard: { borderWidth: 1, borderRadius: 16, padding: 16, width: '100%', alignItems: 'center', gap: 6, marginBottom: 16 },
  lockoutBar: { width: '100%', height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 6 },
  lockoutBarFill: { height: '100%' },
  backLink: { marginTop: 16, alignSelf: 'center', padding: 8 },
  setupCard: { width: '100%', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  pickBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  inputGroup: { marginBottom: 12, gap: 4 },
  input: { height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 15, fontFamily: Fonts.medium },
  submitBtn: { height: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  codeCard: { borderWidth: 1, borderRadius: 16, padding: 20, alignItems: 'center', justifyContent: 'center', marginVertical: 12 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
