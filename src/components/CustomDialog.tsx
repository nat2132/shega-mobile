// CustomDialog — the single themed alert / confirm / choice modal used by
// `useDialog()`. Three modes share one card so screens never have to
// hand-roll an `Alert.alert(...)` or a `Modal` again:
//
//   1. `kind: 'alert'`   — single "OK" button, dismisses.
//   2. `kind: 'confirm'` — two buttons, returns a boolean via the resolver.
//   3. `kind: 'choice'`  — list of tappable choices plus a Cancel row.
//
// The component is a controlled presentational component. State, queueing
// and the `Promise<...>` resolvers all live in `DialogContext`.

import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
} from 'lucide-react-native';
import { BorderRadius, Fonts, Spacing } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { AppText } from './AppText';

export type CustomDialogIconType = 'success' | 'danger' | 'warning' | 'info';

export interface CustomDialogChoice {
  label: string;
  onPress?: () => void;
  destructive?: boolean;
}

export interface CustomDialogState {
  kind: 'alert' | 'confirm' | 'choice';
  title?: string;
  message?: string;
  iconType?: CustomDialogIconType;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  choices?: CustomDialogChoice[];
}

export interface CustomDialogProps {
  visible: boolean;
  state: CustomDialogState | null;
  onCancel: () => void;
  onConfirm: () => void;
  onChoose: (choice: CustomDialogChoice) => void;
}

const ICON_BG: Record<CustomDialogIconType, string> = {
  success: 'rgba(52, 199, 89, 0.12)',
  danger: 'rgba(255, 59, 48, 0.12)',
  warning: 'rgba(255, 149, 0, 0.14)',
  info: 'rgba(47, 111, 237, 0.12)',
};

const ICON_COLOR: Record<CustomDialogIconType, string> = {
  success: '#34C759',
  danger: '#FF3B30',
  warning: '#FF9500',
  info: '#2F6FED',
};

const ICON_SIZE = 28;

function DialogIcon({ type }: { type?: CustomDialogIconType }) {
  if (!type) return null;
  const color = ICON_COLOR[type];
  const bg = ICON_BG[type];
  switch (type) {
    case 'success':
      return (
        <View style={[styles.iconCircle, { backgroundColor: bg }]}>
          <CheckCircle2 size={ICON_SIZE} color={color} />
        </View>
      );
    case 'danger':
      return (
        <View style={[styles.iconCircle, { backgroundColor: bg }]}>
          <AlertCircle size={ICON_SIZE} color={color} />
        </View>
      );
    case 'warning':
      return (
        <View style={[styles.iconCircle, { backgroundColor: bg }]}>
          <AlertTriangle size={ICON_SIZE} color={color} />
        </View>
      );
    case 'info':
    default:
      return (
        <View style={[styles.iconCircle, { backgroundColor: bg }]}>
          <Info size={ICON_SIZE} color={color} />
        </View>
      );
  }
}

const CustomDialog: React.FC<CustomDialogProps> = ({
  visible,
  state,
  onCancel,
  onConfirm,
  onChoose,
}) => {
  const { colors, t } = useSettings();

  if (!state) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        {/* Inner pressable swallows the press so it doesn't dismiss when
            the user taps the card itself. */}
        <Pressable
          onPress={() => {}}
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <DialogIcon type={state.iconType} />

          {state.title ? (
            <AppText
              variant="title"
              weight="bold"
              numberOfLines={2}
              style={[styles.title, { color: colors.text }]}
            >
              {state.title}
            </AppText>
          ) : null}

          {state.message ? (
            <AppText
              variant="body"
              weight="medium"
              numberOfLines={6}
              style={[styles.message, { color: colors.textSecondary }]}
            >
              {state.message}
            </AppText>
          ) : null}

          {state.kind === 'choice' ? (
            <View style={styles.choiceList}>
              {state.choices?.map((choice, idx) => (
                <Pressable
                  key={`${choice.label}-${idx}`}
                  onPress={() => onChoose(choice)}
                  style={({ pressed }) => [
                    styles.choiceRow,
                    {
                      backgroundColor: pressed
                        ? colors.background
                        : 'transparent',
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <AppText
                    variant="body"
                    weight="bold"
                    numberOfLines={1}
                    color={choice.destructive ? colors.error : colors.primary}
                  >
                    {choice.label}
                  </AppText>
                </Pressable>
              ))}
            </View>
          ) : null}

          {state.kind === 'alert' ? (
            <View style={[styles.actions, styles.actionsStack]}>
              <Pressable
                onPress={onConfirm}
                style={({ pressed }) => [
                  styles.btn,
                  {
                    backgroundColor: state.destructive
                      ? colors.error
                      : colors.primary,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <AppText
                  variant="label"
                  weight="bold"
                  numberOfLines={1}
                  color={colors.background}
                >
                  {state.confirmText ?? t('common.ok')}
                </AppText>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.actions, styles.actionsRow]}>
              <Pressable
                onPress={onCancel}
                style={({ pressed }) => [
                  styles.btn,
                  styles.btnSecondary,
                  styles.btnFlex,
                  {
                    borderColor: colors.border,
                    backgroundColor: pressed
                      ? colors.background
                      : 'transparent',
                  },
                ]}
              >
                <AppText
                  variant="label"
                  weight="bold"
                  numberOfLines={1}
                  color={colors.text}
                >
                  {state.cancelText ?? t('common.cancel')}
                </AppText>
              </Pressable>
              {state.kind === 'confirm' ? (
                <Pressable
                  onPress={onConfirm}
                  style={({ pressed }) => [
                    styles.btn,
                    styles.btnFlex,
                    {
                      backgroundColor: state.destructive
                        ? colors.error
                        : colors.primary,
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                >
                  <AppText
                    variant="label"
                    weight="bold"
                    numberOfLines={1}
                    color={colors.background}
                  >
                    {state.confirmText ?? t('common.confirm')}
                  </AppText>
                </Pressable>
              ) : null}
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

CustomDialog.displayName = 'CustomDialog';

export default CustomDialog;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    textAlign: 'center',
    marginBottom: Spacing.xs,
    fontFamily: Fonts.bold,
  },
  message: {
    textAlign: 'center',
    marginBottom: Spacing.md,
    fontFamily: Fonts.regular,
  },
  choiceList: {
    width: '100%',
    marginBottom: Spacing.md,
  },
  choiceRow: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    width: '100%',
    marginTop: Spacing.xs,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionsStack: {
    flexDirection: 'column',
  },
  btn: {
    minHeight: 44,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondary: {
    borderWidth: 1,
  },
  btnFlex: {
    flex: 1,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
