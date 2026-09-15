import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Building2, ChevronRight, Clock, Store, UserPlus, Users } from 'lucide-react-native';

import { AppText } from '@/components/ui';
import { useSettings } from '@/context/SettingsContext';
import { createBusiness, getBusinesses, getThisDeviceId } from '@/services/businessService';

/**
 * Progressive first-time setup for owners (spec §9/§10):
 * Account (done before this screen) → Create Business → Add Team (optional)
 * → Add Another Business (optional) → Dashboard. Every optional step can be
 * skipped; only Account → Business → Dashboard is required.
 */

type Stage = 'welcome' | 'business' | 'team' | 'another' | 'done';

const markDone = (key: string) => {
  SecureStore.setItemAsync(key, 'true').catch(() => {});
};

export default function SetupWizardScreen() {
  const { colors } = useSettings();
  const G = useMemo(
    () => ({
      bg: colors.background,
      fg: colors.text,
      muted: colors.textSecondary,
      card: colors.card,
      border: colors.border,
      accent: colors.primary,
    }),
    [colors],
  );

  const [stage, setStage] = useState<Stage>('welcome');
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [createdCount, setCreatedCount] = useState(0);

  const hasBusiness = getBusinesses().length > 0;

  const createNow = async () => {
    if (!businessName.trim() || !ownerName.trim()) {
      setError('Enter the business name and your name');
      return;
    }
    setSaving(true);
    setError('');
    try {
      createBusiness(
        { name: businessName.trim(), ownerName: ownerName.trim() },
        getThisDeviceId() ?? `dev-${Date.now().toString(36)}`,
      );
      markDone('setup_business_created');
      setCreatedCount((c) => c + 1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setBusinessName('');
      setOwnerName('');
      setStage('team');
    } catch (e: any) {
      setError(e?.message || 'Could not create the business');
    } finally {
      setSaving(false);
    }
  };

  const finish = (route: '/(tabs)/dashboard' | '/teams' = '/(tabs)/dashboard') => {
    markDone('setup_wizard_done');
    router.replace(route as any);
  };

  const PrimaryButton = ({ label, onPress, icon }: { label: string; onPress: () => void; icon?: React.ReactNode }) => (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={[styles.primaryBtn, { backgroundColor: G.fg }]}
    >
      {icon}
      <AppText variant="body" weight="bold" style={{ color: G.bg }}>{label}</AppText>
      <ChevronRight size={16} color={G.bg} />
    </TouchableOpacity>
  );

  const GhostButton = ({ label, onPress }: { label: string; onPress: () => void }) => (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={[styles.ghostBtn, { backgroundColor: G.card, borderColor: G.border }]}
    >
      <Clock size={15} color={G.muted} />
      <AppText variant="body" weight="bold" style={{ color: G.muted }}>{label}</AppText>
    </TouchableOpacity>
  );

  const StepBadge = ({ step, total }: { step: number; total: number }) => (
    <View style={styles.stepRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[styles.stepDot, { backgroundColor: i < step ? G.accent : G.border }]} />
      ))}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: G.bg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {stage === 'welcome' && (
            <Animated.View entering={FadeInDown.duration(350)} style={styles.stage}>
              <View style={[styles.iconCircle, { backgroundColor: G.card, borderColor: G.border }]}>
                <SparklesIcon color={G.accent} />
              </View>
              <AppText variant="display" weight="bold" align="center" style={{ color: G.fg }}>
                Welcome to Shega!
              </AppText>
              <AppText variant="body" weight="medium" align="center" style={{ color: G.muted, marginTop: 10 }}>
                Your account is ready. Let's set up your business in a few quick steps — it takes less than a minute.
              </AppText>
              <View style={{ marginTop: 28 }}>
                <PrimaryButton label="Get Started" onPress={() => setStage('business')} icon={<Store size={17} color={G.bg} />} />
              </View>
              <StepBadge step={0} total={3} />
            </Animated.View>
          )}

          {stage === 'business' && (
            <Animated.View entering={FadeInDown.duration(350)} style={styles.stage}>
              <View style={[styles.iconCircle, { backgroundColor: G.card, borderColor: G.border }]}>
                <Building2 size={26} color={G.accent} />
              </View>
              <AppText variant="display" weight="bold" align="center" style={{ color: G.fg }}>
                {createdCount > 0 ? 'Add another business' : 'Create your business'}
              </AppText>
              <AppText variant="body" weight="medium" align="center" style={{ color: G.muted, marginTop: 10 }}>
                {createdCount > 0
                  ? 'Give this business a name — you can switch between businesses anytime.'
                  : 'Name your business and we\'ll make you the owner.'}
              </AppText>
              <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted, marginTop: 24, marginBottom: 6 }}>
                Business name
              </AppText>
              <TextInput
                style={[styles.input, { borderColor: G.border, color: G.fg, backgroundColor: G.card }]}
                placeholder="e.g. Shega Coffee Shop"
                placeholderTextColor={G.muted}
                value={businessName}
                onChangeText={(v) => { setBusinessName(v); setError(''); }}
                autoCapitalize="words"
              />
              <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted, marginTop: 14, marginBottom: 6 }}>
                Your name
              </AppText>
              <TextInput
                style={[styles.input, { borderColor: G.border, color: G.fg, backgroundColor: G.card }]}
                placeholder="e.g. Abebe Kebede"
                placeholderTextColor={G.muted}
                value={ownerName}
                onChangeText={(v) => { setOwnerName(v); setError(''); }}
                autoCapitalize="words"
              />
              {!!error && (
                <AppText variant="caption" weight="bold" style={{ color: '#e74c3c', marginTop: 8 }}>{error}</AppText>
              )}
              <View style={{ marginTop: 24 }}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={saving}
                  onPress={createNow}
                  style={[styles.primaryBtn, { backgroundColor: G.fg, opacity: saving ? 0.6 : 1 }]}
                >
                  <Store size={17} color={G.bg} />
                  <AppText variant="body" weight="bold" style={{ color: G.bg }}>
                    {saving ? 'Creating…' : 'Create Business'}
                  </AppText>
                  <ChevronRight size={16} color={G.bg} />
                </TouchableOpacity>
              </View>
              {(hasBusiness || createdCount > 0) && (
                <View style={{ marginTop: 12 }}>
                  <GhostButton label="Skip for now" onPress={() => setStage('team')} />
                </View>
              )}
              <StepBadge step={1} total={3} />
            </Animated.View>
          )}

          {stage === 'team' && (
            <Animated.View entering={FadeInDown.duration(350)} style={styles.stage}>
              <View style={[styles.iconCircle, { backgroundColor: G.card, borderColor: G.border }]}>
                <Users size={26} color={G.accent} />
              </View>
              <AppText variant="display" weight="bold" align="center" style={{ color: G.fg }}>
                Add your team
              </AppText>
              <AppText variant="body" weight="medium" align="center" style={{ color: G.muted, marginTop: 10 }}>
                Invite cashiers and staff with a QR code. They join by scanning — you approve and assign their role.
              </AppText>
              <View style={{ marginTop: 28 }}>
                <PrimaryButton
                  label="Add Users Now"
                  onPress={() => {
                    markDone('setup_wizard_done');
                    router.replace('/teams' as any);
                  }}
                  icon={<UserPlus size={17} color={G.bg} />}
                />
              </View>
              <View style={{ marginTop: 12 }}>
                <GhostButton label="I'll Do This Later" onPress={() => setStage('another')} />
              </View>
              <StepBadge step={2} total={3} />
            </Animated.View>
          )}

          {stage === 'another' && (
            <Animated.View entering={FadeInDown.duration(350)} style={styles.stage}>
              <View style={[styles.iconCircle, { backgroundColor: G.card, borderColor: G.border }]}>
                <Building2 size={26} color={G.accent} />
              </View>
              <AppText variant="display" weight="bold" align="center" style={{ color: G.fg }}>
                Do you have another business?
              </AppText>
              <AppText variant="body" weight="medium" align="center" style={{ color: G.muted, marginTop: 10 }}>
                You can manage multiple businesses from this one account and switch between them anytime.
              </AppText>
              <View style={{ marginTop: 28 }}>
                <PrimaryButton label="Add Another Business" onPress={() => setStage('business')} icon={<Building2 size={17} color={G.bg} />} />
              </View>
              <View style={{ marginTop: 12 }}>
                <GhostButton label="Do This Later" onPress={() => setStage('done')} />
              </View>
              <StepBadge step={2} total={3} />
            </Animated.View>
          )}

          {stage === 'done' && (
            <Animated.View entering={FadeInUp.duration(350)} style={styles.stage}>
              <View style={[styles.iconCircle, { backgroundColor: G.card, borderColor: G.border }]}>
                <SparklesIcon color={G.accent} />
              </View>
              <AppText variant="display" weight="bold" align="center" style={{ color: G.fg }}>
                You're all set!
              </AppText>
              <AppText variant="body" weight="medium" align="center" style={{ color: G.muted, marginTop: 10 }}>
                You can add team members, more businesses, and fine-tune everything from Settings whenever you're ready.
              </AppText>
              <View style={{ marginTop: 28 }}>
                <PrimaryButton label="Go to Dashboard" onPress={() => finish()} icon={<Store size={17} color={G.bg} />} />
              </View>
              <StepBadge step={3} total={3} />
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const SparklesIcon = ({ color }: { color: string }) => (
  <Store size={26} color={color} />
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 24 },
  stage: { alignItems: 'center' },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 20,
  },
  input: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 15,
    borderRadius: 999,
  },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  stepRow: { flexDirection: 'row', gap: 6, marginTop: 32 },
  stepDot: { width: 22, height: 4, borderRadius: 2 },
});
