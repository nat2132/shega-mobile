import { AppText } from '@/components/ui';
import { Image } from 'expo-image';
import { ArrowRight, Check, Globe } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSettings } from '@/context/SettingsContext';

interface FirstLanguageProps {
  onContinue: () => void;
}

const FirstLanguageScreen: React.FC<FirstLanguageProps> = ({ onContinue }) => {
  const { colors, t, setLanguage, language } = useSettings();
  const G = {
    bg: colors.background,
    fg: colors.text,
    muted: colors.textSecondary,
    border: colors.border,
    card: colors.card,
    surface: colors.surface,
  };

  const LANGUAGES = [
    { id: 'en', label: t('onboarding.lang_en'), sub: t('onboarding.lang_en_sub') },
    { id: 'am', label: t('onboarding.lang_am'), sub: t('onboarding.lang_am') },
    { id: 'om', label: t('onboarding.lang_om'), sub: t('onboarding.lang_om') },
    { id: 'ti', label: t('onboarding.lang_ti'), sub: t('onboarding.lang_ti') },
  ] as const;

  const current = LANGUAGES.find((l) => l.id === language);

  return (
    <View style={[styles.container, { backgroundColor: G.bg }]}>
      <Animated.View entering={FadeInDown.duration(700).springify().damping(20)} style={styles.header}>
        <View style={styles.logoRow}>
          <View style={[styles.logoInner, { backgroundColor: G.surface, borderColor: G.border }]}>
            <Image source={require('../../assets/images/logo.svg')} style={styles.logo} contentFit="contain" />
          </View>
        </View>
        <AppText variant="display" weight="bold" numberOfLines={1} align="center" style={{ color: G.fg, marginBottom: 8 }}>
          {t('onboarding.welcome_title')}
        </AppText>
        <AppText variant="body-lg" weight="medium" numberOfLines={2} align="center" style={{ color: G.muted, lineHeight: 22 }}>
          {t('onboarding.choose_language')}
        </AppText>
      </Animated.View>

      <View style={styles.list}>
        {LANGUAGES.map((lang, index) => (
          <Animated.View key={lang.id} entering={FadeInDown.delay(150 + index * 100).duration(500)}>
            <TouchableOpacity
              style={[styles.langNode, { backgroundColor: G.card, borderColor: G.border }]}
              onPress={() => setLanguage(lang.id)}
              activeOpacity={0.8}
            >
              <View style={[styles.langIcon, { backgroundColor: colors.primary + '10' }]}>
                <Globe size={20} color={colors.primary} />
              </View>
              <View style={styles.langInfo}>
                <AppText variant="body" weight="bold" numberOfLines={1} style={{ color: G.fg }}>{lang.label}</AppText>
                <AppText variant="caption" weight="medium" numberOfLines={1} style={{ color: G.muted }}>{lang.sub}</AppText>
              </View>
              <View style={[styles.checkBase, { borderColor: G.border }]}>
                {lang.id === current?.id && (
                  <View style={[styles.checkFill, { backgroundColor: colors.primary }]}>
                    <Check size={12} color="#FFF" strokeWidth={4} />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.continueBtn, { backgroundColor: colors.primary }]}
        onPress={onContinue}
        activeOpacity={0.85}
      >
        <AppText variant="heading" weight="bold" style={{ color: '#FFF' }}>{t('onboarding.continue')}</AppText>
        <ArrowRight size={22} color="#FFF" strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 28, paddingTop: 72, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 40 },
  logoRow: { marginBottom: 24 },
  logoInner: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  logo: { width: '60%', height: '60%' },
  list: { gap: 12 },
  langNode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  langIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  langInfo: { flex: 1, gap: 2 },
  checkBase: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkFill: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 60,
    borderRadius: 20,
    marginTop: 40,
    elevation: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});

export default FirstLanguageScreen;