import { router } from 'expo-router';
import React from 'react';
import FirstLanguageScreen from '../src/screens/onboarding/first-language';

export default function LanguageSelectRoute() {
  return (
    <FirstLanguageScreen
      onContinue={() => router.replace('/welcome-choice' as any)}
    />
  );
}