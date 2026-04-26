import React from 'react';
import { 
  View, 
  Text as RNText, 
  StyleSheet, 
  TouchableOpacity, 
  Dimensions,
  Platform,
  Linking
} from 'react-native';
import { Mail, Phone, ChevronRight, Headphones, MessageSquare, ExternalLink } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const SupportCenter = () => {
  const { t, colors, theme } = useSettings();

  const handleContact = (type: 'email' | 'phone') => {
    if (type === 'email') {
      Linking.openURL('mailto:support@invpro.com');
    } else {
      Linking.openURL('tel:+18885550123');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Background Decor */}
      <View style={StyleSheet.absoluteFill}>
        <View style={[styles.glowCircle, { top: -100, right: -100, backgroundColor: colors.primary, opacity: 0.1 }]} />
      </View>

      <Animated.View entering={FadeIn.duration(600)} style={styles.content}>
        <View style={styles.headerNode}>
          <RNText style={[styles.headerSub, { color: colors.textSecondary }]}>{t('support.assistance')}</RNText>
          <RNText style={[styles.headerTitle, { color: colors.text }]}>{t('support.concierge')}</RNText>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <Animated.View entering={FadeInDown.delay(200).duration(500)}>
            <TouchableOpacity 
              style={[styles.conciergeCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => handleContact('email')}
              activeOpacity={0.8}
            >
              <View style={[styles.iconBase, { backgroundColor: colors.text + '08' }]}>
                 <Mail color={colors.text} size={28} />
              </View>
              <View style={styles.cardInfo}>
                <RNText style={[styles.cardTag, { color: colors.textSecondary }]}>{t('support.email_channel')}</RNText>
                <RNText style={[styles.cardMain, { color: colors.text }]}>{t('support.direct_support')}</RNText>
                <RNText style={[styles.cardDesc, { color: colors.textSecondary }]}>support@invpro.com</RNText>
              </View>
              <View style={styles.extIcon}>
                <ExternalLink size={18} color={colors.border} />
              </View>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300).duration(500)}>
            <TouchableOpacity 
              style={[styles.conciergeCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => handleContact('phone')}
              activeOpacity={0.8}
            >
              <View style={[styles.iconBase, { backgroundColor: colors.text + '08' }]}>
                 <Phone color={colors.text} size={28} />
              </View>
              <View style={styles.cardInfo}>
                <RNText style={[styles.cardTag, { color: colors.textSecondary }]}>{t('support.voice_terminal')}</RNText>
                <RNText style={[styles.cardMain, { color: colors.text }]}>{t('support.priority_voice')}</RNText>
                <RNText style={[styles.cardDesc, { color: colors.textSecondary }]}>{t('support.voice_hours')}</RNText>
              </View>
              <View style={styles.extIcon}>
                <ExternalLink size={18} color={colors.border} />
              </View>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(400).duration(500)}>
            <View style={[styles.infoBanner, { backgroundColor: colors.text + '05' }]}>
               <Headphones size={20} color={colors.text} />
               <RNText style={[styles.bannerText, { color: colors.textSecondary }]}>
                 {t('support.banner_text')}
               </RNText>
            </View>
          </Animated.View>

          <View style={styles.footerNode}>
             <RNText style={[styles.footerLabel, { color: colors.textSecondary }]}>{t('support.orchestration')} v4.2.0</RNText>
             <RNText style={[styles.footerSub, { color: colors.textSecondary }]}>{t('support.cloud_sync')}</RNText>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
};

// Internal local wrap to avoid ScrollView issue since caller might wrap it
const ScrollView = (props: any) => {
  const { ScrollView: RNScrollView } = require('react-native');
  return <RNScrollView {...props} />;
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  glowCircle: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  content: {
    flex: 1,
    paddingHorizontal: 25,
  },
  headerNode: {
    paddingTop: 60,
    paddingBottom: 30,
  },
  headerSub: {
    fontSize: 12,
    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
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
    fontSize: 10,
    fontFamily: Fonts.bold,
    letterSpacing: 1,
    marginBottom: 4,
  },
  cardMain: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    marginBottom: 2,
  },
  cardDesc: {
    fontSize: 13,
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
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Fonts.medium,
    fontStyle: 'italic',
  },
  footerNode: {
    marginTop: 60,
    alignItems: 'center',
  },
  footerLabel: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  footerSub: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    opacity: 0.6,
  },
});

export default SupportCenter;