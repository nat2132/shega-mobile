import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSubscription } from '@/context/SubscriptionContext';
import { useSettings } from '@/context/SettingsContext';

/**
 * Guard for write actions.
 *
 * Returns `guard()`, which yields `true` when the action may proceed. When the
 * subscription has lapsed it shows the renew prompt and yields `false`, so a
 * caller can bail out early:
 *
 *   const { guard } = useWriteGuard();
 *   const onSave = () => {
 *     if (!guard()) return;
 *     save();
 *   };
 */
export function useWriteGuard() {
  const { requireWrite, isReadOnly, writeAccess } = useSubscription();
  const { t } = useSettings();
  const router = useRouter();

  const promptRenew = useCallback(() => {
    Alert.alert(
      t('subscription.expired_title'),
      t('subscription.expired_desc'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('subscription.renew_now'),
          onPress: () => router.push('/subscription/renewal'),
        },
      ],
    );
  }, [t, router]);

  const guard = useCallback(() => {
    if (requireWrite()) return true;
    promptRenew();
    return false;
  }, [requireWrite, promptRenew]);

  return { guard, canWrite: requireWrite, isReadOnly, writeAccess };
}
