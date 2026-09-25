import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BusinessManagement } from '../src/screens/settings/business/BusinessManagement';
import { safeBackOrFallback } from '../src/services/navigation';

/**
 * Route wrapper for the sidebar's "Business Center" entry.
 *
 * The sidebar navigates to `/business-center`, but no such route existed, so
 * the tap produced "no route matched". BusinessManagement already renders its
 * own header + close button, so this only supplies the safe-area inset and the
 * back behaviour.
 */
export default function BusinessCenterPage() {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <BusinessManagement onClose={() => safeBackOrFallback('/(tabs)/dashboard')} />
    </SafeAreaView>
  );
}
