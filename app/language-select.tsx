import { router } from 'expo-router';
import React from 'react';
import FirstLanguageScreen from '../src/screens/onboarding/first-language';

export default function LanguageSelectRoute() {
  return (
    <FirstLanguageScreen
      // Signup-first onboarding: language is chosen, then the user creates
      // their account BEFORE any business setup. The wizard receives the
      // signed-in identity via /setup-wizard?from=register.
      onContinue={() => router.replace('/register' as any)}
    />
  );
}