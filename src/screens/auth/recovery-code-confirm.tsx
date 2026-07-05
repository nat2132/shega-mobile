import React, { useState, useEffect } from 'react';
import { Fonts } from '@/constants/theme';
import {
  StyleSheet,
  View,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyRound, ShieldCheck, Copy, ChevronRight} from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import { AppText } from '@/components/ui';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { generateRecoveryCode, storeRecoveryCodeHash } from '@/services/recovery';
import { getAuthGlass } from './glass-auth';

interface RecoveryCodeConfirmScreenProps {
  onConfirm: () => void;
}

const RecoveryCodeConfirmScreen: React.FC<RecoveryCodeConfirmScreenProps> = ({ onConfirm }) => {
  const { setRecoveryCodeExists, colors } = useSettings();
  const G = getAuthGlass(colors);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    generateRecoveryCode().then(async (code) => {
      setRecoveryCode(code);
      await storeRecoveryCodeHash(code);
      setRecoveryCodeExists(true);
    });
  }, [setRecoveryCodeExists]);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(recoveryCode);
    setCopied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: G.bg }]}>
      <View style={StyleSheet.absoluteFill}>
        <View style={[styles.glowNode, { top: -100, right: -100, backgroundColor: G.fg, opacity: 0.05 }]} />
        <View style={[styles.glowNode, { bottom: -60, left: -80, backgroundColor: G.fg, opacity: 0.03 }]} />
        <View style={[styles.glowNode, { top: '40%', left: '30%', backgroundColor: G.fg, opacity: 0.02 }]} />
      </View>

      <Animated.View entering={FadeIn.duration(800)} style={styles.content}>
        <View style={styles.iconNode}>
          <View style={[styles.shieldRing, { backgroundColor: G.border, borderColor: G.border }]}>
            <KeyRound size={40} color={G.fg} strokeWidth={1.5} />
          </View>
        </View>

        <Animated.View entering={FadeInDown.delay(200).duration(800)} style={styles.textNode}>
          <AppText style={[styles.title, { color: G.fg }]} variant="display" weight="bold" numberOfLines={2}>
            Recovery Code
          </AppText>
          <AppText style={[styles.subtitle, { color: G.fgSecondary }]} variant="body" weight="medium" numberOfLines={4}>
            This is your unique recovery code. Save it somewhere safe.{'\n'}
            If you forget your PIN, this code is the only way to regain access.
          </AppText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(800)} style={styles.codeContainer}>
          <View style={[styles.codeRow, { backgroundColor: G.bgCard }]}>
            <AppText style={[styles.codeText, { color: G.fg }]} variant="display" weight="bold" numberOfLines={1}>
              {recoveryCode}
            </AppText>
            <TouchableOpacity style={[styles.copyBtn, { backgroundColor: G.bg, borderColor: G.border }]} onPress={handleCopy} activeOpacity={0.7}>
              <Copy size={20} color={copied ? G.fgSecondary : G.fg} />
            </TouchableOpacity>
          </View>
          {copied && (
            <AppText variant="caption" weight="bold" style={[styles.copiedText, { color: G.fgSecondary }]} numberOfLines={1}>
              Copied to clipboard!
            </AppText>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(600).duration(800)} style={[styles.warningNode, { backgroundColor: G.bgCard }]}>
          <ShieldCheck size={16} color={G.fgSecondary} />
          <AppText variant="body-sm" weight="semibold" style={[styles.warningText, { color: G.fgSecondary }]} numberOfLines={3}>
            This code will only be shown once. Write it down or save it securely before proceeding.
          </AppText>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(800).duration(800)} style={styles.actionCluster}>
          <TouchableOpacity
            style={[
              styles.confirmBtn,
              { backgroundColor: confirmed ? G.fg : G.border },
            ]}
            disabled={!confirmed}
            onPress={onConfirm}
            activeOpacity={0.8}
          >
            <AppText
              style={[styles.confirmBtnText, { color: confirmed ? G.bg : G.fgSecondary }]}
              variant="body"
              weight="bold"
              numberOfLines={1}
            >
              PROCEED TO TERMINAL
            </AppText>
            {confirmed && <ChevronRight size={20} color={G.bg} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => setConfirmed(!confirmed)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, { borderColor: G.fgSecondary }, confirmed && [styles.checkboxActive, { backgroundColor: G.fg, borderColor: G.fg }]]}>
              {confirmed && <View style={[styles.checkInner, { backgroundColor: G.bg }]} />}
            </View>
            <AppText variant="body-sm" weight="semibold" style={[styles.checkLabel, { color: G.fgSecondary }]} numberOfLines={2}>
              I have saved my recovery code securely
            </AppText>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  glowNode: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconNode: {
    marginBottom: 40,
  },
  shieldRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textNode: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontFamily: Fonts.extrabold,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: Fonts.medium,
  },
  codeContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 30,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 12,
  },
  codeText: {
    fontFamily: Fonts.bold,
    letterSpacing: 3,
    fontSize: 22,
  },
  copyBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  copiedText: {
    marginTop: 8,
    fontFamily: Fonts.bold,
  },
  warningNode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
    marginBottom: 40,
    width: '100%',
  },
  warningText: {
    fontFamily: Fonts.semibold,
    flex: 1,
  },
  actionCluster: {
    width: '100%',
    alignItems: 'center',
  },
  confirmBtn: {
    flexDirection: 'row',
    width: '100%',
    height: 64,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  confirmBtnText: {
    fontFamily: Fonts.bold,
    letterSpacing: 1.2,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
  },
  checkInner: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  checkLabel: {
    fontFamily: Fonts.semibold,
    flex: 1,
  },
});

export default RecoveryCodeConfirmScreen;