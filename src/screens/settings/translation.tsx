import React, { useMemo } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
} from 'react-native';
import { 
  Languages, 
  Check, 
  Globe, 
  Zap, 
  Sparkles 
} from 'lucide-react-native';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { AppText} from '@/components/ui';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { getSettingsGlass } from './glass-settings';
import { useTutorial, TutorialTarget, TutorialButton, TutorialScrollView } from '@/tutorials';
import { translationTutorial } from '@/tutorials/definitions';
type LangId = 'en' | 'am' | 'om' | 'ti';

const TranslationSettings = () => {
  const { language, setLanguage, colors, t } = useSettings();
  const LANGUAGES: { id: LangId; title: string; scriptKey: string; preview: string }[] = [
    { id: 'en', title: t('language.english'), scriptKey: 'settings.script_primary', preview: t('language.preview_inv') },
    { id: 'am', title: t('language.amharic'), scriptKey: 'settings.script_ethiopic', preview: t('language.preview_inv') },
    { id: 'om', title: t('language.oromo'), scriptKey: 'settings.script_latin', preview: t('language.preview_inv_om') },
    { id: 'ti', title: t('language.tigrinya'), scriptKey: 'settings.script_ethiopic', preview: t('language.preview_inv') },
  ];
  const G = getSettingsGlass(colors);
  const styles = useMemo(() => StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 25,
    paddingBottom: 40,
  },
  headerNode: {
    paddingTop: 40,
    paddingBottom: 25,
  },
  headerSub: {
    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: Fonts.bold,
  },
  previewBlueprint: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 22,
    marginBottom: 30,
    overflow: 'hidden',
  },
  blueprintHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  iconTag: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blueprintLabel: {
    fontFamily: Fonts.bold,
    letterSpacing: 1.2,
  },
  blueprintBody: {
    marginBottom: 20,
  },
  previewDisplay: {
    fontFamily: Fonts.bold,
    marginBottom: 8,
  },
  blueprintLine: {
    height: 4,
    width: 40,
    borderRadius: 2,
  },
  blueprintFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: G.border,
  },
  footerText: {
    fontFamily: Fonts.medium,
    fontStyle: 'italic',
  },
  selectionHeading: {
    fontFamily: Fonts.bold,
    letterSpacing: 1,
    marginBottom: 15,
  },
  langNode: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 12,
    gap: 16,
    overflow: 'hidden',
  },
  langIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  langInfoArea: {
    flex: 1,
  },
  langTitle: {
    fontFamily: Fonts.bold,
    marginBottom: 2,
  },
  langScript: {
    fontFamily: Fonts.medium,
    letterSpacing: 0.5,
  },
  radioBase: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoNode: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
    marginTop: 15,
    gap: 12,
    overflow: 'hidden',
  },
  noticeText: {
    flex: 1,
    lineHeight: 18,
    fontFamily: Fonts.medium,
  },
  glowWash: { position: 'absolute' },
}), [G]);

  const handleSelect = (id: LangId) => {
    setLanguage(id);
  };

  const currentPreview = LANGUAGES.find(l => l.id === language)?.preview ?? t('inventory.header');
  const tutorial = useTutorial({ tutorial: translationTutorial });

  return (
    <View style={[styles.container, { backgroundColor: G.bg }]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[styles.glowWash, { backgroundColor: G.mutedLight, top: -80, left: -60, width: 200, height: 200, borderRadius: 100 }]} />
        <View style={[styles.glowWash, { backgroundColor: G.mutedLight, bottom: -40, right: -30, width: 160, height: 160, borderRadius: 80 }]} />
        <View style={[styles.glowWash, { backgroundColor: G.mutedLight, top: '40%', right: -50, width: 140, height: 140, borderRadius: 70 }]} />
      </View>
      <TutorialScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Animated.View entering={FadeIn.duration(600)}>
          <TutorialTarget id="tr-header">
          <View style={styles.headerNode}>
            <AppText variant="body" weight="medium" style={[styles.headerSub, { color: G.fgSecondary }]} numberOfLines={2}>{t('translation.localization')}</AppText>
            <AppText variant="display" weight="bold" style={[styles.headerTitle, { color: G.fg }]} numberOfLines={2}>{t('translation.global_hub')}</AppText>
          </View>
          </TutorialTarget>

          {/* Intelligence Preview Node */}
          <TutorialTarget id="tr-current">
          <View style={[styles.previewBlueprint, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <View style={styles.blueprintHead}>
              <View style={[styles.iconTag, { backgroundColor: G.fg + '08' }]}>
                 <Languages size={22} color={G.fg} />
              </View>
              <AppText variant="caption" weight="bold" style={[styles.blueprintLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('translation.preview_label')}</AppText>
            </View>
            <View style={styles.blueprintBody}>
               <AppText variant="title" weight="bold" style={[styles.previewDisplay, { color: G.fg }]} numberOfLines={2}>{currentPreview}</AppText>
               <View style={[styles.blueprintLine, { backgroundColor: colors.primary }]} />
            </View>
            <View style={styles.blueprintFooter}>
               <AppText variant="body-sm" weight="medium" style={[styles.footerText, { color: G.fgSecondary }]} numberOfLines={2}>{t('translation.preview_desc')}</AppText>
               <Sparkles size={16} color={colors.primary} />
            </View>
          </View>
          </TutorialTarget>

          <AppText variant="caption" weight="bold" style={[styles.selectionHeading, { color: G.fgSecondary }]} numberOfLines={1}>{t('translation.selection_heading')}</AppText>

          <TutorialTarget id="tr-list">
          {LANGUAGES.map((lang, index) => {
            const isSelected = language === lang.id;
            return (
              <Animated.View key={lang.id} entering={FadeInDown.delay(index * 100).duration(500)}>
                <TouchableOpacity
                  style={[
                    styles.langNode, 
                    { backgroundColor: G.bgCard, borderColor: G.border },
                    isSelected && { borderColor: colors.primary, borderWidth: 2 }
                  ]}
                  onPress={() => handleSelect(lang.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.langIconBox, { backgroundColor: isSelected ? colors.primary + '10' : G.fg + '05' }]}>
                    <Globe size={20} color={isSelected ? colors.primary : G.fgSecondary} />
                  </View>
                  
                  <View style={styles.langInfoArea}>
                    <AppText variant="body" weight="bold" style={[styles.langTitle, { color: G.fg }]} numberOfLines={1}>{lang.title}</AppText>
                    <AppText variant="body-sm" weight="medium" style={[styles.langScript, { color: G.fgSecondary }]} numberOfLines={1}>{t(lang.scriptKey)}</AppText>
                  </View>

                  <View style={[styles.radioBase, { borderColor: G.border }, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                    {isSelected && <Check size={12} color={G.fg} strokeWidth={4} />}
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
          </TutorialTarget>

          <View style={[styles.infoNode, { backgroundColor: G.fg + '05' }]}>
             <Zap size={18} color={G.fgSecondary} />
             <AppText variant="body-sm" weight="medium" style={[styles.noticeText, { color: G.fgSecondary }]} numberOfLines={3}>
               {t('translation.schema_notice')}
             </AppText>
          </View>
        </Animated.View>
      </TutorialScrollView>
      <View style={{ position: 'absolute', top: 50, right: 20, zIndex: 100 }}>
        <TutorialButton tutorialId="translation-settings" screenName={t('translation.localization')} />
      </View>
    </View>
  );
};

export default TranslationSettings;