import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Image,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import {
  Check,
  ShieldCheck,
  Camera,
  User,
  Building2,
  BadgeCheck,
  Sparkles,
  LogOut,
  Mail,
  Crown,
  RefreshCw,
  ChevronRight
} from 'lucide-react-native';
import Animated, {
  FadeInDown,
  ZoomIn
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Fonts } from '@/constants/theme';
import { useSettings, PROFILE_IMAGES } from '@/context/SettingsContext';
import { useDialog } from '@/context/DialogContext';

import { router } from 'expo-router';
import { AppText} from '@/components/ui';
import { getSettingsGlass } from './glass-settings';
import { useAccount } from '@/context/AccountContext';
import { setUserAvatar } from '@/services/businessService';
import { SubscriptionStatusInfo } from '@/services/api';
const EditProfileScreen = () => {
  const { userProfile, setUserProfile, t, colors } = useSettings();
  const { user: accountUser, subscription, isLoggedIn, logout } = useAccount();
  const G = getSettingsGlass(colors);
  const dialog = useDialog();
  const [name, setName] = useState(userProfile.name);
  const [businessName, setBusinessName] = useState(userProfile.businessName);
  const [selectedAvatar, setSelectedAvatar] = useState(userProfile.avatarIndex);
  const [customAvatarUri, setCustomAvatarUri] = useState<string | undefined>(userProfile.avatarUri);

  const handleSave = async () => {
    setUserProfile({
      name,
      businessName,
      avatarIndex: selectedAvatar,
      avatarUri: customAvatarUri,
    });
    // Persist to the users table so activity feeds across the app show it
    setUserAvatar(customAvatarUri ?? null);
    const ok = await dialog.confirm({
      title: t('common.success'),
      message: t('profile.updated_success'),
      confirmText: 'OK',
      iconType: 'success',
    });
    if (ok) {
      router.replace('/dashboard');
    }
  };

  const handleSelectAvatar = (index: number) => {
    setSelectedAvatar(index);
    setCustomAvatarUri(undefined);
  };

  const handlePickImage = async () => {
    Haptics.selectionAsync();
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      await dialog.alert({ title: t('permission.required'), message: t('permission.library_message'), iconType: 'info' });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setCustomAvatarUri(result.assets[0].uri);
      setSelectedAvatar(-1); // -1 indicates custom image is active
    }
  };

  const avatarSource = customAvatarUri
    ? { uri: customAvatarUri }
    : PROFILE_IMAGES[selectedAvatar >= 0 ? selectedAvatar : 0];

  return (
    <View style={{ flex: 1, backgroundColor: G.bg }}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[styles.glowWash, { backgroundColor: G.mutedLight, top: -80, left: -60, width: 200, height: 200, borderRadius: 100 }]} />
        <View style={[styles.glowWash, { backgroundColor: G.mutedLight, bottom: -40, right: -30, width: 160, height: 160, borderRadius: 80 }]} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView 
          contentContainerStyle={styles.container} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
      {/* Elite Profile Banner */}
      <View style={styles.bannerContainer}>
        <View style={[styles.bannerWash, { backgroundColor: G.fg + '05' }]} />
        <Animated.View entering={ZoomIn} style={styles.avatarWrapper}>
           <Image 
             source={avatarSource} 
             style={[styles.mainAvatar, { borderColor: G.bg }]} 
           />
           <View style={[styles.verifiedBadge, { backgroundColor: colors.primary }]}>
             <BadgeCheck size={18} color={G.bg} />
           </View>
           <TouchableOpacity 
             style={[styles.pencilIcon, { backgroundColor: G.fg }]}
             onPress={handlePickImage}
           >
             <Camera size={16} color={G.bg} />
           </TouchableOpacity>
        </Animated.View>
        <AppText variant="heading-lg" weight="bold" style={[styles.profileTitle, { color: G.fg }]} numberOfLines={2}>{userProfile.businessName || t('profile.elite_user')}</AppText>
        <AppText variant="caption" weight="bold" style={[styles.profileSub, { color: G.fgSecondary }]} numberOfLines={1}>{t('profile.verified_identity')}</AppText>
      </View>

      <Animated.View entering={FadeInDown.delay(200)} style={styles.sectionHeader}>
        <Sparkles size={16} color={colors.primary} />
        <AppText variant="caption" weight="bold" style={[styles.sectionSubtitle, { color: G.fgSecondary }]} numberOfLines={1}>{t('settings.choose_avatar')}</AppText>
      </Animated.View>

      <View style={styles.avatarGrid}>
        {PROFILE_IMAGES.map((img, i) => (
          <Animated.View key={i} entering={FadeInDown.delay(300 + i * 50)}>
            <TouchableOpacity 
              onPress={() => handleSelectAvatar(i)}
              style={[
                styles.smallAvatarWrapper, 
                selectedAvatar === i && !customAvatarUri && [styles.selectedAvatarWrapper, { borderColor: colors.primary }]
              ]}
            >
              <Image source={img} style={styles.smallAvatar} />
              {selectedAvatar === i && !customAvatarUri && (
                <View style={[styles.checkBadge, { backgroundColor: colors.primary }]}>
                  <Check size={8} color={G.bg} strokeWidth={4} />
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>
        ))}
        {/* Custom Image Upload Button */}
        <Animated.View entering={FadeInDown.delay(1300)}>
          <TouchableOpacity 
            onPress={handlePickImage}
            style={[
              styles.smallAvatarWrapper, 
              customAvatarUri && [styles.selectedAvatarWrapper, { borderColor: colors.primary }]
            ]}
          >
            <View style={[styles.smallAvatar, { backgroundColor: G.border, justifyContent: 'center', alignItems: 'center' }]}>
              <Camera size={22} color={G.fgSecondary} />
            </View>
            {customAvatarUri && (
              <View style={[styles.checkBadge, { backgroundColor: colors.primary }]}>
                <Check size={8} color={G.bg} strokeWidth={4} />
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Verification Nodes */}
      <Animated.View entering={FadeInDown.delay(600)} style={styles.formContainer}>
        <View style={[styles.formCard, { backgroundColor: G.bgCard, borderColor: G.border }]}>
          <AppText variant="caption" weight="bold" style={[styles.formLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('settings.personal_info').toUpperCase()}</AppText>

          <View style={styles.inputNode}>
            <View style={styles.nodeHeader}>
               <User size={14} color={G.fgSecondary} />
               <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('profile.name')}</AppText>
            </View>
            <TextInput 
              style={[styles.input, { color: G.fg, borderColor: G.border }]} 
              value={name} 
              onChangeText={setName}
              placeholder={t('settings.name_placeholder')}
              placeholderTextColor={G.fgSecondary}
              onFocus={() => Haptics.selectionAsync()}
            />
          </View>

          <View style={styles.inputNode}>
            <View style={styles.nodeHeader}>
               <Building2 size={14} color={G.fgSecondary} />
               <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('profile.business')}</AppText>
            </View>
            <TextInput 
              style={[styles.input, { color: G.fg, borderColor: G.border }]} 
              value={businessName} 
              onChangeText={setBusinessName}
              placeholder={t('settings.business_placeholder')}
              placeholderTextColor={G.fgSecondary}
              onFocus={() => Haptics.selectionAsync()}
            />
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.saveButton, { backgroundColor: G.fg }]} 
          onPress={handleSave}
          activeOpacity={0.8}
        >
          <ShieldCheck size={20} color={G.bg} />
          <AppText variant="body" weight="bold" style={[styles.saveButtonText, { color: G.bg }]} numberOfLines={1}>{t('common.save')}</AppText>
        </TouchableOpacity>
        
        <AppText variant="caption" weight="medium" style={[styles.footerText, { color: G.fgSecondary }]} numberOfLines={3}>{t('settings.profile_footer')}</AppText>
      </Animated.View>

      {/* Account section */}
      <Animated.View entering={FadeInDown.delay(700)} style={styles.formContainer}>
        <View style={[styles.formCard, { backgroundColor: G.bgCard, borderColor: G.border }]}>
          <AppText variant="caption" weight="bold" style={[styles.formLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('account.account_info').toUpperCase()}</AppText>

          {isLoggedIn && accountUser ? (
            <>
              <View style={styles.accountRow}>
                <User size={14} color={G.fgSecondary} />
                <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('profile.name')}</AppText>
                <AppText variant="body" weight="bold" style={[styles.accountValue, { color: G.fg }]} numberOfLines={2}>{accountUser.name}</AppText>
              </View>
              <View style={styles.accountRow}>
                <Mail size={14} color={G.fgSecondary} />
                <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('account.email')}</AppText>
                <AppText variant="body" weight="bold" style={[styles.accountValue, { color: G.fg }]} numberOfLines={1}>{accountUser.email}</AppText>
              </View>
              {accountUser.business_name ? (
                <View style={styles.accountRow}>
                  <Building2 size={14} color={G.fgSecondary} />
                  <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('profile.business')}</AppText>
                  <AppText variant="body" weight="bold" style={[styles.accountValue, { color: G.fg }]} numberOfLines={1}>{accountUser.business_name}</AppText>
                </View>
              ) : null}

              <View style={[styles.divider, { borderColor: G.border }]} />

              <View style={styles.accountRow}>
                <Crown size={14} color={colors.primary} />
                <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('account.plan')}</AppText>
                <AppText variant="body" weight="bold" style={[styles.accountValue, { color: G.fg }]} numberOfLines={1}>{planLabel(subscription, t)}</AppText>
              </View>
              <View style={styles.accountRow}>
                <BadgeCheck size={14} color={colors.primary} />
                <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('account.status')}</AppText>
                <View style={[styles.statusPill, { backgroundColor: statusColor(subscription, colors) + '18' }]}>
                  <AppText variant="caption" weight="bold" style={{ color: statusColor(subscription, colors) }} numberOfLines={1}>
                    {statusLabel(subscription, t)}
                  </AppText>
                </View>
              </View>
              {subscription?.expires_at ? (
                <View style={styles.accountRow}>
                  <RefreshCw size={14} color={G.fgSecondary} />
                  <AppText variant="caption" weight="bold" style={[styles.nodeLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('account.expiry')}</AppText>
                  <AppText variant="body" weight="bold" style={[styles.accountValue, { color: G.fg }]} numberOfLines={1}>
                    {formatDate(subscription.expires_at)}
                  </AppText>
                </View>
              ) : null}

              <TouchableOpacity onPress={() => router.replace('/subscription/plans')} style={styles.accountLink} activeOpacity={0.7}>
                <Crown size={18} color={colors.primary} />
                <AppText variant="body" weight="bold" style={{ color: colors.primary, flex: 1 }}>{t('account.manage_plan')}</AppText>
                <ChevronRight size={18} color={G.fgSecondary} />
              </TouchableOpacity>

              <TouchableOpacity onPress={() => { logout(); }} style={[styles.logoutButton, { borderColor: colors.error }]} activeOpacity={0.8}>
                <LogOut size={18} color={colors.error} />
                <AppText variant="body" weight="bold" style={{ color: colors.error }}>{t('account.logout')}</AppText>
              </TouchableOpacity>
            </>
          ) : (
            <AppText variant="body" weight="medium" style={[styles.emptyAccount, { color: G.fgSecondary }]} numberOfLines={2}>
              {t('account.no_subscription')}
            </AppText>
          )}
        </View>
      </Animated.View>

      <View style={{ height: 60 }} />
      </ScrollView>
      </KeyboardAvoidingView>
      <View style={{ position: 'absolute', top: 50, right: 20, zIndex: 100 }}>
      </View>
    </View>
  );
};

function planLabel(s: SubscriptionStatusInfo | null, t: (k: string, p?: any) => string): string {
  if (!s || !s.status || s.status === 'none') return t('subscription.plan_none');
  return s.plan_name || s.plan || t('subscription.plan_premium');
}

function statusLabel(s: SubscriptionStatusInfo | null, t: (k: string, p?: any) => string): string {
  if (!s || !s.status || s.status === 'none') return t('subscription.plan_none');
  switch (s.status) {
    case 'active': return t('subscription.active');
    case 'pending': return t('subscription.pending');
    case 'rejected': return t('subscription.rejected');
    case 'expired': return t('subscription.expired');
    default: return s.status;
  }
}

function statusColor(s: SubscriptionStatusInfo | null, colors: any): string {
  if (!s) return colors.textSecondary ?? '#999999';
  switch (s.status) {
    case 'active': return colors.success ?? '#22C55E';
    case 'pending': return colors.warning ?? '#F59E0B';
    case 'rejected': return colors.danger ?? '#EF4444';
    case 'expired': return colors.danger ?? '#EF4444';
    default: return colors.textSecondary ?? '#999999';
  }
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  bannerContainer: { width: '100%', alignItems: 'center', paddingTop: 20, paddingBottom: 25, position: 'relative' },
  bannerWash: { position: 'absolute', top: 0, left: 0, right: 0, height: 200, borderBottomLeftRadius: 50, borderBottomRightRadius: 50 },
  avatarWrapper: { position: 'relative', marginBottom: 15 },
  mainAvatar: { width: 130, height: 130, borderRadius: 65, borderWidth: 4 },
  verifiedBadge: { position: 'absolute', top: 5, right: 5, width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
  pencilIcon: { position: 'absolute', bottom: 5, right: 5, width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
  profileTitle: { fontSize: 24, fontFamily: Fonts.bold, letterSpacing: -0.5 },
  profileSub: { fontSize: 13, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, marginBottom: 15 },
  sectionSubtitle: { fontSize: 12, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1 },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 15, marginBottom: 35 },
  smallAvatarWrapper: { position: 'relative', width: 64, height: 64, borderRadius: 32, padding: 3, borderWidth: 2, borderColor: 'transparent' },
  selectedAvatarWrapper: { },
  smallAvatar: { width: '100%', height: '100%', borderRadius: 30 },
  checkBadge: { position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#FFF' },
  formContainer: { width: '100%' },
  formCard: { width: '100%', borderWidth: 1, borderRadius: 32, padding: 25, overflow: 'hidden' },
  formLabel: { fontSize: 11, fontFamily: Fonts.bold, letterSpacing: 1.5, marginBottom: 25 },
  inputNode: { marginBottom: 25 },
  nodeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, paddingLeft: 5 },
  nodeLabel: { fontSize: 12, fontFamily: Fonts.bold, textTransform: 'uppercase' },
  input: { height: 60, borderWidth: 1, borderRadius: 18, paddingHorizontal: 20, fontSize: 16, fontFamily: Fonts.medium },
  saveButton: { width: '100%', height: 65, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 30 },
  saveButtonText: { fontSize: 16, fontFamily: Fonts.bold },
  footerText: { textAlign: 'center', marginTop: 25, fontSize: 11, fontFamily: Fonts.medium, opacity: 0.6 },
  glowWash: { position: 'absolute' },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  accountValue: { flex: 1, textAlign: 'right', fontSize: 14 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, marginVertical: 18 },
  statusPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  accountLink: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'transparent' },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 20, borderWidth: 1, marginTop: 30 },
  emptyAccount: { textAlign: 'center', paddingVertical: 12 },
});

export default EditProfileScreen;