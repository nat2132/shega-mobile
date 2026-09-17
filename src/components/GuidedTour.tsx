/**
 * First-time guided tour — max 4 steps, skippable, never forced.
 * Shown once after onboarding completes (flag stored in SecureStore).
 */

import React, { useState } from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { BarChart3, Package, QrCode, ShoppingCart } from 'lucide-react-native';
import { AppText } from '@/components/ui';
import { useSettings } from '@/context/SettingsContext';
import { getGlass } from '@/screens/onboarding/glass-theme';

const STEPS = [
  { icon: Package, title: 'Inventory', body: 'Add and manage your products.' },
  { icon: ShoppingCart, title: 'Sales', body: 'Scan or search for products and complete sales quickly.' },
  { icon: QrCode, title: 'POS Hub', body: 'Connect your phone, desktop, and other devices.' },
  { icon: BarChart3, title: 'Reports', body: 'Understand how your business is performing.' },
];

export const TOUR_DONE_KEY = 'guided_tour_done';

export async function shouldShowTour(): Promise<boolean> {
  try {
    const SecureStore = await import('expo-secure-store');
    return (await SecureStore.getItemAsync(TOUR_DONE_KEY)) !== 'true';
  } catch { return false; }
}

export const GuidedTour: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { colors } = useSettings();
  const G = getGlass(colors);
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  const Icon = s.icon;

  const close = () => {
    import('expo-secure-store').then((SecureStore) =>
      SecureStore.setItemAsync(TOUR_DONE_KEY, 'true').catch(() => {})
    );
    onDone();
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={close}>
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
        <Animated.View entering={FadeInDown.springify().damping(18)} style={[styles.card, { backgroundColor: G.bgCard, borderColor: G.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: G.accentGlass }]}>
            <Icon size={30} color={G.fg} strokeWidth={2.2} />
          </View>
          <AppText variant="title" weight="bold" style={{ color: G.fg, marginTop: 14 }}>
            {s.title}
          </AppText>
          <AppText variant="body" weight="medium" align="center" style={{ color: G.muted, marginTop: 8, paddingHorizontal: 12 }}>
            {s.body}
          </AppText>

          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <View key={i} style={[styles.dot, { backgroundColor: i <= step ? G.accent : G.border }]} />
            ))}
          </View>

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: G.fg }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (step < STEPS.length - 1) setStep(step + 1);
              else close();
            }}
          >
            <AppText variant="body" weight="bold" style={{ color: G.bg }}>
              {step < STEPS.length - 1 ? 'Next' : 'Got it'}
            </AppText>
          </TouchableOpacity>
          <TouchableOpacity onPress={close} hitSlop={10} style={{ marginTop: 12 }}>
            <AppText variant="caption" weight="bold" style={{ color: G.muted }}>Skip Tour</AppText>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: { borderRadius: 28, borderWidth: 1, padding: 28, width: '100%', maxWidth: 380, alignItems: 'center' },
  iconWrap: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 6, marginTop: 22, marginBottom: 20 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  btn: { width: '100%', alignItems: 'center', paddingVertical: 15, borderRadius: 999 },
});

export default GuidedTour;
