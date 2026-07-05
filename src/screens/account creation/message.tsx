import React, { useMemo } from 'react';
import { Fonts } from '@/constants/theme';
import {
  StyleSheet,
  View,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle2, Sparkles, LayoutDashboard} from 'lucide-react-native';
import { AppText } from '@/components/ui';
import { getAccountGlass } from './glass-account';
import { useSettings } from '@/context/SettingsContext';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

interface SuccessScreenProps {
  onGoToDashboard?: () => void;
}

const SuccessScreen: React.FC<SuccessScreenProps> = ({ onGoToDashboard }) => {
  const { colors, t } = useSettings();
  const G = getAccountGlass(colors);
  const styles = useMemo(() => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: G.bg,
  },
  glowWash: {
    position: 'absolute',
    borderRadius: 200,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  visualOrchestration: {
    marginBottom: 50,
  },
  successNode: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  mainCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: G.fg,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  sparkleBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: G.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: G.border,
  },
  pulseRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1.5,
    borderColor: G.border,
    zIndex: 1,
  },
  briefingArea: {
    alignItems: 'center',
    marginBottom: 60,
  },
  title: {
    fontFamily: Fonts.extrabold,
    fontWeight: '800',
    color: G.fg,
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    color: G.fgSecondary,
    textAlign: 'center',
    lineHeight: 26,
    fontFamily: Fonts.medium,
  },
  actionArea: {
    width: '100%',
    alignItems: 'center',
  },
  primaryActionBtn: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: G.fg,
    height: 72,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
    marginBottom: 25,
  },
  btnText: {
    color: G.bg,
    fontFamily: Fonts.bold,
    letterSpacing: 1.5,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: G.success, // Emerald green
  },
  statusText: {
    fontFamily: Fonts.bold,
    color: G.fgSecondary,
    letterSpacing: 1,
  },
  footerBranding: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  footerTag: {
    fontFamily: Fonts.bold,
    color: G.muted,
    letterSpacing: 1.5,
  },
}), [G]);
  return (
    <SafeAreaView style={styles.container}>
      {/* Ambient Glass Glow */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[styles.glowWash, { top: -120, left: -60, width: 300, height: 300, opacity: 0.12 }]} />
        <View style={[styles.glowWash, { bottom: -80, right: -40, width: 250, height: 250, opacity: 0.08 }]} />
      </View>

      <View style={styles.content}>
        <Animated.View entering={FadeInDown.duration(800)} style={styles.visualOrchestration}>
          <View style={styles.successNode}>
            <View style={styles.mainCircle}>
               <CheckCircle2 size={56} color={G.bg} strokeWidth={1.5} />
               <View style={styles.sparkleBadge}>
                  <Sparkles size={16} color={G.bg} />
               </View>
            </View>
            <View style={styles.pulseRing} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(800)} style={styles.briefingArea}>
          <AppText style={styles.title} variant="display" weight="bold" numberOfLines={2}>{t('account.system_ready')}</AppText>
          <AppText style={styles.subtitle} variant="body" weight="medium" numberOfLines={3}>
            {t('account.ready_subtitle')}
          </AppText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(800)} style={styles.actionArea}>
          <TouchableOpacity 
            style={styles.primaryActionBtn} 
            activeOpacity={0.8} 
            onPress={onGoToDashboard}
          >
            <AppText style={styles.btnText} variant="body" weight="bold" numberOfLines={1}>{t('account.enter_terminal')}</AppText>
            <LayoutDashboard size={20} color={G.bg} />
          </TouchableOpacity>

          <View style={styles.statusIndicator}>
             <View style={styles.statusDot} />
             <AppText style={styles.statusText} variant="caption" weight="bold" transform="uppercase" numberOfLines={1}>{t('account.systems_nominal')}</AppText>
          </View>
        </Animated.View>
      </View>

      {/* Footer Branding */}
      <Animated.View entering={FadeInUp.delay(600).duration(800)} style={styles.footerBranding}>
         <AppText style={styles.footerTag} variant="caption" weight="bold" transform="uppercase" numberOfLines={1}>ESTABLISHED SECURE SESSION • AES-256</AppText>
      </Animated.View>
    </SafeAreaView>
  );
};

export default SuccessScreen;