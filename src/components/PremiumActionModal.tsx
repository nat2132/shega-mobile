import React, { useEffect } from 'react';
import { 
  View, 
  Text, 
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
  Trash2,
  X
} from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useSettings } from '@/context/SettingsContext';
import { Fonts } from '@/constants/theme';

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
  const { colors, theme } = useSettings();
  const iconScale = useSharedValue(0);
  const ringScale = useSharedValue(0);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    ringScale.value = withSpring(1, { damping: 10, stiffness: 100 });
    iconScale.value = withDelay(200, withSpring(1, { damping: 8, stiffness: 120 }));
  }, []);

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

  const themeColor = iconType === 'danger' ? '#FF3B30' : '#FF9500';

  return (
    <View style={styles.overlay}>
      <BlurView intensity={theme === 'dark' ? 100 : 80} tint={theme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      
      <View style={styles.container}>
        <View style={styles.iconContainer}>
          <Animated.View style={[styles.dangerRing, { borderColor: themeColor + '40' }, animatedRingStyle]} />
          <Animated.View style={[styles.iconCircle, { backgroundColor: themeColor }, animatedIconStyle]}>
            {getIcon()}
          </Animated.View>
        </View>

        <Animated.View entering={FadeInDown.delay(400)} style={styles.content}>
          <Text style={[styles.title, { color: themeColor }]}>{title.toUpperCase()}</Text>
          <Text style={[styles.subtitle, { color: colors.text }]}>{subtitle}</Text>
          
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[styles.btn, styles.cancelBtn, { borderColor: colors.border, backgroundColor: colors.background }]} 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onCancel();
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.cancelBtnText, { color: colors.text }]}>{cancelText || 'Cancel'}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.btn, styles.confirmBtn, { backgroundColor: themeColor }]} 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                onConfirm();
              }}
              activeOpacity={0.9}
            >
              <Text style={styles.confirmBtnText}>{actionText || 'Proceed'}</Text>
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
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.02)',
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
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  content: {
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    letterSpacing: 2,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
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
  confirmBtn: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  cancelBtnText: {
    fontSize: 16,
    fontFamily: Fonts.bold,
  },
  confirmBtnText: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: '#FFF',
  },
});

export default PremiumActionModal;
