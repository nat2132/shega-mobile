/**
 * "You're Approved" — post-approval member gate for joiners.
 *
 * After the Owner assigns a role, the approved joiner device lands here before
 * the main platform. This screen is the role-assignment notification (shows
 * the exact role the Owner picked), then collects the member's OWN profile
 * picture, username and PIN. Entry into the dashboard is blocked until those
 * are saved, so a joiner can never use the platform before the Owner's role
 * assignment has landed and the member has completed their own setup.
 *
 * Owner-assigned identity (name / avatar / permissions) arrives via
 * restoreBusinessFromJoin; this screen's avatar starts from that value so a
 * joiner keeps the Owner's pick unless they choose their own photo.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Camera, ImagePlus, KeyRound, PartyPopper, User, UserPlus } from 'lucide-react-native';

import { AppText } from '@/components/ui';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import { getGlass } from './glass-theme';
import {
  getActiveBusiness, getDefaultBusiness, getCurrentUserId, getUser,
  needsUserSetup, setUserName, setUserAvatar, setUserPin, setUserUsername,
} from '@/services/businessService';

const PIN_LENGTH = 6;

export default function JoinSetupScreen() {
  const { colors } = useSettings();
  const { authenticate } = useAuth();
  const G = getGlass(colors);

  const [booting, setBooting] = useState(true);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [pendingPin, setPendingPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const bootedRef = useRef(false);

  // The member + business are already local: restoreBusinessFromJoin created
  // the joiner's users row and set them as the current user at approval time.
  // The Owner assigned only the ROLE — the member's own name/avatar/PIN are
  // collected on this screen so identity belongs to the person/account.
  const business = useMemo(() => getActiveBusiness() ?? getDefaultBusiness(), []);
  const me = useMemo(() => {
    const id = getCurrentUserId();
    return id ? (getUser(id) ?? null) : null;
  }, []);

  const roleLabel = useMemo(() => {
    const r = me?.role;
    if (r === 'owner') return 'Owner';
    if (r === 'manager') return 'Manager';
    if (r === 'cashier') return 'Cashier';
    return me?.roleName || r || 'Member';
  }, [me]);

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    if (me) {
      setName(me.name ?? '');
      setAvatar(me.avatar ?? null);
      setUsername(me.username ?? '');
    }
    setBooting(false);
  }, [me]);

  const goToApp = useCallback(() => {
    router.replace('/(tabs)/dashboard' as any);
  }, []);

  // Already fully set up (cold-start re-entry, or setup completed elsewhere):
  // skip straight into the platform.
  useEffect(() => {
    if (booting) return;
    if (me && !needsUserSetup(me.id)) {
      authenticate();
      goToApp();
    }
  }, [booting, me, authenticate, goToApp]);

  const pickAvatar = async (mode: 'camera' | 'library') => {
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

  const submit = async () => {
    if (!me) return;
    const trimmedName = name.trim();
    const trimmed = username.trim();
    if (trimmedName.length < 2) { setError('Enter your name.'); return; }
    if (trimmed.length < 3) { setError('Username must be at least 3 characters.'); return; }
    if (pendingPin.length < PIN_LENGTH) { setError(`PIN must be ${PIN_LENGTH} digits.`); return; }
    if (pendingPin !== confirmPin) {
      setError('PINs do not match.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setSaving(true);
    setError('');
    try {
      setUserName(me.id, trimmedName);
      if (!setUserUsername(me.id, trimmed)) {
        setError('That username is already taken.');
        setSaving(false);
        return;
      }
      setUserPin(me.id, pendingPin);
      setUserAvatar(avatar);
      await SecureStore.setItemAsync('setup_wizard_done', 'true');
      await SecureStore.setItemAsync('user_setupComplete', 'true');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      authenticate();
      goToApp();
    } catch {
      setError('Could not save your profile. Please try again.');
      setSaving(false);
    }
  };

  // Nothing to finish (no member row / no business) — hand back to the sign-in gate.
  if (!me || !business) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: G.bg }]}>
        <AppText variant="body" weight="medium" align="center" style={{ color: G.muted }}>
          Nothing to finish here.
        </AppText>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: G.fg, marginTop: 16 }]}
          onPress={() => router.replace('/user-signin' as any)}
        >
          <AppText variant="body" weight="bold" style={{ color: G.bg }}>Back to Sign in</AppText>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: G.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* ── Role-assignment notification ── */}
        <View style={styles.header}>
          <View style={[styles.iconCircle, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]}>
            <PartyPopper size={30} color={G.textGlassStrong} />
          </View>
          <AppText variant="display" weight="bold" align="center" style={{ color: G.fg }}>
            You&apos;re Approved!
          </AppText>
          <AppText variant="body" weight="medium" align="center" style={{ color: G.muted, marginTop: 8 }}>
            The Owner brought you into {business.name}.
          </AppText>
          <View style={[styles.roleCard, { backgroundColor: G.accentGlass, borderColor: G.border }]}>
            <AppText variant="caption" weight="bold" style={{ color: G.muted }}>Assigned role</AppText>
            <AppText variant="heading-lg" weight="bold" style={{ color: G.fg, marginTop: 4 }}>
              {roleLabel}
            </AppText>
          </View>
        </View>

        {/* ── Profile picture ── */}
        <View style={[styles.card, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]}>
          <AppText variant="body" weight="bold" style={{ color: G.fg }}>
            Set up your profile
          </AppText>
          <AppText variant="caption" weight="medium" style={{ color: G.muted, marginTop: 4 }}>
            Add your name, photo, username and PIN to open the platform.
          </AppText>

          <View style={{ alignItems: 'center', marginTop: 18 }}>
            <View style={[styles.avatar, { backgroundColor: G.bg, borderColor: G.glassBorder }]}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatar} />
              ) : (
                <User size={40} color={G.muted} />
              )}
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); pickAvatar('camera'); }}
                style={[styles.pickBtn, { backgroundColor: G.bg, borderColor: G.glassBorder }]}
              >
                <Camera size={15} color={G.fg} />
                <AppText variant="caption" weight="bold" style={{ color: G.fg, marginLeft: 5 }}>Take photo</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); pickAvatar('library'); }}
                style={[styles.pickBtn, { backgroundColor: G.bg, borderColor: G.glassBorder }]}
              >
                <ImagePlus size={15} color={G.fg} />
                <AppText variant="caption" weight="bold" style={{ color: G.fg, marginLeft: 5 }}>Choose image</AppText>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <UserPlus size={15} color={G.muted} />
              <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted, letterSpacing: 1 }}>
                Your name
              </AppText>
            </View>
            <TextInput
              style={[styles.input, { color: G.fg, borderColor: G.glassBorder, backgroundColor: G.bg }]}
              placeholder="e.g. Abebe Kebede"
              placeholderTextColor={G.muted}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <UserPlus size={15} color={G.muted} />
              <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted, letterSpacing: 1 }}>
                Username
              </AppText>
            </View>
            <TextInput
              style={[styles.input, { color: G.fg, borderColor: G.glassBorder, backgroundColor: G.bg }]}
              placeholder="e.g. abebe.k"
              placeholderTextColor={G.muted}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <KeyRound size={15} color={G.muted} />
              <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted, letterSpacing: 1 }}>
                PIN
              </AppText>
            </View>
            <TextInput
              style={[styles.input, { color: G.fg, borderColor: G.glassBorder, backgroundColor: G.bg }]}
              placeholder="6-digit PIN"
              placeholderTextColor={G.muted}
              value={pendingPin}
              onChangeText={(v) => setPendingPin(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              secureTextEntry
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <KeyRound size={15} color={G.muted} />
              <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted, letterSpacing: 1 }}>
                Confirm PIN
              </AppText>
            </View>
            <TextInput
              style={[styles.input, { color: G.fg, borderColor: G.glassBorder, backgroundColor: G.bg }]}
              placeholder="Repeat your PIN"
              placeholderTextColor={G.muted}
              value={confirmPin}
              onChangeText={(v) => setConfirmPin(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              secureTextEntry
            />
          </View>

          {!!error && (
            <AppText variant="caption" weight="bold" style={{ color: '#e74c3c', textAlign: 'center', marginBottom: 8 }}>
              {error}
            </AppText>
          )}

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: G.fg, opacity: saving ? 0.5 : 1 }]}
            onPress={submit}
            disabled={saving}
          >
            <AppText variant="body" weight="bold" style={{ color: G.bg }}>Start Using Shega</AppText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  scroll: { paddingHorizontal: 24, paddingVertical: 60 },
  header: { alignItems: 'center', marginBottom: 22 },
  iconCircle: {
    width: 68, height: 68, borderRadius: 34, alignItems: 'center',
    justifyContent: 'center', borderWidth: 1, marginBottom: 16,
  },
  roleCard: {
    alignItems: 'center', borderRadius: 18, borderWidth: 1,
    paddingHorizontal: 26, paddingVertical: 14, marginTop: 18,
  },
  card: { borderRadius: 22, padding: 20, borderWidth: 1 },
  avatar: {
    width: 96, height: 96, borderRadius: 48, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  pickBtn: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 999,
    paddingVertical: 9, paddingHorizontal: 14, borderWidth: 1,
  },
  inputGroup: { marginTop: 16 },
  input: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 46,
    fontSize: 14, marginTop: 6, fontWeight: '600',
  },
  primaryBtn: { alignItems: 'center', paddingVertical: 16, borderRadius: 999, marginTop: 18 },
});