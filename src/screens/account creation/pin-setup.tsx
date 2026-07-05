import React, { useMemo } from 'react';
import { Fonts } from '@/constants/theme';
import {
  StyleSheet,
  View,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldCheck, Lock, ChevronRight, ShieldAlert } from 'lucide-react-native';
import { AppText } from '@/components/ui';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { getAccountGlass } from './glass-account';
import { useSettings } from '@/context/SettingsContext';

interface SecuritySetupScreenProps {
  onSetPin?: () => void;
  onSkip?: () => void;
}

const SecuritySetupScreen: React.FC<SecuritySetupScreenProps> = ({ onSetPin, onSkip }) => {
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
    mainContent: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
    },
    visualOrchestration: {
      marginBottom: 50,
    },
    protectionNode: {
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    shieldRing: {
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: G.bgCard,
      borderWidth: 1,
      borderColor: G.border,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2,
    },
    lockBadge: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: G.fg,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: G.bg,
    },
    pulseRing: {
      position: 'absolute',
      width: 180,
      height: 180,
      borderRadius: 90,
      borderWidth: 1,
      borderColor: G.border,
      zIndex: 1,
    },
    textNode: {
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
      lineHeight: 24,
      fontFamily: Fonts.medium,
    },
    actionCluster: {
      width: '100%',
      alignItems: 'center',
    },
    primaryBtn: {
      flexDirection: 'row',
      width: '100%',
      backgroundColor: G.fg,
      height: 68,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 10,
      elevation: 8,
      marginBottom: 20,
    },
    primaryBtnText: {
      color: G.bg,
      fontFamily: Fonts.bold,
      letterSpacing: 1.2,
    },
    secondaryBtn: {
      paddingVertical: 12,
    },
    secondaryBtnText: {
      color: G.fgSecondary,
      fontFamily: Fonts.semibold,
    },
    metaNode: {
      paddingBottom: 40,
      alignItems: 'center',
    },
    securitySeal: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: G.bgCard,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 10,
      marginBottom: 25,
      gap: 8,
    },
    sealText: {
      fontFamily: Fonts.bold,
      color: G.fgSecondary,
      letterSpacing: 1,
    },
    pagination: {
      flexDirection: 'row',
      gap: 8,
    },
    dot: {
      width: 12,
      height: 6,
      borderRadius: 3,
    },
    activeDot: {
      backgroundColor: G.fg,
      width: 24,
    },
  }), [G]);
  return (
    <SafeAreaView style={styles.container}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[styles.glowWash, { top: -120, left: -60, width: 300, height: 300, opacity: 0.12 }]} />
        <View style={[styles.glowWash, { bottom: -80, right: -40, width: 250, height: 250, opacity: 0.08 }]} />
      </View>

      <View style={styles.mainContent}>
        <Animated.View entering={FadeInDown.duration(800)} style={styles.visualOrchestration}>
          <View style={styles.protectionNode}>
            <View style={styles.shieldRing}>
               <ShieldCheck size={56} color={G.fg} strokeWidth={1.5} />
               <View style={styles.lockBadge}>
                  <Lock size={12} color={G.bg} strokeWidth={2.5} />
               </View>
            </View>
            <View style={styles.pulseRing} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(800)} style={styles.textNode}>
          <AppText style={styles.title} variant="display" weight="bold" numberOfLines={2}>{t('account.defend_ledger')}</AppText>
          <AppText style={styles.subtitle} variant="body" weight="medium" numberOfLines={3}>
            {t('account.pin_subtitle')}
          </AppText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(800)} style={styles.actionCluster}>
          <TouchableOpacity 
            style={styles.primaryBtn} 
            activeOpacity={0.8} 
            onPress={onSetPin}
          >
            <AppText style={styles.primaryBtnText} variant="body" weight="bold" numberOfLines={1}>{t('account.establish_protocol')}</AppText>
            <ChevronRight size={20} color={G.bg} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={onSkip} activeOpacity={0.6}>
            <AppText style={styles.secondaryBtnText} variant="body" weight="semibold" numberOfLines={2}>{t('account.skip_proceed')}</AppText>
          </TouchableOpacity>
        </Animated.View>
      </View>

      <Animated.View entering={FadeInUp.delay(600).duration(800)} style={styles.metaNode}>
        <View style={styles.securitySeal}>
           <ShieldAlert size={14} color={G.fgSecondary} />
           <AppText style={styles.sealText} variant="caption" weight="bold" transform="uppercase" numberOfLines={1}>{t('account.locally_encrypted')}</AppText>
        </View>
        <View style={styles.pagination}>
          <View style={[styles.dot, styles.activeDot]} />
          <View style={[styles.dot, { backgroundColor: G.border }]} />
        </View>
      </Animated.View>
    </SafeAreaView>
  );
};

export default SecuritySetupScreen;