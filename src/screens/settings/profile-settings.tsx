import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  Check,
  ShieldCheck,
  Camera,
  User,
  Building2,
  BadgeCheck,
  Sparkles
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
const EditProfileScreen = () => {
  const { userProfile, setUserProfile, t, colors } = useSettings();
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
      <ScrollView 
        contentContainerStyle={styles.container} 
        showsVerticalScrollIndicator={false}
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
      
      <View style={{ height: 60 }} />
    </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  bannerContainer: { width: '100%', alignItems: 'center', paddingVertical: 50, position: 'relative' },
  bannerWash: { position: 'absolute', top: 0, left: 0, right: 0, height: 200, borderBottomLeftRadius: 50, borderBottomRightRadius: 50 },
  avatarWrapper: { position: 'relative', marginBottom: 15 },
  mainAvatar: { width: 130, height: 130, borderRadius: 65, borderWidth: 4 },
  verifiedBadge: { position: 'absolute', top: 5, right: 5, width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
  pencilIcon: { position: 'absolute', bottom: 5, right: 5, width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
  profileTitle: { fontSize: 24, fontFamily: Fonts.bold, letterSpacing: -0.5 },
  profileSub: { fontSize: 13, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, marginBottom: 15 },
  sectionSubtitle: { fontSize: 12, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1 },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 15, paddingHorizontal: 30, marginBottom: 35 },
  smallAvatarWrapper: { position: 'relative', width: 64, height: 64, borderRadius: 32, padding: 3, borderWidth: 2, borderColor: 'transparent' },
  selectedAvatarWrapper: { },
  smallAvatar: { width: '100%', height: '100%', borderRadius: 30 },
  checkBadge: { position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#FFF' },
  formContainer: { width: '100%', paddingHorizontal: 25 },
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
});

export default EditProfileScreen;