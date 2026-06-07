import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Platform
} from 'react-native';
import { Globe, Check, Sparkles, X } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { AppCard, AppButton, AppText } from '@/components/ui';
const { height } = Dimensions.get('window');

type LangCode = 'en' | 'am' | 'om' | 'ti';

interface PDFLanguageModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (lang: LangCode, action: 'share' | 'save') => void;
}

const LANGUAGES: { id: LangCode; label: string; sub: string; flag: string }[] = [
  { id: 'en', label: 'English', sub: 'System Standard Format', flag: '🇬🇧' },
  { id: 'am', label: 'አማርኛ (Amharic)', sub: 'የኢትዮጵያ ፊደል', flag: '🇪🇹' },
  { id: 'om', label: 'Afaan Oromoo', sub: 'Qubee Laatin Variant', flag: '🇪🇹' },
  { id: 'ti', label: 'ትግርኛ (Tigrinya)', sub: 'ፊደል ትግርኛ', flag: '🇪🇹' }
];

export const PDFLanguageModal: React.FC<PDFLanguageModalProps> = ({ visible, onClose, onSelect }) => {
  const { colors, theme, t } = useSettings();
  const [selectedLang, setSelectedLang] = React.useState<LangCode>('en');

  const handleAction = (action: 'share' | 'save') => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSelect(selectedLang, action);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Backdrop blur/tint */}
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
          <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
        </TouchableOpacity>

        {/* Bottom Sheet Card */}
        <Animated.View 
          entering={SlideInDown.springify().damping(18)}
          style={[styles.sheet, { backgroundColor: colors.background, borderTopColor: colors.border }]}
        >
          <View style={styles.header}>
            <View style={styles.headerIndicator}>
              <View style={[styles.handleBar, { backgroundColor: colors.border }]} />
            </View>
            <View style={styles.headerTitleRow}>
              <View style={[styles.titleIconBox, { backgroundColor: colors.primary + '15' }]}>
                <Sparkles size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="title" weight="bold" numberOfLines={2} style={[styles.titleText, { color: colors.text }]}>{t('common.export_language')}</AppText>
                <AppText variant="body" weight="medium" numberOfLines={3} style={[styles.subtitleText, { color: colors.textSecondary }]}>{t('common.export_language_desc')}</AppText>
              </View>
              <TouchableOpacity 
                style={[styles.closeBtn, { backgroundColor: colors.card, borderColor: colors.border }]} 
                onPress={onClose}
              >
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.optionsList}>
            {LANGUAGES.map((lang) => {
              const isSelected = selectedLang === lang.id;
              return (
                <TouchableOpacity
                  key={lang.id}
                  style={[
                    styles.optionItem, 
                    { backgroundColor: colors.card, borderColor: isSelected ? colors.primary : colors.border },
                    isSelected && { borderWidth: 2 }
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedLang(lang.id);
                  }}
                >
                  <View style={styles.optionLeft}>
                    <View style={[styles.globeBox, { backgroundColor: colors.text + '05' }]}>
                      <AppText variant="caption" weight="medium" numberOfLines={1} style={styles.flagText}>{lang.flag}</AppText>
                    </View>
                    <View style={{ marginLeft: 15 }}>
                      <AppText variant="body" weight="bold" numberOfLines={1} style={[styles.langLabel, { color: colors.text }]}>{lang.label}</AppText>
                      <AppText variant="body" weight="medium" numberOfLines={3} style={[styles.langSub, { color: colors.textSecondary }]}>{lang.sub}</AppText>
                    </View>
                  </View>

                  <View style={[
                    styles.circleCheck, 
                    { borderColor: isSelected ? colors.primary : colors.border },
                    isSelected && { backgroundColor: colors.primary }
                  ]}>
                    {isSelected ? (
                      <Check size={14} color="#FFF" strokeWidth={3} />
                    ) : (
                      <Globe size={14} color={colors.textSecondary} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]} 
              activeOpacity={0.8}
              onPress={() => handleAction('share')}
            >
              <AppText variant="body" weight="bold" numberOfLines={1} style={[styles.actionBtnText, { color: colors.text }]}>{t('common.share_pdf')}</AppText>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionBtn, styles.saveBtn, { backgroundColor: colors.text }]} 
              activeOpacity={0.8}
              onPress={() => handleAction('save')}
            >
              <AppText variant="body" weight="bold" numberOfLines={1} style={[styles.actionBtnText, { color: colors.background }]}>{t('common.save_device')}</AppText>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 44 : 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 24,
  },
  header: {
    paddingHorizontal: 25,
    paddingTop: 15,
    paddingBottom: 20,
  },
  headerIndicator: {
    alignItems: 'center',
    marginBottom: 20,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  titleIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleText: {

    fontFamily: Fonts.bold,
    lineHeight: 24,
  },
  subtitleText: {

    fontFamily: Fonts.medium,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsList: {
    paddingHorizontal: 25,
    gap: 12,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  globeBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flagText: {

  },
  langLabel: {

    fontFamily: Fonts.bold,
  },
  langSub: {

    fontFamily: Fonts.medium,
    marginTop: 2,
  },
  circleCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 25,
    marginTop: 25,
    gap: 15,
  },
  actionBtn: {
    flex: 1,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtn: {
    borderWidth: 0,
  },
  actionBtnText: {

    fontFamily: Fonts.bold,
  },
});
