import React, { useState } from 'react';
import { Fonts, Typography } from '@/constants/theme';
import {
  StyleSheet,
  Text as RNText,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Image,
  ActivityIndicator,
  Dimensions,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { User, Briefcase, Camera, ChevronRight, Sparkles, Globe, Palette, Calendar, ChevronLeft, Check } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, Layout, FadeOut } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSettings } from '@/context/SettingsContext';

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
      if (!businessName.trim()) return;
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
              <RNText style={[styles.title, { color: colors.text }]}>Establish Identity</RNText>
              <RNText style={[styles.subtitle, { color: colors.textSecondary }]}>
                Define your curatorial signature for the system vault and secure ledger.
              </RNText>
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
                <RNText style={[styles.avatarMeta, { color: colors.text }]}>SELECTED CURATOR ID</RNText>
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
                   <RNText style={[styles.inputTag, { color: colors.textSecondary }]}>FULL NAME</RNText>
                   <TextInput
                     style={[styles.textInputNode, { color: colors.text }]}
                     placeholder="e.g. Julian Voss"
                     placeholderTextColor={colors.textSecondary + '80'}
                     value={fullName}
                     onChangeText={setFullName}
                     selectionColor={colors.primary}
                   />
                </View>
              </View>

              <View style={[styles.inputNode, { backgroundColor: colors.card, borderColor: colors.border }]}>
                 <View style={[styles.inputIcon, { backgroundColor: colors.background }]}>
                    <Briefcase size={18} color={colors.text} />
                 </View>
                 <View style={styles.inputTextContainer}>
                    <RNText style={[styles.inputTag, { color: colors.textSecondary }]}>BUSINESS ENTITY</RNText>
                    <TextInput
                      style={[styles.textInputNode, { color: colors.text }]}
                      placeholder="e.g. Voss & Co. Curators"
                      placeholderTextColor={colors.textSecondary + '80'}
                      value={businessName}
                      onChangeText={setBusinessName}
                      selectionColor={colors.primary}
                    />
                 </View>
              </View>
            </View>

            {/* Action Node */}
            <View style={styles.actionNode}>
              <TouchableOpacity 
                style={[styles.primaryActionBtn, { backgroundColor: colors.text }, (!businessName.trim() || loading) && { opacity: 0.6 }]} 
                activeOpacity={0.8} 
                onPress={handleContinue}
                disabled={!businessName.trim() || loading}
              >
                <RNText style={[styles.actionBtnText, { color: colors.background }]}>CONTINUE TO PREFERENCES</RNText>
                <ChevronRight size={20} color={colors.background} />
              </TouchableOpacity>
              <RNText style={[styles.securitySub, { color: colors.textSecondary }]}>SECURE AES-256 ENCRYPTED STORAGE</RNText>
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.duration(600)} exiting={FadeOut}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(0)}>
               <ChevronLeft size={24} color={colors.text} />
               <RNText style={[styles.backText, { color: colors.text }]}>Identity</RNText>
            </TouchableOpacity>

            <View style={styles.headerNode}>
              <RNText style={[styles.title, { color: colors.text }]}>Define Environment</RNText>
              <RNText style={[styles.subtitle, { color: colors.textSecondary }]}>
                Calibrate your system with the appropriate linguistic schema, visual palette, and temporal system.
              </RNText>
            </View>

            {/* Preferences Sections */}
            <View style={styles.preferencesWrapper}>
               {/* Language */}
               <View style={styles.prefSection}>
                  <View style={styles.prefHeader}>
                    <Globe size={18} color={colors.primary} />
                    <RNText style={[styles.prefTitle, { color: colors.text }]}>Linguistic Schema</RNText>
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
                         <RNText style={[styles.langText, { color: colors.text }]}>{lang.title}</RNText>
                         <RNText style={[styles.langSub, { color: colors.textSecondary }]}>{lang.sub}</RNText>
                      </TouchableOpacity>
                    ))}
                  </View>
               </View>

               {/* Theme */}
               <View style={styles.prefSection}>
                  <View style={styles.prefHeader}>
                    <Palette size={18} color={colors.primary} />
                    <RNText style={[styles.prefTitle, { color: colors.text }]}>Visual Palette</RNText>
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
                         <RNText style={[styles.themeLabel, { color: colors.text }]}>{themeOption.name}</RNText>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
               </View>

               {/* Calendar */}
               <View style={styles.prefSection}>
                  <View style={styles.prefHeader}>
                    <Calendar size={18} color={colors.primary} />
                    <RNText style={[styles.prefTitle, { color: colors.text }]}>Temporal Logic</RNText>
                  </View>
                  <View style={[styles.calendarToggle, { backgroundColor: colors.card, borderColor: colors.border }]}>
                     <TouchableOpacity 
                       style={[styles.calBtn, calendarType === 'ethiopian' && { backgroundColor: colors.primary }]}
                       onPress={() => setCalendarType('ethiopian')}
                     >
                        <RNText style={[styles.calBtnText, { color: calendarType === 'ethiopian' ? '#FFF' : colors.text }]}>Ethiopian</RNText>
                     </TouchableOpacity>
                     <TouchableOpacity 
                       style={[styles.calBtn, calendarType === 'gregorian' && { backgroundColor: colors.primary }]}
                       onPress={() => setCalendarType('gregorian')}
                     >
                        <RNText style={[styles.calBtnText, { color: calendarType === 'gregorian' ? '#FFF' : colors.text }]}>Gregorian</RNText>
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
                    <RNText style={[styles.actionBtnText, { color: colors.background }]}>ESTABLISH LEDGER</RNText>
                    <ChevronRight size={20} color={colors.background} />
                  </>
                )}
              </TouchableOpacity>
              <RNText style={[styles.securitySub, { color: colors.textSecondary }]}>INITIATING SECURE ENCRYPTED ENVIRONMENT</RNText>
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
    fontSize: 34,
    fontFamily: Fonts.extrabold,
    fontWeight: '800',
    color: '#000',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
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
    fontSize: 10,
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
    fontSize: 9,
    fontFamily: Fonts.bold,
    letterSpacing: 0.8,
    color: '#888',
    marginBottom: 4,
  },
  textInputNode: {
    fontSize: 16,
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
  actionBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: Fonts.bold,
    letterSpacing: 1,
  },
  securitySub: {
    fontSize: 10,
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
    fontSize: 14,
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
    fontSize: 16,
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
    fontSize: 16,
    fontFamily: Fonts.bold,
  },
  langSub: {
    fontSize: 10,
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
    fontSize: 11,
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
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
});

export default ProfileSetupScreen;