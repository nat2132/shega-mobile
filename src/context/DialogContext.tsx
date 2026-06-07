// DialogContext — promise-based alert / confirm / choice dialogs.
//
// Screens call `useDialog()` and `await dialog.confirm({...})` instead
// of imperatively calling `Alert.alert(...)` or hand-rolling a
// `Modal`. All dialogs share one themed card (`CustomDialog`).
//
// Internally a single `current` dialog is queued. Calling `alert` /
// `confirm` / `choose` while another dialog is open is allowed — the
// new request waits for the previous resolver to fire, then runs.

import CustomDialog, {
  CustomDialogChoice,
  CustomDialogIconType,
  CustomDialogState,
} from '@/components/CustomDialog';
import * as Haptics from 'expo-haptics';
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

export interface AlertOptions {
  title?: string;
  message: string;
  iconType?: CustomDialogIconType;
  confirmText?: string;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  iconType?: CustomDialogIconType;
  destructive?: boolean;
}

export interface ChooseOptions {
  title?: string;
  message?: string;
  cancelText?: string;
  choices: CustomDialogChoice[];
}

export interface DialogContextType {
  alert: (options: AlertOptions) => Promise<void>;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  choose: (options: ChooseOptions) => Promise<void>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

interface PendingRequest {
  state: CustomDialogState;
  resolve: (value: boolean | void) => void;
}

export const DialogProvider = ({ children }: { children: ReactNode }) => {
  const [current, setCurrent] = useState<CustomDialogState | null>(null);
  const [visible, setVisible] = useState(false);
  const resolverRef = useRef<((value: boolean | void) => void) | null>(null);
  const queueRef = useRef<PendingRequest[]>([]);

  const showNext = useCallback(() => {
    if (current || queueRef.current.length === 0) return;
    const next = queueRef.current.shift()!;
    resolverRef.current = next.resolve;
    setCurrent(next.state);
    setVisible(true);
  }, [current]);

  const close = useCallback((result: boolean | void) => {
    setVisible(false);
    const resolve = resolverRef.current;
    resolverRef.current = null;
    // Defer clearing `current` and showing the next one until after
    // the close animation has a chance to play.
    setTimeout(() => {
      setCurrent(null);
      if (resolve) resolve(result);
      // Pull the next request, if any, on the next tick.
      setTimeout(showNext, 0);
    }, 180);
  }, [showNext]);

  const enqueue = useCallback(
    (state: CustomDialogState) =>
      new Promise<boolean | void>((resolve) => {
        queueRef.current.push({ state, resolve });
        showNext();
      }),
    [showNext],
  );

  // Fire a light haptic when a new dialog is presented.
  useEffect(() => {
    if (visible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [visible]);

  const alert = useCallback(
    (options: AlertOptions) =>
      enqueue({
        kind: 'alert',
        title: options.title,
        message: options.message,
        iconType: options.iconType,
        confirmText: options.confirmText,
      }) as Promise<void>,
    [enqueue],
  );

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      enqueue({
        kind: 'confirm',
        title: options.title,
        message: options.message,
        confirmText: options.confirmText,
        cancelText: options.cancelText,
        iconType: options.iconType,
        destructive: options.destructive,
      }) as Promise<boolean>,
    [enqueue],
  );

  const choose = useCallback(
    (options: ChooseOptions) =>
      enqueue({
        kind: 'choice',
        title: options.title,
        message: options.message,
        cancelText: options.cancelText,
        choices: options.choices,
      }) as Promise<void>,
    [enqueue],
  );

  const handleCancel = useCallback(() => {
    const kind = current?.kind;
    if (kind === 'confirm') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      close(false);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      close(undefined);
    }
  }, [close, current]);

  const handleConfirm = useCallback(() => {
    const kind = current?.kind;
    if (kind === 'alert') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      close(undefined);
    } else if (kind === 'confirm') {
      Haptics.notificationAsync(
        current?.destructive
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success,
      );
      close(true);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      close(undefined);
    }
  }, [close, current]);

  const handleChoose = useCallback(
    (choice: CustomDialogChoice) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (choice.onPress) {
        try {
          choice.onPress();
        } catch {
          // Swallow — the caller's UI shouldn't crash the dialog.
        }
      }
      close(undefined);
    },
    [close],
  );

  const value: DialogContextType = { alert, confirm, choose };

  return (
    <DialogContext.Provider value={value}>
      {children}
      <CustomDialog
        visible={visible}
        state={current}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
        onChoose={handleChoose}
      />
    </DialogContext.Provider>
  );
};

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (context === undefined) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};
