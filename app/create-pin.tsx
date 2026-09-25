import { router, useLocalSearchParams } from 'expo-router';
import CreatePinScreen from '../src/screens/account creation/create-pin';

/**
 * Dedicated PIN Setup onboarding step.
 *
 * Reached from the setup wizard's post-setup splash (`?from=onboarding`), i.e.
 * AFTER account signup + business setup are complete — never inside the signup
 * form. Creating and confirming the PIN here persists it locally (the screen
 * stores the device PIN hash via SettingsContext; we then mirror it onto the
 * business owner row) so future sign-ins use it, then the app opens.
 *
 * Skipping is allowed: the user lands in the app and the business sign-in gate
 * offers first-time username+PIN setup. The recovery-code detour only applies
 * to the non-onboarding path.
 */
export default function CreatePin() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const fromOnboarding = from === 'onboarding';

  return (
    <CreatePinScreen
      onConfirm={(pin) => {
        if (fromOnboarding) {
          // Bind the same PIN to the business owner so the business sign-in
          // gate (username + PIN) and manager approvals accept it immediately.
          (async () => {
            try {
              const {
                getBusinesses, getDefaultBusiness, getOwnerOfBusiness, setUserPin, setCurrentUserId,
              } = await import('../src/services/businessService');
              const active = getDefaultBusiness() ?? getBusinesses()[0];
              const owner = active ? getOwnerOfBusiness(active.id) : null;
              if (owner) {
                setUserPin(owner.id, pin);
                setCurrentUserId(owner.id);
              }
            } catch (e) {
              // Device-wide PIN hash is already stored by the screen itself;
              // a failed owner-row mirror must not block entering the app.
              console.warn('[create-pin] owner PIN mirror failed', e);
            }
            router.replace('/(tabs)/dashboard' as never);
          })();
          return;
        }
        router.replace('/recovery-code');
      }}
      onSkip={() => {
        if (fromOnboarding) {
          router.replace('/(tabs)/dashboard' as never);
          return;
        }
        router.replace('/message');
      }}
    />
  );
}
