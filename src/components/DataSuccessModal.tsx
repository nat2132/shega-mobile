import React, { useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  Dimensions 
} from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withDelay, 
  FadeInDown
} from 'react-native-reanimated';
import { 
  Check, 
  ChevronRight,
  Database,
  CloudDownload,
  RefreshCw
} from 'lucide-react-native';

import * as Haptics from 'expo-haptics';
import { useSettings } from '@/context/SettingsContext';
import { Fonts } from '@/constants/theme';
import { AppText} from '@/components/ui';
const { width } = Dimensions.get('window');

interface DataSuccessModalProps {
  type: 'export' | 'import' | 'reset';
  onClose: () => void;
}

const DataSuccessModal: React.FC<DataSuccessModalProps> = ({ type, onClose }) => {
  const { colors, t, theme } = useSettings();
  const checkScale = useSharedValue(0);
  const ringScale = useSharedValue(0);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    ringScale.value = withSpring(1, { damping: 10, stiffness: 100 });
    checkScale.value = withDelay(300, withSpring(1, { damping: 8, stiffness: 120 }));
  }, [checkScale, ringScale]);

  const animatedCheckStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }]
  }));

  const animatedRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringScale.value
  }));

  const getDetails = () => {
    switch (type) {
      case 'export':
        return {
          title: t('settings.export_data').toUpperCase(),
          subtitle: t('data.backup_secured'),
          icon: Database,
          msg: t('data.backup_msg')
        };
      case 'import':
        return {
          title: t('settings.import_success').toUpperCase(),
          subtitle: t('data.restore_complete'),
          icon: CloudDownload,
          msg: t('data.restore_msg')
        };
      case 'reset':
        return {
          title: t('settings.reset_title').toUpperCase(),
          subtitle: t('data.system_purified'),
          icon: RefreshCw,
          msg: t('data.reset_msg')
        };
    }
  };

  const details = getDetails();
  const Icon = details.icon;

  return (
    <View style={styles.overlay}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.50)' }]} />

      <View style={styles.container}>
        <View style={styles.iconContainer}>
          <Animated.View style={[styles.successRing, { borderColor: colors.primary + '40' }, animatedRingStyle]} />
          <Animated.View style={[styles.iconCircle, { backgroundColor: colors.primary }, animatedCheckStyle]}>
            <Check size={48} color={colors.background} strokeWidth={3} />
          </Animated.View>
        </View>

        <Animated.View entering={FadeInDown.delay(600)} style={styles.content}>
          <AppText variant="title" weight="bold" align="center" style={[styles.title, { color: colors.text }]} numberOfLines={2}>{details.title}</AppText>
          <AppText variant="heading" weight="extrabold" align="center" style={[styles.subtitle, { color: colors.primary }]} numberOfLines={1}>{details.subtitle}</AppText>
          
          <View style={[styles.messageCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
             <Icon size={24} color={colors.primary} style={{ marginBottom: 12 }} />
             <AppText variant="body" weight="medium" align="center" style={[styles.message, { color: colors.textSecondary }]} numberOfLines={3}>{details.msg}</AppText>
          </View>

          <TouchableOpacity 
            style={[styles.finishBtn, { backgroundColor: colors.text }]} 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onClose();
            }}
            activeOpacity={0.9}
          >
            <AppText variant="body" weight="bold" style={[styles.finishBtnText, { color: colors.background }]} numberOfLines={1}>{t('common.done').toUpperCase()}</AppText>
            <ChevronRight size={20} color={colors.background} />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: width * 0.9,
    alignItems: 'center',
  },
  iconContainer: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  successRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
  },
  content: {
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontFamily: Fonts.bold,
    letterSpacing: 4,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: Fonts.extrabold,
    letterSpacing: -1,
    marginBottom: 30,
  },
  messageCard: {
    width: '100%',
    borderRadius: 30,
    padding: 30,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 40,
  },
  message: {
    fontFamily: Fonts.medium,
    textAlign: 'center',
    lineHeight: 24,
  },
  finishBtn: {
    width: '100%',
    height: 65,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  finishBtnText: {
    fontFamily: Fonts.bold,
    letterSpacing: 1,
  },
});

export default DataSuccessModal;