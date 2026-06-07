import React, { useCallback } from 'react';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import SettingsScreen from '../../src/screens/settings/settings';
import { useNavigationIntent } from '@/context/NavigationIntentContext';
import { useToast } from '@/context/ToastContext';
import { useSettings } from '@/context/SettingsContext';

export default function SettingsTabRoute() {
  const { consumeIntent } = useNavigationIntent();
  const { showToast } = useToast();
  const { t } = useSettings();

  useFocusEffect(
    useCallback(() => {
      const intent = consumeIntent();
      if (intent?.kind === 'subscription') {
        setTimeout(() => {
          showToast(t('notif.subscription_renew') || 'Renew your subscription in Settings → License.', 'info');
        }, 200);
      }
    }, [consumeIntent, showToast, t]),
  );

  return (
    <Animated.View entering={FadeIn.duration(300)} style={{ flex: 1 }}>
      <SettingsScreen />
    </Animated.View>
  );
}
