import React from 'react';
import { 
  View, 
  Text as RNText, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Dimensions,
  Platform 
} from 'react-native';
import { 
  Languages, 
  Check, 
  Globe, 
  ChevronRight, 
  Zap, 
  Sparkles 
} from 'lucide-react-native';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import Animated, { FadeIn, FadeInDown, Layout } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

type LangId = 'en' | 'am' | 'om' | 'ti';

const LANGUAGES: { id: LangId; title: string; script: string; preview: string }[] = [
  { id: 'en', title: 'English', script: 'PRIMARY SYSTEM DEFAULT', preview: 'Inventory Management' },
  { id: 'am', title: 'Amharic', script: 'ETHIOPIC SCRIPT', preview: 'የፈንጂ አስተዳደር' },
  { id: 'om', title: 'Afaan Oromo', script: 'LATIN SCRIPT VARIANT', preview: 'Bulchiinsa Kuusaa' },
  { id: 'ti', title: 'Tigrinya', script: 'ETHIOPIC SCRIPT', preview: 'ምምሕዳር ዕቃ' },
];

const TranslationSettings = () => {
  const { language, setLanguage, colors, t, theme } = useSettings();

  const handleSelect = (id: LangId) => {
    setLanguage(id);
  };

  const currentPreview = LANGUAGES.find(l => l.id === language)?.preview ?? 'Inventory Management';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Animated.View entering={FadeIn.duration(600)}>
          <View style={styles.headerNode}>
            <RNText style={[styles.headerSub, { color: colors.textSecondary }]}>{t('translation.localization')}</RNText>
            <RNText style={[styles.headerTitle, { color: colors.text }]}>{t('translation.global_hub')}</RNText>
          </View>

          {/* Intelligence Preview Node */}
          <View style={[styles.previewBlueprint, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.blueprintHead}>
              <View style={[styles.iconTag, { backgroundColor: colors.text + '08' }]}>
                 <Languages size={22} color={colors.text} />
              </View>
              <RNText style={[styles.blueprintLabel, { color: colors.textSecondary }]}>{t('translation.preview_label')}</RNText>
            </View>
            <View style={styles.blueprintBody}>
               <RNText style={[styles.previewDisplay, { color: colors.text }]}>{currentPreview}</RNText>
               <View style={[styles.blueprintLine, { backgroundColor: colors.primary }]} />
            </View>
            <View style={styles.blueprintFooter}>
               <RNText style={[styles.footerText, { color: colors.textSecondary }]}>{t('translation.preview_desc')}</RNText>
               <Sparkles size={16} color={colors.primary} />
            </View>
          </View>

          <RNText style={[styles.selectionHeading, { color: colors.textSecondary }]}>{t('translation.selection_heading')}</RNText>

          {LANGUAGES.map((lang, index) => {
            const isSelected = language === lang.id;
            return (
              <Animated.View key={lang.id} entering={FadeInDown.delay(index * 100).duration(500)}>
                <TouchableOpacity
                  style={[
                    styles.langNode, 
                    { backgroundColor: colors.card, borderColor: colors.border },
                    isSelected && { borderColor: colors.primary, borderWidth: 2 }
                  ]}
                  onPress={() => handleSelect(lang.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.langIconBox, { backgroundColor: isSelected ? colors.primary + '10' : colors.text + '05' }]}>
                    <Globe size={20} color={isSelected ? colors.primary : colors.textSecondary} />
                  </View>
                  
                  <View style={styles.langInfoArea}>
                    <RNText style={[styles.langTitle, { color: colors.text }]}>{lang.title}</RNText>
                    <RNText style={[styles.langScript, { color: colors.textSecondary }]}>{lang.script}</RNText>
                  </View>

                  <View style={[styles.radioBase, { borderColor: colors.border }, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                    {isSelected && <Check size={12} color="#FFF" strokeWidth={4} />}
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })}

          <View style={[styles.infoNode, { backgroundColor: colors.text + '05' }]}>
             <Zap size={18} color={colors.textSecondary} />
             <RNText style={[styles.noticeText, { color: colors.textSecondary }]}>
               {t('translation.schema_notice')}
             </RNText>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
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
    fontSize: 11,
    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
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
    fontSize: 10,
    fontFamily: Fonts.bold,
    letterSpacing: 1.2,
  },
  blueprintBody: {
    marginBottom: 20,
  },
  previewDisplay: {
    fontSize: 22,
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
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  footerText: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    fontStyle: 'italic',
  },
  selectionHeading: {
    fontSize: 11,
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
    fontSize: 17,
    fontFamily: Fonts.bold,
    marginBottom: 2,
  },
  langScript: {
    fontSize: 11,
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
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Fonts.medium,
  },
});

export default TranslationSettings;