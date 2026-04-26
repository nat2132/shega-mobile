import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  Platform
} from 'react-native';
import { 
  Pencil, 
  Check, 
  ShieldCheck, 
  Camera, 
  User, 
  Building2, 
  BadgeCheck,
  ChevronRight,
  Sparkles
} from 'lucide-react-native';
import Animated, { 
  FadeInDown, 
  FadeIn,
  FadeInRight,
  ScaleInCenter
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Fonts } from '@/constants/theme';
import { useSettings, PROFILE_IMAGES } from '@/context/SettingsContext';

const EditProfileScreen = () => {
  const { userProfile, setUserProfile, t, colors, theme } = useSettings();
  const [name, setName] = useState(userProfile.name);
  const [businessName, setBusinessName] = useState(userProfile.businessName);
  const [selectedAvatar, setSelectedAvatar] = useState(userProfile.avatarIndex);

  const handleSave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setUserProfile({
      name,
      businessName,
      avatarIndex: selectedAvatar,
    });
    Alert.alert(t('common.success'), t('profile.updated_success'));
  };

  const handleSelectAvatar = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedAvatar(index);
  };

  return (
    <ScrollView 
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container} 
      showsVerticalScrollIndicator={false}
    >
      {/* Elite Profile Banner */}
      <View style={styles.bannerContainer}>
        <View style={[styles.bannerWash, { backgroundColor: colors.text + '05' }]} />
        <Animated.View entering={ScaleInCenter} style={styles.avatarWrapper}>
           <Image 
             source={PROFILE_IMAGES[selectedAvatar]} 
             style={[styles.mainAvatar, { borderColor: colors.background }]} 
           />
           <View style={[styles.verifiedBadge, { backgroundColor: colors.primary }]}>
             <BadgeCheck size={18} color={colors.background} />
           </View>
           <TouchableOpacity 
             style={[styles.pencilIcon, { backgroundColor: colors.text }]}
             onPress={() => Haptics.selectionAsync()}
           >
             <Camera size={16} color={colors.background} />
           </TouchableOpacity>
        </Animated.View>
        <Text style={[styles.profileTitle, { color: colors.text }]}>{userProfile.businessName || 'Elite User'}</Text>
        <Text style={[styles.profileSub, { color: colors.textSecondary }]}>Verified Identity</Text>
      </View>

      <Animated.View entering={FadeInDown.delay(200)} style={styles.sectionHeader}>
        <Sparkles size={16} color={colors.primary} />
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>{t('settings.choose_avatar')}</Text>
      </Animated.View>

      <View style={styles.avatarGrid}>
        {PROFILE_IMAGES.map((img, i) => (
          <Animated.View key={i} entering={FadeInDown.delay(300 + i * 50)}>
            <TouchableOpacity 
              onPress={() => handleSelectAvatar(i)}
              style={[
                styles.smallAvatarWrapper, 
                selectedAvatar === i && [styles.selectedAvatarWrapper, { borderColor: colors.primary }]
              ]}
            >
              <Image source={img} style={styles.smallAvatar} />
              {selectedAvatar === i && (
                <View style={[styles.checkBadge, { backgroundColor: colors.primary }]}>
                  <Check size={8} color={colors.background} strokeWidth={4} />
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>

      {/* Verification Nodes */}
      <Animated.View entering={FadeInDown.delay(600)} style={styles.formContainer}>
        <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.formLabel, { color: colors.textSecondary }]}>{t('settings.personal_info').toUpperCase()}</Text>
          
          <View style={styles.inputNode}>
            <View style={styles.nodeHeader}>
               <User size={14} color={colors.textSecondary} />
               <Text style={[styles.nodeLabel, { color: colors.textSecondary }]}>{t('profile.name')}</Text>
            </View>
            <TextInput 
              style={[styles.input, { color: colors.text, borderColor: colors.border }]} 
              value={name} 
              onChangeText={setName}
              placeholder={t('settings.name_placeholder')}
              placeholderTextColor={colors.textSecondary}
              onFocus={() => Haptics.selectionAsync()}
            />
          </View>

          <View style={styles.inputNode}>
            <View style={styles.nodeHeader}>
               <Building2 size={14} color={colors.textSecondary} />
               <Text style={[styles.nodeLabel, { color: colors.textSecondary }]}>{t('profile.business')}</Text>
            </View>
            <TextInput 
              style={[styles.input, { color: colors.text, borderColor: colors.border }]} 
              value={businessName} 
              onChangeText={setBusinessName}
              placeholder={t('settings.business_placeholder')}
              placeholderTextColor={colors.textSecondary}
              onFocus={() => Haptics.selectionAsync()}
            />
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.saveButton, { backgroundColor: colors.text }]} 
          onPress={handleSave}
          activeOpacity={0.8}
        >
          <ShieldCheck size={20} color={colors.background} />
          <Text style={[styles.saveButtonText, { color: colors.background }]}>{t('common.save')}</Text>
        </TouchableOpacity>
        
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>{t('settings.profile_footer')}</Text>
      </Animated.View>
      
      <View style={{ height: 60 }} />
    </ScrollView>
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
  formCard: { width: '100%', borderWidth: 1, borderRadius: 32, padding: 25 },
  formLabel: { fontSize: 11, fontFamily: Fonts.bold, letterSpacing: 1.5, marginBottom: 25 },
  inputNode: { marginBottom: 25 },
  nodeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, paddingLeft: 5 },
  nodeLabel: { fontSize: 12, fontFamily: Fonts.bold, textTransform: 'uppercase' },
  input: { height: 60, borderWidth: 1, borderRadius: 18, paddingHorizontal: 20, fontSize: 16, fontFamily: Fonts.medium },
  saveButton: { width: '100%', height: 65, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 30 },
  saveButtonText: { fontSize: 16, fontFamily: Fonts.bold },
  footerText: { textAlign: 'center', marginTop: 25, fontSize: 11, fontFamily: Fonts.medium, opacity: 0.6 }
});

export default EditProfileScreen;