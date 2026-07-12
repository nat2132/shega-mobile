import { useTutorialContext } from './TutorialContext';
import { GraduationCap } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { AppText } from '@/components/ui';
import { useSettings } from '@/context/SettingsContext';
import { BorderRadius, Spacing } from '@/constants/theme';
import { usePathname } from 'expo-router';

interface TutorialButtonProps {
  tutorialId: string;
  screenName: string;
}

export const TutorialButton: React.FC<TutorialButtonProps> = ({ tutorialId, screenName }) => {
  const { colors } = useSettings();
  const ctx = useTutorialContext();
  const [showMenu, setShowMenu] = useState(false);

  const isCompleted = ctx.isTutorialCompleted(tutorialId);
  const progress = ctx.getTutorialProgress(tutorialId);

  const handleStart = useCallback(() => {
    setShowMenu(false);
    ctx.startTutorial(tutorialId);
  }, [ctx, tutorialId]);

  const handleReset = useCallback(() => {
    setShowMenu(false);
    ctx.resetTutorialProgress(tutorialId);
    ctx.startTutorial(tutorialId);
  }, [ctx, tutorialId]);

  if (ctx.isActive) return null;

  return (
    <>
      <TouchableOpacity
        onPress={() => setShowMenu(true)}
        style={[styles.fab, { backgroundColor: colors.card, borderColor: colors.border }]}
        activeOpacity={0.8}
      >
        <GraduationCap size={18} color={colors.tint} />
      </TouchableOpacity>

      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowMenu(false)}>
          <Animated.View
            entering={FadeInDown.springify().damping(15)}
            exiting={FadeOut.duration(150)}
            style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={[styles.menuIcon, { backgroundColor: colors.tint + '20' }]}>
              <GraduationCap size={24} color={colors.tint} />
            </View>
            <AppText variant="body" weight="bold" color={colors.text} style={styles.menuTitle}>
              {screenName} Tutorial
            </AppText>
            <AppText variant="caption" weight="regular" color={colors.textSecondary} style={styles.menuDesc}>
              {isCompleted
                ? 'You completed this tutorial! Take a refresher or restart.'
                : progress
                  ? `Continue from step ${progress.currentStepIndex + 1}`
                  : 'Learn how to use this screen step by step.'}
            </AppText>

            <View style={styles.menuActions}>
              {progress && !isCompleted ? (
                <TouchableOpacity
                  onPress={handleStart}
                  style={[styles.menuBtn, { backgroundColor: colors.tint }]}
                >
                  <AppText variant="label" weight="semibold" color={colors.background}>
                    Continue ({progress.currentStepIndex + 1}/{ctx.getTutorialStepsCount(tutorialId)})
                  </AppText>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={handleStart}
                  style={[styles.menuBtn, { backgroundColor: colors.tint }]}
                >
                  <AppText variant="label" weight="semibold" color={colors.background}>
                    Start Tutorial
                  </AppText>
                </TouchableOpacity>
              )}

              {isCompleted && (
                <TouchableOpacity
                  onPress={handleReset}
                  style={[styles.menuBtnSecondary, { borderColor: colors.border }]}
                >
                  <AppText variant="label" weight="semibold" color={colors.text}>
                    Restart
                  </AppText>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              onPress={() => setShowMenu(false)}
              style={[styles.menuCancel, { borderTopColor: colors.border }]}
            >
              <AppText variant="label" weight="medium" color={colors.textSecondary}>
                Cancel
              </AppText>
            </TouchableOpacity>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
};

export default TutorialButton;

const styles = StyleSheet.create({
  fab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  menuCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  menuIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  menuTitle: {
    textAlign: 'center',
    marginBottom: 6,
  },
  menuDesc: {
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  menuActions: {
    width: '100%',
    gap: 8,
  },
  menuBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBtnSecondary: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  menuCancel: {
    width: '100%',
    paddingTop: 16,
    marginTop: 12,
    borderTopWidth: 1,
    alignItems: 'center',
  },
});
