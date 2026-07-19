import React, { useMemo, useState, useEffect } from 'react';
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
import { AppText } from '@/components/ui';
import Animated, { 
  FadeIn, 
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing
} from 'react-native-reanimated';
import { getSettingsGlass } from './glass-settings';
import { useTutorial, TutorialTarget, TutorialButton, TutorialScrollView } from '@/tutorials';
import { translationTutorial } from '@/tutorials/definitions';

type LangId = 'en' | 'am' | 'om' | 'ti';

// ── Premium Text Dissolve & Slide Transition ────────────────────────
interface PremiumTransitionTextProps {
  text: string;
  variant?: any;
  weight?: any;
  color?: string;
  numberOfLines?: number;
  style?: any;
  align?: any;
  transform?: any;
}

const PremiumTransitionText: React.FC<PremiumTransitionTextProps> = React.memo(({
  text,
  variant = 'body',
  weight = 'regular',
  color,
  numberOfLines,
  style,
  align,
  transform,
}) => {
  const [currentText, setCurrentText] = useState(text);
  const [prevText, setPrevText] = useState<string | null>(null);
  
  const anim = useSharedValue(1);

  useEffect(() => {
    if (text !== currentText) {
      setPrevText(currentText);
      setCurrentText(text);
      anim.value = 0;
      anim.value = withSpring(1, { damping: 18, stiffness: 120, mass: 0.9 });
    }
  }, [text]);

  const newStyle = useAnimatedStyle(() => {
    const translateX = (1 - anim.value) * 15;
    const translateY = (1 - anim.value) * 6;
    return {
      opacity: anim.value,
      transform: [{ translateX }, { translateY }],
    };
  });

  const oldStyle = useAnimatedStyle(() => {
    const translateX = -anim.value * 15;
    const translateY = -anim.value * 6;
    return {
      opacity: 1 - anim.value,
      transform: [{ translateX }, { translateY }],
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
    };
  });

  return (
    <View style={{ position: 'relative', overflow: 'visible' }}>
      {prevText && (
        <Animated.View style={oldStyle} pointerEvents="none">
          <AppText
            variant={variant}
            weight={weight}
            color={color}
            numberOfLines={numberOfLines}
            align={align}
            transform={transform}
            style={style}
          >
            {prevText}
          </AppText>
        </Animated.View>
      )}
      <Animated.View style={newStyle}>
        <AppText
          variant={variant}
          weight={weight}
          color={color}
          numberOfLines={numberOfLines}
          align={align}
          transform={transform}
          style={style}
        >
          {currentText}
        </AppText>
      </Animated.View>
    </View>
  );
});
PremiumTransitionText.displayName = 'PremiumTransitionText';

// ── Premium Radio Button Check Animation ────────────────────────────
const PremiumRadioCheck = ({ isSelected, colors, G }: { isSelected: boolean; colors: any; G: any }) => {
  const scale = useSharedValue(isSelected ? 1 : 0);
  const opacity = useSharedValue(isSelected ? 1 : 0);

  useEffect(() => {
    scale.value = withSpring(isSelected ? 1 : 0, { damping: 12, stiffness: 150 });
    opacity.value = withTiming(isSelected ? 1 : 0, { duration: 150 });
  }, [isSelected]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={[
      styles.radioBase, 
      { 
        borderColor: isSelected ? colors.primary : G.border,
        backgroundColor: isSelected ? colors.primary : 'transparent',
      }
    ]}>
      <Animated.View style={animatedStyle}>
        <Check size={12} color={G.fg} strokeWidth={4} />
      </Animated.View>
    </View>
  );
};

const TranslationSettings = () => {
  const { language, setLanguage, colors, t } = useSettings();
  const LANGUAGES: { id: LangId; title: string; scriptKey: string; preview: string }[] = [
    { id: 'en', title: t('language.english'), scriptKey: 'settings.script_primary', preview: t('language.preview_inv') },
    { id: 'am', title: t('language.amharic'), scriptKey: 'settings.script_ethiopic', preview: t('language.preview_inv') },
    { id: 'om', title: t('language.oromo'), scriptKey: 'settings.script_latin', preview: t('language.preview_inv_om') },
    { id: 'ti', title: t('language.tigrinya'), scriptKey: 'settings.script_ethiopic', preview: t('language.preview_inv') },
  ];
  const G = getSettingsGlass(colors);
  
  // ── Coordinates and Shared Values for Selection Indicator ─────────
  const [layoutMap, setLayoutMap] = useState<Record<number, { y: number; height: number }>>({});
  const selectedIdx = LANGUAGES.findIndex(l => l.id === language);
  
  const targetY = useSharedValue(0);
  const targetHeight = useSharedValue(84);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const layout = layoutMap[selectedIdx];
    if (layout) {
      targetY.value = withSpring(layout.y, { damping: 15, stiffness: 120, mass: 0.8 });
      targetHeight.value = withSpring(layout.height, { damping: 15, stiffness: 120, mass: 0.8 });
      opacity.value = withTiming(1, { duration: 180 });
    }
  }, [selectedIdx, layoutMap]);

  const animatedSelectionStyle = useAnimatedStyle(() => {
    return {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      height: targetHeight.value,
      transform: [{ translateY: targetY.value }],
      borderColor: colors.primary,
      borderWidth: 2,
      borderRadius: 24,
      backgroundColor: colors.primary + '08',
      opacity: opacity.value,
      pointerEvents: 'none',
      zIndex: 10,
    };
  });

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
              <PremiumTransitionText variant="body" weight="medium" style={[styles.headerSub, { color: G.fgSecondary }]} numberOfLines={2} text={t('translation.localization')} />
              <PremiumTransitionText variant="display" weight="bold" style={[styles.headerTitle, { color: G.fg }]} numberOfLines={2} text={t('translation.global_hub')} />
            </View>
          </TutorialTarget>

          {/* Intelligence Preview Node */}
          <TutorialTarget id="tr-current">
            <View style={[styles.previewBlueprint, { backgroundColor: G.bgCard, borderColor: G.border }]}>
              <View style={styles.blueprintHead}>
                <View style={[styles.iconTag, { backgroundColor: G.fg + '08' }]}>
                  <Languages size={22} color={G.fg} />
                </View>
                <PremiumTransitionText variant="caption" weight="bold" style={[styles.blueprintLabel, { color: G.fgSecondary }]} numberOfLines={1} text={t('translation.preview_label')} />
              </View>
              <View style={styles.blueprintBody}>
                <PremiumTransitionText variant="title" weight="bold" style={[styles.previewDisplay, { color: G.fg }]} numberOfLines={2} text={currentPreview} />
                <View style={[styles.blueprintLine, { backgroundColor: colors.primary }]} />
              </View>
              <View style={styles.blueprintFooter}>
                <PremiumTransitionText variant="body-sm" weight="medium" style={[styles.footerText, { color: G.fgSecondary }]} numberOfLines={2} text={t('translation.preview_desc')} />
                <Sparkles size={16} color={colors.primary} />
              </View>
            </View>
          </TutorialTarget>

          <PremiumTransitionText variant="caption" weight="bold" style={[styles.selectionHeading, { color: G.fgSecondary }]} numberOfLines={1} text={t('translation.selection_heading')} />

          <TutorialTarget id="tr-list">
            <View style={{ position: 'relative' }}>
              <Animated.View style={animatedSelectionStyle} />
              {LANGUAGES.map((lang, index) => {
                const isSelected = language === lang.id;
                return (
                  <Animated.View 
                    key={lang.id} 
                    entering={FadeInDown.delay(index * 100).duration(500)}
                    onLayout={(event) => {
                      const { y, height } = event.nativeEvent.layout;
                      setLayoutMap(prev => ({
                        ...prev,
                        [index]: { y, height }
                      }));
                    }}
                  >
                    <TouchableOpacity
                      style={[
                        styles.langNode, 
                        { backgroundColor: G.bgCard, borderColor: G.border }
                      ]}
                      onPress={() => handleSelect(lang.id)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.langIconBox, { backgroundColor: isSelected ? colors.primary + '10' : G.fg + '05' }]}>
                        <Globe size={20} color={isSelected ? colors.primary : G.fgSecondary} />
                      </View>
                      
                      <View style={styles.langInfoArea}>
                        <AppText variant="body" weight="bold" style={[styles.langTitle, { color: G.fg }]} numberOfLines={1}>{lang.title}</AppText>
                        <PremiumTransitionText variant="body-sm" weight="medium" style={[styles.langScript, { color: G.fgSecondary }]} numberOfLines={1} text={t(lang.scriptKey)} />
                      </View>

                      <PremiumRadioCheck isSelected={isSelected} colors={colors} G={G} />
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          </TutorialTarget>

          <View style={[styles.infoNode, { backgroundColor: G.fg + '05' }]}>
            <Zap size={18} color={G.fgSecondary} />
            <PremiumTransitionText variant="body-sm" weight="medium" style={[styles.noticeText, { color: G.fgSecondary }]} numberOfLines={3} text={t('translation.schema_notice')} />
          </View>
        </Animated.View>
      </TutorialScrollView>
      <View style={{ position: 'absolute', top: 50, right: 20, zIndex: 100 }}>
        <TutorialButton tutorialId="translation-settings" screenName={t('translation.localization')} />
      </View>
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
});

export default TranslationSettings;