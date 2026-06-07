import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Fonts } from '@/constants/theme';
import { Wifi, Store, ArrowRight, Zap } from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { AppText } from '@/components/ui';
interface WelcomeChoiceProps {
  onSyncChoose: () => void;
  onRegisterChoose: () => void;
}

const WelcomeChoiceScreen: React.FC<WelcomeChoiceProps> = ({ onSyncChoose, onRegisterChoose }) => {
  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(800)} style={styles.header}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/images/logo.svg')}
            style={styles.logo}
            contentFit="contain"
          />
        </View>
        <AppText style={styles.title} variant="display" weight="bold" numberOfLines={2}>Welcome to Shega</AppText>
        <AppText style={styles.subtitle} variant="body" weight="medium" numberOfLines={3}>
          How would you like to get started?
        </AppText>
      </Animated.View>

      {/* Option Cards */}
      <View style={styles.cardsContainer}>
        {/* WiFi Sync Option */}
        <Animated.View entering={FadeInDown.delay(300).duration(700)}>
          <TouchableOpacity
            style={styles.card}
            onPress={onSyncChoose}
            activeOpacity={0.85}
          >
            <View style={styles.cardIconRow}>
              <View style={[styles.iconCircle, { backgroundColor: '#1a1a1a' }]}>
                <Wifi size={26} color="#fff" />
              </View>
              <View style={styles.cardBadge}>
                <Zap size={10} color="#000" />
                <AppText style={styles.badgeText} variant="caption" weight="bold" transform="uppercase" numberOfLines={1}>Instant</AppText>
              </View>
            </View>
            <AppText style={styles.cardTitle} variant="title" weight="bold" numberOfLines={2}>Sync from Desktop</AppText>
            <AppText style={styles.cardDesc} variant="body-sm" weight="medium" numberOfLines={3}>
              Connect to your Shega Desktop app via WiFi and instantly import all your business data.
            </AppText>
            <View style={styles.cardAction}>
              <AppText style={styles.cardActionText} variant="body" weight="bold" numberOfLines={1}>Connect via WiFi</AppText>
              <ArrowRight size={16} color="#000" />
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Register Option */}
        <Animated.View entering={FadeInDown.delay(500).duration(700)}>
          <TouchableOpacity
            style={[styles.card, styles.cardDark]}
            onPress={onRegisterChoose}
            activeOpacity={0.85}
          >
            <View style={styles.cardIconRow}>
              <View style={[styles.iconCircle, { backgroundColor: '#fff' }]}>
                <Store size={26} color="#000" />
              </View>
              <View style={[styles.cardBadge, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <AppText style={[styles.badgeText, { color: '#fff' }]} variant="caption" weight="bold" transform="uppercase" numberOfLines={1}>New</AppText>
              </View>
            </View>
            <AppText style={[styles.cardTitle, { color: '#fff' }]} variant="title" weight="bold" numberOfLines={2}>Register New Business</AppText>
            <AppText style={[styles.cardDesc, { color: 'rgba(255,255,255,0.6)' }]} variant="body-sm" weight="medium" numberOfLines={3}>
              Start fresh — set up your store, add inventory, and begin tracking sales from scratch.
            </AppText>
            <View style={[styles.cardAction, { backgroundColor: '#fff' }]}>
              <AppText style={[styles.cardActionText, { color: '#000' }]} variant="body" weight="bold" numberOfLines={1}>Get Started</AppText>
              <ArrowRight size={16} color="#000" />
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Footer */}
      <Animated.View entering={FadeIn.delay(800).duration(600)} style={styles.footer}>
        <AppText style={styles.footerText} variant="caption" weight="medium" numberOfLines={2}>
          You can always set up sync later from Settings
        </AppText>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },
  logo: {
    width: '65%',
    height: '65%',
  },
  title: {

    fontFamily: Fonts.extrabold,
    color: '#000',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {

    fontFamily: Fonts.regular,
    color: '#888',
    textAlign: 'center',
  },
  cardsContainer: {
    flex: 1,
    gap: 16,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#F5F5F5',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  cardDark: {
    backgroundColor: '#111',
    borderColor: '#222',
  },
  cardIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgeText: {

    fontFamily: Fonts.bold,
    color: '#000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardTitle: {

    fontFamily: Fonts.bold,
    color: '#000',
    marginBottom: 6,
  },
  cardDesc: {

    fontFamily: Fonts.regular,
    color: '#777',
    lineHeight: 19,
    marginBottom: 20,
  },
  cardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#000',
    paddingVertical: 14,
    borderRadius: 16,
  },
  cardActionText: {

    fontFamily: Fonts.bold,
    color: '#fff',
  },
  footer: {
    alignItems: 'center',
    paddingTop: 16,
  },
  footerText: {

    fontFamily: Fonts.regular,
    color: '#bbb',
    textAlign: 'center',
  },
});

export default WelcomeChoiceScreen;
