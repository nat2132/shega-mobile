import React from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  Linking,
} from 'react-native';
import { Mail, Phone, Headphones, ExternalLink } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { AppText} from '@/components/ui';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { getSettingsGlass } from './glass-settings';
import { useTutorial, TutorialTarget, TutorialButton, TutorialScrollView } from '@/tutorials';
import { supportTutorial } from '@/tutorials/definitions';
const SupportCenter = () => {
   const { t, colors } = useSettings();
  const G = getSettingsGlass(colors);
  const tutorial = useTutorial({ tutorial: supportTutorial });

  const handleContact = (type: 'email' | 'phone') => {
    if (type === 'email') {
      Linking.openURL('mailto:ssshegas@gmail.com');
    } else {
      Linking.openURL('tel:+251925319901');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: G.bg }]}>
      {/* Background Decor */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[styles.glowWash, { backgroundColor: G.mutedLight, top: -100, right: -60, width: 220, height: 220, borderRadius: 110 }]} />
        <View style={[styles.glowWash, { backgroundColor: G.mutedLight, bottom: -40, left: -40, width: 180, height: 180, borderRadius: 90 }]} />
        <View style={[styles.glowWash, { backgroundColor: G.mutedLight, top: '50%', left: '20%', width: 120, height: 120, borderRadius: 60 }]} />
      </View>

      <Animated.View entering={FadeIn.duration(600)} style={styles.content}>
        <TutorialTarget id="su-header">
        <View style={styles.headerNode}>
          <AppText variant="body" weight="medium" style={[styles.headerSub, { color: G.fgSecondary }]} numberOfLines={2}>{t('support.assistance')}</AppText>
          <AppText variant="display" weight="bold" style={[styles.headerTitle, { color: G.fg }]} numberOfLines={2}>{t('support.concierge')}</AppText>
        </View>
        </TutorialTarget>

        <TutorialScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <TutorialTarget id="su-contact">
          <Animated.View entering={FadeInDown.delay(200).duration(500)}>
            <TouchableOpacity 
              style={[styles.conciergeCard, { backgroundColor: G.bgCard, borderColor: G.border }]}
              onPress={() => handleContact('email')}
              activeOpacity={0.8}
            >
              <View style={[styles.iconBase, { backgroundColor: G.fg + '08' }]}>
                 <Mail color={G.fg} size={28} />
              </View>
              <View style={styles.cardInfo}>
                <AppText variant="caption" weight="bold" style={[styles.cardTag, { color: G.fgSecondary }]} numberOfLines={1}>{t('support.email_channel')}</AppText>
                <AppText variant="title" weight="bold" style={[styles.cardMain, { color: G.fg }]} numberOfLines={2}>{t('support.direct_support')}</AppText>
                <AppText variant="body-sm" weight="medium" style={[styles.cardDesc, { color: G.fgSecondary }]} numberOfLines={2}>ssshegas@gmail.com</AppText>
              </View>
              <View style={styles.extIcon}>
                <ExternalLink size={18} color={G.border} />
              </View>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300).duration(500)}>
            <TouchableOpacity 
              style={[styles.conciergeCard, { backgroundColor: G.bgCard, borderColor: G.border }]}
              onPress={() => handleContact('phone')}
              activeOpacity={0.8}
            >
              <View style={[styles.iconBase, { backgroundColor: G.fg + '08' }]}>
                 <Phone color={G.fg} size={28} />
              </View>
              <View style={styles.cardInfo}>
                <AppText variant="caption" weight="bold" style={[styles.cardTag, { color: G.fgSecondary }]} numberOfLines={1}>{t('support.voice_terminal')}</AppText>
                <AppText variant="title" weight="bold" style={[styles.cardMain, { color: G.fg }]} numberOfLines={2}>{t('support.priority_voice')}</AppText>
                <AppText variant="body-sm" weight="medium" style={[styles.cardDesc, { color: G.fgSecondary }]} numberOfLines={2}>{t('support.voice_hours')}</AppText>
              </View>
              <View style={styles.extIcon}>
                <ExternalLink size={18} color={G.border} />
              </View>
            </TouchableOpacity>
          </Animated.View>
          </TutorialTarget>

          <TutorialTarget id="su-info">
          <Animated.View entering={FadeInDown.delay(400).duration(500)}>
            <View style={[styles.infoBanner, { backgroundColor: G.fg + '05' }]}>
               <Headphones size={20} color={G.fg} />
               <AppText variant="body-sm" weight="medium" style={[styles.bannerText, { color: G.fgSecondary }]} numberOfLines={3}>
                 {t('support.banner_text')}
               </AppText>
            </View>
          </Animated.View>
          </TutorialTarget>

          <TutorialTarget id="su-faq">
          <View style={styles.footerNode}>
             <AppText variant="caption" weight="bold" style={[styles.footerLabel, { color: G.fgSecondary }]} numberOfLines={1}>{t('support.orchestration')} v4.2.0</AppText>
             <AppText variant="caption" weight="medium" style={[styles.footerSub, { color: G.fgSecondary }]} numberOfLines={1}>Peer-to-peer sync · LAN + P2P · Encrypted</AppText>
          </View>
          </TutorialTarget>
        </TutorialScrollView>
      </Animated.View>
      <View style={{ position: 'absolute', top: 50, right: 20, zIndex: 100 }}>
        <TutorialButton tutorialId="support" screenName={t('support.assistance')} />
      </View>
    </View>
   );
  };

 const styles = StyleSheet.create({
  container: { flex: 1 },
  glowWash: { position: 'absolute' },
  content: {
    flex: 1,
  },
  headerNode: {
    paddingTop: 20,
    paddingBottom: 30,
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
  scrollContent: {
    paddingBottom: 40,
  },
  conciergeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 22,
    borderRadius: 28,
    borderWidth: 1,
    marginBottom: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  iconBase: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    marginLeft: 20,
  },
  cardTag: {
    fontFamily: Fonts.bold,
    letterSpacing: 1,
    marginBottom: 4,
  },
  cardMain: {
    fontFamily: Fonts.bold,
    marginBottom: 2,
  },
  cardDesc: {
    fontFamily: Fonts.medium,
  },
  extIcon: {
    paddingLeft: 10,
  },
  infoBanner: {
    flexDirection: 'row',
    padding: 20,
    borderRadius: 24,
    alignItems: 'center',
    gap: 15,
    marginTop: 10,
  },
  bannerText: {
    flex: 1,
    lineHeight: 18,
    fontFamily: Fonts.medium,
    fontStyle: 'italic',
  },
  footerNode: {
    marginTop: 60,
    alignItems: 'center',
  },
  footerLabel: {
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  footerSub: {
    fontFamily: Fonts.medium,
    opacity: 0.6,
  },
});

export default SupportCenter;