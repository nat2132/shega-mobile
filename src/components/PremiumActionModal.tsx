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
  FadeInDown,
} from 'react-native-reanimated';
import { 
  AlertTriangle, 
  Trash2} from 'lucide-react-native';

import * as Haptics from 'expo-haptics';
import { useSettings } from '@/context/SettingsContext';
import { Fonts } from '@/constants/theme';
import { AppText} from '@/components/ui';
const { width } = Dimensions.get('window');

interface PremiumActionModalProps {
  title: string;
  subtitle: string;
  actionText?: string;
  cancelText?: string;
  iconType?: 'warning' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

const PremiumActionModal: React.FC<PremiumActionModalProps> = ({ 
  title, 
  subtitle, 
  actionText, 
  cancelText,
  iconType = 'danger',
  onConfirm, 
  onCancel 
}) => {
  const { colors, theme, t } = useSettings();
  const iconScale = useSharedValue(0);
  const ringScale = useSharedValue(0);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    ringScale.value = withSpring(1, { damping: 10, stiffness: 100 });
    iconScale.value = withDelay(200, withSpring(1, { damping: 8, stiffness: 120 }));
  }, [iconScale, ringScale]);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }]
  }));

  const animatedRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringScale.value
  }));

  const getIcon = () => {
    if (iconType === 'danger') return <Trash2 size={40} color="#FFF" strokeWidth={2.5} />;
    return <AlertTriangle size={40} color="#FFF" strokeWidth={2.5} />;
  };

  const themeColor = iconType === 'danger' ? colors.error : colors.warning;

  return (
    <View style={styles.overlay}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.50)' }]} />

      <View style={[styles.container, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <View style={styles.iconContainer}>
          <Animated.View style={[styles.dangerRing, { borderColor: themeColor + '40' }, animatedRingStyle]} />
          <Animated.View style={[styles.iconCircle, { backgroundColor: themeColor }, animatedIconStyle]}>
            {getIcon()}
          </Animated.View>
        </View>

        <Animated.View entering={FadeInDown.delay(400)} style={styles.content}>
          <AppText variant="heading" weight="bold" align="center" style={[styles.title, { color: themeColor }]} numberOfLines={2}>{title.toUpperCase()}</AppText>
          <AppText variant="body" weight="medium" align="center" style={[styles.subtitle, { color: colors.text }]} numberOfLines={3}>{subtitle}</AppText>
          
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[styles.btn, styles.cancelBtn, { borderColor: colors.border, backgroundColor: colors.background }]} 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onCancel();
              }}
              activeOpacity={0.8}
            >
              <AppText variant="body" weight="bold" style={[styles.cancelBtnText, { color: colors.text }]} numberOfLines={1}>{cancelText || t('common.cancel')}</AppText>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.btn, styles.confirmBtn, { backgroundColor: themeColor }]} 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                onConfirm();
              }}
              activeOpacity={0.9}
            >
              <AppText variant="body" weight="bold" style={styles.confirmBtnText} numberOfLines={1}>{actionText || t('common.proceed')}</AppText>
            </TouchableOpacity>
          </View>
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
    width: width * 0.85,
    alignItems: 'center',
    padding: 20,
    borderRadius: 32,
    borderWidth: 1,
  },
  iconContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 25,
  },
  dangerRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  iconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  content: {
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontFamily: Fonts.bold,
    letterSpacing: 2,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: Fonts.medium,
    lineHeight: 24,
    marginBottom: 35,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 15,
  },
  btn: {
    flex: 1,
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    borderWidth: 1,
  },
  confirmBtn: {},
  cancelBtnText: {
    fontFamily: Fonts.bold,
  },
  confirmBtnText: {
    fontFamily: Fonts.bold,
    color: '#FFF',
  },
});

export default PremiumActionModal;