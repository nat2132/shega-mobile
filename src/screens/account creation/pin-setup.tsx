import React from 'react';
import { Fonts } from '@/constants/theme';
import {
  StyleSheet,
  Text as RNText,
  View,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  Platform
} from 'react-native';
import { ShieldCheck, Lock, ChevronRight, Fingerprint, ShieldAlert } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

interface SecuritySetupScreenProps {
  onSetPin?: () => void;
  onSkip?: () => void;
}

const SecuritySetupScreen: React.FC<SecuritySetupScreenProps> = ({ onSetPin, onSkip }) => {
  return (
    <SafeAreaView style={styles.container}>
      {/* Background Decor */}
      <View style={StyleSheet.absoluteFill}>
        <View style={[styles.glowNode, { top: -150, left: -100, backgroundColor: '#000', opacity: 0.05 }]} />
      </View>

      <View style={styles.mainContent}>
        <Animated.View entering={FadeInDown.duration(800)} style={styles.visualOrchestration}>
          <View style={styles.protectionNode}>
            <View style={styles.shieldRing}>
               <ShieldCheck size={56} color="#000" strokeWidth={1.5} />
               <View style={styles.lockBadge}>
                  <Lock size={12} color="#FFF" strokeWidth={2.5} />
               </View>
            </View>
            <View style={styles.pulseRing} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(800)} style={styles.textNode}>
          <RNText style={styles.title}>Defend Your Ledger</RNText>
          <RNText style={styles.subtitle}>
            Establish a hardware-encrypted PIN protocol{'\n'}to secure your private inventory vault.
          </RNText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(800)} style={styles.actionCluster}>
          <TouchableOpacity 
            style={styles.primaryBtn} 
            activeOpacity={0.8} 
            onPress={onSetPin}
          >
            <RNText style={styles.primaryBtnText}>ESTABLISH PROTOCOL</RNText>
            <ChevronRight size={20} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={onSkip} activeOpacity={0.6}>
            <RNText style={styles.secondaryBtnText}>Skip and proceed to terminal</RNText>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Orchestration Meta */}
      <Animated.View entering={FadeInUp.delay(600).duration(800)} style={styles.metaNode}>
        <View style={styles.securitySeal}>
           <ShieldAlert size={14} color="#999" />
           <RNText style={styles.sealText}>LOCALLY ENCRYPTED SECURE STORAGE</RNText>
        </View>
        <View style={styles.pagination}>
          <View style={[styles.dot, styles.activeDot]} />
          <View style={[styles.dot, { backgroundColor: '#F0F0F0' }]} />
        </View>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  glowNode: {
    position: 'absolute',
    width: 400,
    height: 400,
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
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
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
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
  },
  pulseRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    zIndex: 1,
  },
  textNode: {
    alignItems: 'center',
    marginBottom: 60,
  },
  title: {
    fontSize: 32,
    fontFamily: Fonts.extrabold,
    fontWeight: '800',
    color: '#000',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
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
    backgroundColor: '#000',
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
    color: '#FFF',
    fontSize: 16,
    fontFamily: Fonts.bold,
    letterSpacing: 1.2,
  },
  secondaryBtn: {
    paddingVertical: 12,
  },
  secondaryBtnText: {
    fontSize: 14,
    color: '#999',
    fontFamily: Fonts.semibold,
  },
  metaNode: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  securitySeal: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 25,
    gap: 8,
  },
  sealText: {
    fontSize: 9,
    fontFamily: Fonts.bold,
    color: '#999',
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
    backgroundColor: '#000',
    width: 24,
  },
});

export default SecuritySetupScreen;