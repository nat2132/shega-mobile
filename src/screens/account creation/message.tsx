import React from 'react';
import { Fonts } from '@/constants/theme';
import {
  StyleSheet,
  Text as RNText,
  View,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { CheckCircle2, Sparkles, ChevronRight, LayoutDashboard, Send } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

interface SuccessScreenProps {
  onGoToDashboard?: () => void;
}

const SuccessScreen: React.FC<SuccessScreenProps> = ({ onGoToDashboard }) => {
  return (
    <SafeAreaView style={styles.container}>
      {/* Background Ambience */}
      <View style={StyleSheet.absoluteFill}>
        <View style={[styles.glowNode, { top: -100, right: -100, backgroundColor: '#000', opacity: 0.05 }]} />
        <View style={[styles.glowNode, { bottom: -100, left: -100, backgroundColor: '#000', opacity: 0.03 }]} />
      </View>

      <View style={styles.content}>
        <Animated.View entering={FadeInDown.duration(800)} style={styles.visualOrchestration}>
          <View style={styles.successNode}>
            <View style={styles.mainCircle}>
               <CheckCircle2 size={56} color="#FFF" strokeWidth={1.5} />
               <View style={styles.sparkleBadge}>
                  <Sparkles size={16} color="#000" />
               </View>
            </View>
            <View style={styles.pulseRing} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(800)} style={styles.briefingArea}>
          <RNText style={styles.title}>System Ready</RNText>
          <RNText style={styles.subtitle}>
            Your curatorial environment is fully initialized.{'\n'}Welcome to the professional terminal.
          </RNText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(800)} style={styles.actionArea}>
          <TouchableOpacity 
            style={styles.primaryActionBtn} 
            activeOpacity={0.8} 
            onPress={onGoToDashboard}
          >
            <RNText style={styles.btnText}>ENTER TERMINAL</RNText>
            <LayoutDashboard size={20} color="#FFF" />
          </TouchableOpacity>

          <View style={styles.statusIndicator}>
             <View style={styles.statusDot} />
             <RNText style={styles.statusText}>ALL SYSTEMS NOMINAL</RNText>
          </View>
        </Animated.View>
      </View>

      {/* Footer Branding */}
      <Animated.View entering={FadeInUp.delay(600).duration(800)} style={styles.footerBranding}>
         <RNText style={styles.footerTag}>ESTABLISHED SECURE SESSION • AES-256</RNText>
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
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  sparkleBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  pulseRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.05)',
    zIndex: 1,
  },
  briefingArea: {
    alignItems: 'center',
    marginBottom: 60,
  },
  title: {
    fontSize: 40,
    fontFamily: Fonts.extrabold,
    fontWeight: '800',
    color: '#000',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#777',
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
    backgroundColor: '#000',
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
    color: '#FFF',
    fontSize: 16,
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
    backgroundColor: '#10B981', // Emerald green
  },
  statusText: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: '#888',
    letterSpacing: 1,
  },
  footerBranding: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  footerTag: {
    fontSize: 9,
    fontFamily: Fonts.bold,
    color: '#BBB',
    letterSpacing: 1.5,
  },
});

export default SuccessScreen;