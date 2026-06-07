import React, { useState } from 'react';
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
import { User, Briefcase, Camera, ChevronRight, Sparkles, Globe, Palette, Calendar, ChevronLeft, Check } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, Layout, FadeOut } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
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
  const [step, setStep] = useState(0); // 0: Identity, 1: Preferences
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ fullName?: string; businessName?: string }>({});
  const [touched, setTouched] = useState<{ fullName?: boolean; businessName?: boolean }>({});

  const THEMES: { id: any; color: string; name: string }[] = [
    { id: 'light', color: '#FFFFFF', name: 'Light' },
    { id: 'dark', color: '#1C1C1E', name: 'Dark' },
    { id: 'midnight', color: '#0F172A', name: 'Midnight' },
    { id: 'emerald', color: '#064E3B', name: 'Emerald' },
    { id: 'charcoal', color: '#171717', name: 'Charcoal' },
    { id: 'slate', color: '#1E293B', name: 'Slate' },
    { id: 'cocoa', color: '#2D2424', name: 'Cocoa' },
  ];

  const LANGUAGES = [
    { id: 'en', title: 'English', sub: 'System Default' },
    { id: 'am', title: 'አማርኛ', sub: 'Amharic' },
    { id: 'om', title: 'Afaan Oromo', sub: 'Oromo' },
    { id: 'ti', title: 'ትግርኛ', sub: 'Tigrinya' },
  ];

  const handleContinue = async () => {
    if (step === 0) {
      const newErrors: { fullName?: string; businessName?: string } = {};
      if (!fullName.trim()) {
        newErrors.fullName = 'Full name is required';
      } else if (fullName.trim().length < 2) {
        newErrors.fullName = 'Name must be at least 2 characters';
      } else if (fullName.trim().length > 100) {
        newErrors.fullName = 'Name is too long';
      }
      if (!businessName.trim()) {
        newErrors.businessName = 'Business entity is required';
      } else if (businessName.trim().length > 100) {
        newErrors.businessName = 'Business name is too long';
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
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
              <AppText style={[styles.title, { color: colors.text }]} variant="display" weight="bold" numberOfLines={2}>Establish Identity</AppText>
              <AppText style={[styles.subtitle, { color: colors.textSecondary }]} variant="body" weight="medium" numberOfLines={3}>
                Define your curatorial signature for the system vault and secure ledger.
              </AppText>
            </View>

            {/* Identity Avatar Node */}
            <View style={styles.avatarOrchestration}>
              <View style={styles.mainAvatarBox}>
                <View style={[styles.avatarRing, { borderColor: colors.border }]}>
                  <Image 
                    source={PROFILE_IMAGES[selectedAvatar]} 
                    style={styles.mainProfileImage}
                  />
                  <View style={[styles.sparkleBadge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
                     <Sparkles size={14} color="#FFF" />
                  </View>
                </View>
                <AppText style={[styles.avatarMeta, { color: colors.text }]} variant="caption" weight="bold" transform="uppercase" numberOfLines={1}>SELECTED CURATOR ID</AppText>
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
                      onPress={() => setSelectedAvatar(index)}
                      style={[
                        styles.libraryThumbnail,
                        { borderColor: colors.border },
                        isActive && { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
                      ]}
                      activeOpacity={0.8}
                    >
                      <Image source={source} style={styles.thumbnailImage} />
                      {isActive && (
                        <View style={[styles.activeOverlay, { backgroundColor: colors.primary }]}>
                           <Check size={12} color="#FFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Entry Nodes */}
            <View style={styles.formNodes}>
              <View style={[styles.inputNode, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.inputIcon, { backgroundColor: colors.background }]}>
                   <User size={18} color={colors.text} />
                </View>
                <View style={styles.inputTextContainer}>
                   <AppText style={[styles.inputTag, { color: colors.textSecondary }]} variant="caption" weight="bold" transform="uppercase" numberOfLines={1}>FULL NAME</AppText>
                   <TextInput
                     style={[styles.textInputNode, { color: colors.text }]}
                     placeholder={t('account.name_placeholder')}
                     placeholderTextColor={colors.textSecondary + '80'}
                     value={fullName}
                     onChangeText={(text) => {
                       setFullName(text);
                       if (touched.fullName) {
                         setErrors(prev => ({
                           ...prev,
                           fullName: text.trim().length < 2 && text.trim().length > 0 ? 'Name must be at least 2 characters' : undefined
                         }));
                       }
                     }}
                     onBlur={() => {
                       setTouched(prev => ({ ...prev, fullName: true }));
                       if (!fullName.trim()) {
                         setErrors(prev => ({ ...prev, fullName: 'Full name is required' }));
                       } else if (fullName.trim().length < 2) {
                         setErrors(prev => ({ ...prev, fullName: 'Name must be at least 2 characters' }));
                       } else {
                         setErrors(prev => ({ ...prev, fullName: undefined }));
                       }
                     }}
                     maxLength={100}
                     selectionColor={colors.primary}
                     autoCapitalize="words"
                   />
                </View>
                {errors.fullName && touched.fullName && (
                  <AppText style={[styles.errorText, { color: '#FF3B30' }]} variant="body-sm" weight="semibold" numberOfLines={2}>{errors.fullName}</AppText>
                )}
              </View>

              <View style={[styles.inputNode, { backgroundColor: colors.card, borderColor: colors.border }, (touched.businessName && errors.businessName) && { borderColor: '#FF3B30' }]}>
                 <View style={[styles.inputIcon, { backgroundColor: colors.background }]}>
                    <Briefcase size={18} color={colors.text} />
                 </View>
                 <View style={styles.inputTextContainer}>
                    <AppText style={[styles.inputTag, { color: colors.textSecondary }]} variant="caption" weight="bold" transform="uppercase" numberOfLines={1}>BUSINESS ENTITY</AppText>
                    <TextInput
                      style={[styles.textInputNode, { color: colors.text }]}
                      placeholder={t('account.business_placeholder')}
                      placeholderTextColor={colors.textSecondary + '80'}
                      value={businessName}
                       onChangeText={(text) => {
                         setBusinessName(text);
                       }}
                      onBlur={() => {
                        setTouched(prev => ({ ...prev, businessName: true }));
                        if (!businessName.trim()) {
                          setErrors(prev => ({ ...prev, businessName: 'Business entity is required' }));
                        } else {
                          setErrors(prev => ({ ...prev, businessName: undefined }));
                        }
                      }}
                      maxLength={100}
                      selectionColor={colors.primary}
                      autoCapitalize="words"
                    />
                 </View>
              </View>
              {errors.businessName && touched.businessName && (
                <AppText style={[styles.errorText, { color: '#FF3B30' }]} variant="body-sm" weight="semibold" numberOfLines={2}>{errors.businessName}</AppText>
              )}
            </View>

            {/* Action Node */}
            <View style={styles.actionNode}>
              <TouchableOpacity 
                style={[styles.primaryActionBtn, { backgroundColor: colors.text }, ((!fullName.trim() || !businessName.trim()) || loading) && { opacity: 0.6 }]} 
                activeOpacity={0.8} 
                onPress={handleContinue}
                disabled={!fullName.trim() || !businessName.trim() || loading}
              >
                <AppText style={[styles.actionBtnText, { color: colors.background }]} variant="body" weight="bold" numberOfLines={1}>CONTINUE TO PREFERENCES</AppText>
                <ChevronRight size={20} color={colors.background} />
              </TouchableOpacity>
              <AppText style={[styles.securitySub, { color: colors.textSecondary }]} variant="caption" weight="bold" transform="uppercase" numberOfLines={1}>SECURE AES-256 ENCRYPTED STORAGE</AppText>
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.duration(600)} exiting={FadeOut}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(0)}>
               <ChevronLeft size={24} color={colors.text} />
               <AppText style={[styles.backText, { color: colors.text }]} variant="body" weight="semibold" numberOfLines={1}>Identity</AppText>
            </TouchableOpacity>

            <View style={styles.headerNode}>
              <AppText style={[styles.title, { color: colors.text }]} variant="display" weight="bold" numberOfLines={2}>Define Environment</AppText>
              <AppText style={[styles.subtitle, { color: colors.textSecondary }]} variant="body" weight="medium" numberOfLines={3}>
                Calibrate your system with the appropriate linguistic schema, visual palette, and temporal system.
              </AppText>
            </View>

            {/* Preferences Sections */}
            <View style={styles.preferencesWrapper}>
               {/* Language */}
               <View style={styles.prefSection}>
                  <View style={styles.prefHeader}>
                    <Globe size={18} color={colors.primary} />
                    <AppText style={[styles.prefTitle, { color: colors.text }]} variant="title" weight="bold" numberOfLines={2}>Linguistic Schema</AppText>
                  </View>
                  <View style={styles.langGrid}>
                    {LANGUAGES.map((lang) => (
                      <TouchableOpacity 
                        key={lang.id} 
                        onPress={() => setLanguage(lang.id as any)}
                        style={[
                          styles.langCard, 
                          { backgroundColor: colors.card, borderColor: colors.border },
                          language === lang.id && { borderColor: colors.primary, borderWidth: 2 }
                        ]}
                      >
                         <AppText style={[styles.langText, { color: colors.text }]} variant="body" weight="bold" numberOfLines={1}>{lang.title}</AppText>
                         <AppText style={[styles.langSub, { color: colors.textSecondary }]} variant="body-sm" weight="medium" numberOfLines={2}>{lang.sub}</AppText>
                      </TouchableOpacity>
                    ))}
                  </View>
               </View>

               {/* Theme */}
               <View style={styles.prefSection}>
                  <View style={styles.prefHeader}>
                    <Palette size={18} color={colors.primary} />
                    <AppText style={[styles.prefTitle, { color: colors.text }]} variant="title" weight="bold" numberOfLines={2}>Visual Palette</AppText>
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
                           { backgroundColor: themeOption.color, borderColor: colors.border },
                           theme === themeOption.id && { borderColor: colors.primary, borderWidth: 3 }
                         ]} />
                         <AppText style={[styles.themeLabel, { color: colors.text }]} variant="body" weight="bold" numberOfLines={1}>{themeOption.name}</AppText>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
               </View>

               {/* Calendar */}
               <View style={styles.prefSection}>
                  <View style={styles.prefHeader}>
                    <Calendar size={18} color={colors.primary} />
                    <AppText style={[styles.prefTitle, { color: colors.text }]} variant="title" weight="bold" numberOfLines={2}>Temporal Logic</AppText>
                  </View>
                  <View style={[styles.calendarToggle, { backgroundColor: colors.card, borderColor: colors.border }]}>
                     <TouchableOpacity 
                       style={[styles.calBtn, calendarType === 'ethiopian' && { backgroundColor: colors.primary }]}
                       onPress={() => setCalendarType('ethiopian')}
                     >
                        <AppText style={[styles.calBtnText, { color: calendarType === 'ethiopian' ? '#FFF' : colors.text }]} variant="body" weight="bold" numberOfLines={1}>Ethiopian</AppText>
                     </TouchableOpacity>
                     <TouchableOpacity 
                       style={[styles.calBtn, calendarType === 'gregorian' && { backgroundColor: colors.primary }]}
                       onPress={() => setCalendarType('gregorian')}
                     >
                        <AppText style={[styles.calBtnText, { color: calendarType === 'gregorian' ? '#FFF' : colors.text }]} variant="body" weight="bold" numberOfLines={1}>Gregorian</AppText>
                     </TouchableOpacity>
                  </View>
               </View>
            </View>

            {/* Final Action Node */}
            <View style={styles.actionNode}>
              <TouchableOpacity 
                style={[styles.primaryActionBtn, { backgroundColor: colors.text }, loading && { opacity: 0.6 }]} 
                activeOpacity={0.8} 
                onPress={handleContinue}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <>
                    <AppText style={[styles.actionBtnText, { color: colors.background }]} variant="body" weight="bold" numberOfLines={1}>ESTABLISH LEDGER</AppText>
                    <ChevronRight size={20} color={colors.background} />
                  </>
                )}
              </TouchableOpacity>
              <AppText style={[styles.securitySub, { color: colors.textSecondary }]} variant="caption" weight="bold" transform="uppercase" numberOfLines={1}>INITIATING SECURE ENCRYPTED ENVIRONMENT</AppText>
            </View>
          </Animated.View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    color: '#000',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    color: '#666',
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
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  mainProfileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  sparkleBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#000',
    borderWidth: 4,
    borderColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarMeta: {
    fontFamily: Fonts.bold,
    letterSpacing: 1.5,
    color: '#000',
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
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderWidth: 1.5,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  activeThumbnail: {
    borderColor: '#000',
    backgroundColor: 'rgba(0,0,0,0.01)',
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
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  formNodes: {
    marginBottom: 40,
  },
  inputNode: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginBottom: 16,
  },
  inputIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFF',
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
    color: '#888',
    marginBottom: 4,
  },
  textInputNode: {
    fontFamily: Fonts.semibold,
    color: '#000',
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
    backgroundColor: '#000',
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
    borderColor: '#FF3B30',
    borderWidth: 1.5,
  },
  actionBtnText: {
    color: '#FFF',
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
});

export default ProfileSetupScreen;