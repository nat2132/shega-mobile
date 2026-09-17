import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { router } from 'expo-router';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  withSequence,
  withTiming,
  useSharedValue,
} from 'react-native-reanimated';
import { Delete, Lock, Shield, ShieldAlert, Timer, UserRound, UserPlus, KeyRound } from 'lucide-react-native';

import { AppText } from '@/components/ui';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
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
  verifyUserPin,
  needsUserSetup,
} from '@/services/businessService';
import type { User } from '@shega/shared';

const { width } = Dimensions.get('window');
const PIN_LENGTH = 4;
const MAX_ATTEMPTS = 5;

/**
 * Business-user sign-in gate. Replaces the old device-wide PIN: a member of the
 * active business signs in with username+PIN. Members created by the owner have
 * no credentials yet, so the first sign-in prompts them to create username+PIN
 * (the "setup" mode). On success the user becomes `current_user_id`, which
 * drives the role/permission-aware UI via usePermissions/useBusinessAuth.
 */
export default function UserSigninScreen() {
  const { colors, t } = useSettings();
  const { authenticate, recordFailedAttempt, resetAttempts, isLocked, lockoutRemaining, attemptsRemaining } = useAuth();
  const MAX_ATTEMPTS = 5;
  const G = getAuthGlass(colors);

  type Mode = 'booting' | 'list' | 'pin' | 'setup';
  const [mode, setMode] = useState<Mode>('booting');
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState<User | null>(null);
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [pin, setPin] = useState('');
  const [username, setUsername] = useState('');
  const [pendingPin, setPendingPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');

  const shakeOffset = useSharedValue(0);
  const bootedRef = useRef(false);

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
      setMode('setup');
    } else {
      setMode('pin');
    }
  };

  const handlePinPress = async (num: string) => {
    if (isLocked || !selected) return;
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + num;
    setPin(next);
    if (next.length === PIN_LENGTH) {
      const ok = await verifyUserPin(selected.id, next);
      if (ok) {
        completeSignIn(selected.id);
      } else {
        setPin('');
        shake();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        await recordFailedAttempt();
      }
    }
  };

  const setupSubmit = () => {
    if (!targetUser) return;
    const trimmed = username.trim();
    if (trimmed.length < 3) {
      setError(t('signin.username_min_length'));
      return;
    }
    if (pendingPin.length < 4) {
      setError(t('signin.pin_min_length'));
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
    setUserPin(targetUser.id, pendingPin);
    setUsername('');
    setPendingPin('');
    setConfirmPin('');
    setError('');
    completeSignIn(targetUser.id);
  };

  const renderKey = (label: string | number, opts?: { icon?: any; onPress?: () => void }) => (
    <TouchableOpacity
      key={String(label)}
      style={[styles.keyNode, isLocked && { opacity: 0.2 }]}
      onPress={opts?.onPress ?? (() => handlePinPress(String(label)))}
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
            {mode === 'setup' ? t('signin.setup_title') : t('signin.list_title')}
          </AppText>
          <AppText style={[styles.subtitle, { color: G.fgSecondary }]} variant="body" weight="medium" numberOfLines={3}>
            {mode === 'setup'
              ? t('signin.setup_subtitle')
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
                    You've tried more than {MAX_ATTEMPTS} times. Please wait {lockoutRemaining}s and try again.
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
                <View style={[styles.keyNode, isLocked && { opacity: 0.2 }]} />
                {renderKey(0)}
                {renderKey('del', { icon: <Delete size={24} color={G.fg} strokeWidth={1.5} />, onPress: () => setPin(pin.slice(0, -1)) })}
              </View>

              <TouchableOpacity style={styles.backLink} onPress={() => { setMode('list'); setSelected(null); setPin(''); }}>
                <AppText variant="caption" weight="bold" style={{ color: G.fgSecondary }}>
                  {t('signin.switch_account')}
                </AppText>
              </TouchableOpacity>
            </View>
          )}

          {mode === 'setup' && targetUser && (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
              <View style={styles.setupCard}>
                <View style={[styles.userAvatar, { alignSelf: 'center', backgroundColor: colors.primary + '1A' }]}>
                  {targetUser.avatar ? (
                    <Image source={{ uri: targetUser.avatar }} style={styles.userAvatar} />
                  ) : (
                    <AppText variant="body" weight="bold" style={{ color: colors.primary }}>
                      {targetUser.name.slice(0, 1).toUpperCase()}
                    </AppText>
                  )}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glowNode: { position: 'absolute', width: 400, height: 400, borderRadius: 200 },
  scroll: { paddingTop: 80, paddingHorizontal: 32, paddingBottom: 40, flexGrow: 1 },
  head: { alignItems: 'center', marginBottom: 28 },
  shieldRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: { fontFamily: Fonts.extrabold, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontFamily: Fonts.medium, marginTop: 8, textAlign: 'center' },
  content: { flex: 1 },
  listWrap: { gap: 10 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  emptyState: { alignItems: 'center', gap: 16, paddingTop: 40 },
  lockoutCard: {
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
    width: '100%',
    maxWidth: 320,
  },
  lockoutBar: { width: '100%', height: 4, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  lockoutBarFill: { height: '100%', borderRadius: 2 },
  ghostBtn: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  dotsNode: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 28,
    marginBottom: 16,
    height: 30,
    alignItems: 'center',
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotEmpty: { borderWidth: 1.5, backgroundColor: 'transparent' },
  dotFilled: {},
  dotPulse: { width: 5, height: 5, borderRadius: 2.5 },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 6,
  },
  keyNode: {
    width: (width - 130) / 3,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
    borderRadius: 33,
  },
  keyText: { fontFamily: Fonts.bold },
  backLink: { marginTop: 8, paddingVertical: 8, paddingHorizontal: 16 },
  setupCard: {
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 20,
    padding: 20,
  },
  inputGroup: { marginBottom: 14 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    fontFamily: Fonts.medium,
    fontSize: 14,
    marginTop: 6,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 16,
    marginTop: 4,
  },
});