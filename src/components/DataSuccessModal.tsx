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
  withTiming,
  FadeInDown
} from 'react-native-reanimated';
import { 
  Check, 
  ChevronRight,
  Database,
  CloudDownload,
  ShieldCheck,
  RefreshCw
} from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useSettings } from '@/context/SettingsContext';
import { Fonts } from '@/constants/theme';

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
  }, []);

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
          subtitle: "BACKUP SECURED",
          icon: Database,
          msg: "Your local database has been successfully packaged and shared."
        };
      case 'import':
        return {
          title: t('settings.import_success').toUpperCase(),
          subtitle: "RESTORE COMPLETE",
          icon: CloudDownload,
          msg: "The selected backup has been applied. Your workspace is now synchronized."
        };
      case 'reset':
        return {
          title: t('settings.reset_title').toUpperCase(),
          subtitle: "SYSTEM PURIFIED",
          icon: RefreshCw,
          msg: "All local data has been cleared. The application is now in its factory state."
        };
    }
  };

  const details = getDetails();
  const Icon = details.icon;

  return (
    <View style={styles.overlay}>
      <BlurView intensity={theme === 'dark' ? 100 : 80} tint={theme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      
      <View style={styles.container}>
        <View style={styles.iconContainer}>
          <Animated.View style={[styles.successRing, { borderColor: colors.primary + '40' }, animatedRingStyle]} />
          <Animated.View style={[styles.iconCircle, { backgroundColor: colors.primary }, animatedCheckStyle]}>
            <Check size={48} color="#FFF" strokeWidth={3} />
          </Animated.View>
        </View>

        <Animated.View entering={FadeInDown.delay(600)} style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>{details.title}</Text>
          <Text style={[styles.subtitle, { color: colors.primary }]}>{details.subtitle}</Text>
          
          <View style={[styles.messageCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
             <Icon size={24} color={colors.primary} style={{ marginBottom: 12 }} />
             <Text style={[styles.message, { color: colors.textSecondary }]}>{details.msg}</Text>
          </View>

          <TouchableOpacity 
            style={[styles.finishBtn, { backgroundColor: colors.text }]} 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onClose();
            }}
            activeOpacity={0.9}
          >
            <Text style={[styles.finishBtnText, { color: colors.background }]}>{t('common.done').toUpperCase()}</Text>
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
    fontSize: 14,
    fontFamily: Fonts.bold,
    letterSpacing: 4,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 32,
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
    fontSize: 15,
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
    fontSize: 16,
    fontFamily: Fonts.bold,
    letterSpacing: 1,
  },
});

export default DataSuccessModal;
