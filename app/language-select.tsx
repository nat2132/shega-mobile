import { router } from 'expo-router';
import React from 'react';
import FirstLanguageScreen from '../src/screens/onboarding/first-language';

export default function LanguageSelectRoute() {
  return (
    <FirstLanguageScreen
      // Language first, then the start screen: create a business / join a
      // business / log in. Each path continues into its own onboarding
      // (the wizard receives a signed-in identity via /setup-wizard?from=register).
      onContinue={() => router.replace('/start-choice' as any)}
    />
  );
}
