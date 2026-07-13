import React, { useState, useMemo } from 'react';
import { Fonts } from '@/constants/theme';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Dimensions,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import { User, Briefcase, ChevronRight, Sparkles, Globe, Palette, Calendar, ChevronLeft, Check, Camera } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { getAccountGlass } from './glass-account';
import { useSettings } from '@/context/SettingsContext';
import { AppText } from '@/components/ui';
const { width } = Dimensions.get('window');

const PROFILE_IMAGES = [
  require('../../assets/images/profile/profile1.png'),
  require('../../assets/images/profile/profile2.png'),
  require('../../assets/images/profile/profile3.png'),
  require('../../assets/images/profile/profile4.png'),
  require('../../assets/images/profile/profile5.png'),
  require('../../assets/images/profile/profile6.png'),
  require('../../assets/images/profile/profile7.png'),
  require('../../assets/images/profile/profile8.png'),
  require('../../assets/images/profile/profile9.png'),
  require('../../assets/images/profile/profile10.png'),
];

const ProfileSetupScreen: React.FC<{ onComplete?: () => void }> = ({ onComplete }) => {
  const { language, setLanguage, theme, setTheme, calendarType, setCalendarType, colors, t, setUserProfile } = useSettings();
  const G = getAccountGlass(colors);
  const [step, setStep] = useState(0); // 0: Identity, 1: Preferences
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(0);
  const [customAvatarUri, setCustomAvatarUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ fullName?: string; businessName?: string }>({});
  const [touched, setTouched] = useState<{ fullName?: boolean; businessName?: boolean }>({});

  const THEMES: { id: any; color: string; name: string }[] = [
    { id: 'light', color: '#FFFFFF', name: t('theme.light') },
    { id: 'dark', color: '#1C1C1E', name: t('theme.dark') },
    { id: 'midnight', color: '#0F172A', name: t('theme.midnight') },
    { id: 'emerald', color: '#064E3B', name: t('theme.emerald') },
    { id: 'charcoal', color: '#171717', name: t('theme.charcoal') },
    { id: 'slate', color: '#1E293B', name: t('theme.slate') },
    { id: 'cocoa', color: '#2D2424', name: t('theme.cocoa') },
  ];

  const LANGUAGES = [
    { id: 'en', title: 'English', sub: 'System Default' },
    { id: 'am', title: 'አማርኛ', sub: t('language.amharic') },
    { id: 'om', title: 'Afaan Oromo', sub: t('language.oromo') },
    { id: 'ti', title: 'ትግርኛ', sub: t('language.tigrinya') },
  ];

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setCustomAvatarUri(result.assets[0].uri);
    }
  };

  const handleContinue = async () => {
    if (step === 0) {
      const newErrors: { fullName?: string; businessName?: string } = {};
      if (!fullName.trim()) {
        newErrors.fullName = t('account.name_required');
      } else if (fullName.trim().length < 2) {
        newErrors.fullName = t('account.name_min_length');
      } else if (fullName.trim().length > 100) {
        newErrors.fullName = t('account.name_too_long');
      }
      if (!businessName.trim()) {
        newErrors.businessName = t('account.business_required');
      } else if (businessName.trim().length > 100) {
        newErrors.businessName = t('account.business_too_long');
      }
      setTouched({ fullName: true, businessName: true });
      setErrors(newErrors);
      if (Object.keys(newErrors).length > 0) return;
      setStep(1);
      return;
    }
    
    setLoading(true);
    try {
      // Sync profile data to context and persistence
      await setUserProfile({
        name: fullName.trim(),
        businessName: businessName.trim(),
        avatarIndex: selectedAvatar,
        avatarUri: customAvatarUri || undefined,
      });
      
      // All other settings (theme, language, calendar) are already persisted 
      // via live calls in the UI buttons.
      
      await SecureStore.setItemAsync('user_setupComplete', 'true');
      onComplete?.();
    } catch (error) {
      console.error('[UserSetup] Failed to finalize setup:', error);
    } finally {
      setLoading(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: G.bg,
  },
  glowWash: {
    position: 'absolute',
    borderRadius: 200,
  },
  scrollContent: {
    paddingHorizontal: 25,
    paddingTop: 60,
    paddingBottom: 40,
  },
  headerNode: {
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontFamily: Fonts.extrabold,
    fontWeight: '800',
    color: G.fg,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    color: G.fgSecondary,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: Fonts.medium,
    paddingHorizontal: 15,
  },
  avatarOrchestration: {
    marginBottom: 40,
  },
  mainAvatarBox: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatarRing: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: G.bgCard,
    borderWidth: 1,
    borderColor: G.border,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  mainProfileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  cameraBtn: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarMeta: {
    fontFamily: Fonts.bold,
    letterSpacing: 1.5,
    color: G.fg,
    marginTop: 20,
  },
  avatarLibrary: {
    paddingHorizontal: 10,
    gap: 12,
  },
  avatarLibraryRow: {
    width: '100%',
  },
  libraryThumbnail: {
    width: 70,
    height: 70,
    borderRadius: 24,
    backgroundColor: G.bgCard,
    borderWidth: 1.5,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  activeThumbnail: {
    borderColor: G.fg,
    backgroundColor: G.bgCard,
  },
  thumbnailImage: {
    width: 50,
    height: 50,
    borderRadius: 18,
  },
  activeOverlay: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: G.fg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formNodes: {
    marginBottom: 40,
  },
  inputNode: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: G.bgCard,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: G.border,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginBottom: 16,
  },
  inputIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: G.fg,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputTextContainer: {
    flex: 1,
    marginLeft: 18,
  },
  inputTag: {
    fontFamily: Fonts.bold,
    letterSpacing: 0.8,
    color: G.fgSecondary,
    marginBottom: 4,
  },
  textInputNode: {
    fontFamily: Fonts.semibold,
    color: G.fg,
    height: 24,
    padding: 0,
  },
  actionNode: {
    alignItems: 'center',
  },
  primaryActionBtn: {
    flexDirection: 'row',
    width: '100%',
    height: 68,
    backgroundColor: G.fg,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    marginBottom: 20,
  },
  errorText: {
    fontFamily: Fonts.semibold,
    marginTop: -12,
    marginBottom: 16,
    marginLeft: 16,
    letterSpacing: 0.5,
  },
  inputNodeError: {
    borderColor: G.error,
    borderWidth: 1.5,
  },
  actionBtnText: {
    color: G.bg,
    fontFamily: Fonts.bold,
    letterSpacing: 1,
  },
  securitySub: {
    fontFamily: Fonts.bold,
    letterSpacing: 1.2,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    gap: 5,
  },
  backText: {
    fontFamily: Fonts.semibold,
  },
  preferencesWrapper: {
    marginBottom: 40,
  },
  prefSection: {
    marginBottom: 35,
  },
  prefHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  prefTitle: {
    fontFamily: Fonts.bold,
    letterSpacing: -0.5,
  },
  langGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  langCard: {
    width: (width - 62) / 2,
    padding: 15,
    borderRadius: 20,
    borderWidth: 1,
  },
  langText: {
    fontFamily: Fonts.bold,
  },
  langSub: {
    fontFamily: Fonts.medium,
    marginTop: 4,
    opacity: 0.7,
  },
  themeRow: {
    gap: 20,
    paddingRight: 20,
  },
  themeItem: {
    alignItems: 'center',
    gap: 8,
  },
  themeSwatch: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
  },
  themeLabel: {
    fontFamily: Fonts.bold,
  },
  calendarToggle: {
    flexDirection: 'row',
    borderRadius: 24,
    borderWidth: 1,
    padding: 6,
  },
  calBtn: {
    flex: 1,
    height: 48,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calBtnText: {
    fontFamily: Fonts.bold,
  },
}), [G]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: G.bg }]}>
      {/* Ambient Glass Glow */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[styles.glowWash, { top: -120, left: -60, width: 300, height: 300, opacity: 0.12 }]} />
        <View style={[styles.glowWash, { bottom: -80, right: -40, width: 250, height: 250, opacity: 0.08 }]} />
      </View>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {step === 0 ? (
          <Animated.View entering={FadeIn.duration(600)} exiting={FadeOut}>
            <View style={styles.headerNode}>
              <AppText style={[styles.title, { color: G.fg }]} variant="display" weight="bold" numberOfLines={2}>{t('account.establish_identity')}</AppText>
              <AppText style={[styles.subtitle, { color: G.fgSecondary }]} variant="body" weight="medium" numberOfLines={3}>
                {t('account.identity_subtitle')}
              </AppText>
            </View>

            {/* Identity Avatar Node */}
            <View style={styles.avatarOrchestration}>
              <View style={styles.mainAvatarBox}>
                <View style={[styles.avatarRing, { borderColor: G.border }]}>
                  {customAvatarUri ? (
                    <Image source={{ uri: customAvatarUri }} style={styles.mainProfileImage} />
                  ) : (
                    <Image source={PROFILE_IMAGES[selectedAvatar]} style={styles.mainProfileImage} />
                  )}
                  <TouchableOpacity style={[styles.cameraBtn, { backgroundColor: G.fg, borderColor: G.bg }]} onPress={handlePickImage} activeOpacity={0.8}>
                    <Camera size={14} color={G.bg} />
                  </TouchableOpacity>
                </View>
                <AppText style={[styles.avatarMeta, { color: G.fg }]} variant="caption" weight="bold" transform="uppercase" numberOfLines={1}>{t('account.selected_curator_id')}</AppText>
              </View>

              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={styles.avatarLibrary}
                style={styles.avatarLibraryRow}
              >
                {PROFILE_IMAGES.map((source, index) => {
                  const isActive = selectedAvatar === index;
                  return (
                    <TouchableOpacity
                      key={index}
                      onPress={() => { setSelectedAvatar(index); setCustomAvatarUri(null); }}
                      style={[
                        styles.libraryThumbnail,
                        { borderColor: G.border },
                        isActive && { borderColor: G.fg, backgroundColor: G.accentGlass },
                      ]}
                      activeOpacity={0.8}
                    >
                      <Image source={source} style={styles.thumbnailImage} />
                      {isActive && (
                        <View style={[styles.activeOverlay, { backgroundColor: G.fg }]}>
                           <Check size={12} color={G.bg} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Entry Nodes */}
            <View style={styles.formNodes}>
              <View style={[styles.inputNode, { backgroundColor: G.bgCard, borderColor: G.border }]}>
                <View style={[styles.inputIcon, { backgroundColor: G.bg }]}>
                   <User size={18} color={G.fg} />
                </View>
                <View style={styles.inputTextContainer}>
                   <AppText style={[styles.inputTag, { color: G.fgSecondary }]} variant="caption" weight="bold" transform="uppercase" numberOfLines={1}>{t('account.full_name_label')}</AppText>
                   <TextInput
                     style={[styles.textInputNode, { color: G.fg }]}
                     placeholder={t('account.name_placeholder')}
                     placeholderTextColor={G.fgSecondary + '80'}
                     value={fullName}
                     onChangeText={(text) => {
                       setFullName(text);
                       if (touched.fullName) {
                         setErrors(prev => ({
                           ...prev,
                           fullName: text.trim().length < 2 && text.trim().length > 0 ? t('account.name_min_length') : undefined
                         }));
                       }
                     }}
                     onBlur={() => {
                       setTouched(prev => ({ ...prev, fullName: true }));
                       if (!fullName.trim()) {
                          setErrors(prev => ({ ...prev, fullName: t('account.name_required') }));
                       } else if (fullName.trim().length < 2) {
                          setErrors(prev => ({ ...prev, fullName: t('account.name_min_length') }));
                       } else {
                         setErrors(prev => ({ ...prev, fullName: undefined }));
                       }
                     }}
                     maxLength={100}
                     selectionColor={G.fg}
                     autoCapitalize="words"
                   />
                </View>
                {errors.fullName && touched.fullName && (
                  <AppText style={[styles.errorText, { color: colors.error }]} variant="body-sm" weight="semibold" numberOfLines={2}>{errors.fullName}</AppText>
                )}
              </View>

              <View style={[styles.inputNode, { backgroundColor: G.bgCard, borderColor: G.border }, (touched.businessName && errors.businessName) && { borderColor: colors.error }]}>
                 <View style={[styles.inputIcon, { backgroundColor: G.bg }]}>
                    <Briefcase size={18} color={G.fg} />
                 </View>
                 <View style={styles.inputTextContainer}>
                     <AppText style={[styles.inputTag, { color: G.fgSecondary }]} variant="caption" weight="bold" transform="uppercase" numberOfLines={1}>{t('account.business_entity_label')}</AppText>
                    <TextInput
                      style={[styles.textInputNode, { color: G.fg }]}
                      placeholder={t('account.business_placeholder')}
                      placeholderTextColor={G.fgSecondary + '80'}
                      value={businessName}
                       onChangeText={(text) => {
                         setBusinessName(text);
                       }}
                      onBlur={() => {
                        setTouched(prev => ({ ...prev, businessName: true }));
                        if (!businessName.trim()) {
                          setErrors(prev => ({ ...prev, businessName: t('account.business_required') }));
                        } else {
                          setErrors(prev => ({ ...prev, businessName: undefined }));
                        }
                      }}
                      maxLength={100}
                      selectionColor={G.fg}
                      autoCapitalize="words"
                    />
                 </View>
              </View>
              {errors.businessName && touched.businessName && (
                <AppText style={[styles.errorText, { color: colors.error }]} variant="body-sm" weight="semibold" numberOfLines={2}>{errors.businessName}</AppText>
              )}
            </View>

            {/* Action Node */}
            <View style={styles.actionNode}>
              <TouchableOpacity 
                style={[styles.primaryActionBtn, { backgroundColor: G.fg }, ((!fullName.trim() || !businessName.trim()) || loading) && { opacity: 0.6 }]} 
                activeOpacity={0.8} 
                onPress={handleContinue}
                disabled={!fullName.trim() || !businessName.trim() || loading}
              >
                <AppText style={[styles.actionBtnText, { color: G.bg }]} variant="body" weight="bold" numberOfLines={1}>{t('account.continue_to_preferences')}</AppText>
                <ChevronRight size={20} color={G.bg} />
              </TouchableOpacity>
              <AppText style={[styles.securitySub, { color: G.fgSecondary }]} variant="caption" weight="bold" transform="uppercase" numberOfLines={1}>{t('account.secure_storage')}</AppText>
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.duration(600)} exiting={FadeOut}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(0)}>
               <ChevronLeft size={24} color={G.fg} />
               <AppText style={[styles.backText, { color: G.fg }]} variant="body" weight="semibold" numberOfLines={1}>{t('account.identity')}</AppText>
            </TouchableOpacity>

            <View style={styles.headerNode}>
              <AppText style={[styles.title, { color: G.fg }]} variant="display" weight="bold" numberOfLines={2}>{t('account.define_environment')}</AppText>
              <AppText style={[styles.subtitle, { color: G.fgSecondary }]} variant="body" weight="medium" numberOfLines={3}>
                {t('account.environment_subtitle')}
              </AppText>
            </View>

            {/* Preferences Sections */}
            <View style={styles.preferencesWrapper}>
               {/* Language */}
               <View style={styles.prefSection}>
                  <View style={styles.prefHeader}>
                    <Globe size={18} color={G.fg} />
                    <AppText style={[styles.prefTitle, { color: G.fg }]} variant="title" weight="bold" numberOfLines={2}>Linguistic Schema</AppText>
                  </View>
                  <View style={styles.langGrid}>
                    {LANGUAGES.map((lang) => (
                      <TouchableOpacity 
                        key={lang.id} 
                        onPress={() => setLanguage(lang.id as any)}
                        style={[
                          styles.langCard, 
                          { backgroundColor: G.bgCard, borderColor: G.border },
                          language === lang.id && { borderColor: G.fg, borderWidth: 2 }
                        ]}
                      >
                         <AppText style={[styles.langText, { color: G.fg }]} variant="body" weight="bold" numberOfLines={1}>{lang.title}</AppText>
                         <AppText style={[styles.langSub, { color: G.fgSecondary }]} variant="body-sm" weight="medium" numberOfLines={2}>{lang.sub}</AppText>
                      </TouchableOpacity>
                    ))}
                  </View>
               </View>

               {/* Theme */}
               <View style={styles.prefSection}>
                  <View style={styles.prefHeader}>
                    <Palette size={18} color={G.fg} />
                    <AppText style={[styles.prefTitle, { color: G.fg }]} variant="title" weight="bold" numberOfLines={2}>Visual Palette</AppText>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themeRow}>
                    {THEMES.map((themeOption) => (
                      <TouchableOpacity 
                        key={themeOption.id} 
                        onPress={() => setTheme(themeOption.id)}
                        style={styles.themeItem}
                      >
                         <View style={[
                           styles.themeSwatch, 
                           { backgroundColor: themeOption.color, borderColor: G.border },
                           theme === themeOption.id && { borderColor: G.fg, borderWidth: 3 }
                         ]} />
                         <AppText style={[styles.themeLabel, { color: G.fg }]} variant="body" weight="bold" numberOfLines={1}>{themeOption.name}</AppText>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
               </View>

               {/* Calendar */}
               <View style={styles.prefSection}>
                  <View style={styles.prefHeader}>
                    <Calendar size={18} color={G.fg} />
                     <AppText style={[styles.prefTitle, { color: G.fg }]} variant="title" weight="bold" numberOfLines={2}>{t('account.temporal_logic')}</AppText>
                  </View>
                  <View style={[styles.calendarToggle, { backgroundColor: G.bgCard, borderColor: G.border }]}>
                     <TouchableOpacity 
                       style={[styles.calBtn, calendarType === 'ethiopian' && { backgroundColor: G.fg }]}
                       onPress={() => setCalendarType('ethiopian')}
                     >
                        <AppText style={[styles.calBtnText, { color: calendarType === 'ethiopian' ? G.bg : G.fg }]} variant="body" weight="bold" numberOfLines={1}>Ethiopian</AppText>
                     </TouchableOpacity>
                     <TouchableOpacity 
                       style={[styles.calBtn, calendarType === 'gregorian' && { backgroundColor: G.fg }]}
                       onPress={() => setCalendarType('gregorian')}
                     >
                        <AppText style={[styles.calBtnText, { color: calendarType === 'gregorian' ? G.bg : G.fg }]} variant="body" weight="bold" numberOfLines={1}>Gregorian</AppText>
                     </TouchableOpacity>
                  </View>
               </View>
            </View>

            {/* Final Action Node */}
            <View style={styles.actionNode}>
              <TouchableOpacity 
                style={[styles.primaryActionBtn, { backgroundColor: G.fg }, loading && { opacity: 0.6 }]} 
                activeOpacity={0.8} 
                onPress={handleContinue}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={G.bg} />
                ) : (
                  <>
                    <AppText style={[styles.actionBtnText, { color: G.bg }]} variant="body" weight="bold" numberOfLines={1}>{t('account.establish_ledger')}</AppText>
                    <ChevronRight size={20} color={G.bg} />
                  </>
                )}
              </TouchableOpacity>
              <AppText style={[styles.securitySub, { color: G.fgSecondary }]} variant="caption" weight="bold" transform="uppercase" numberOfLines={1}>{t('account.initiating_secure')}</AppText>
            </View>
          </Animated.View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ProfileSetupScreen;