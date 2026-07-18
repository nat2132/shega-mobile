import { useSettings } from '@/context/SettingsContext';
import { playBad, playNice } from '@/services/soundService';
import * as Haptics from 'expo-haptics';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react-native';
import React, { createContext, ReactNode, useContext, useRef, useState } from 'react';
import { Animated, Modal, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  message: string;
  type?: ToastType;
  title?: string;
  duration?: number;
}

interface ToastContextProps {
  showToast: (messageOrOptions: string | ToastOptions, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextProps | undefined>(undefined);

const ToastDisplay = ({ toast, translateY }: {
  toast: { message: string; type: ToastType; title?: string } | null;
  translateY: Animated.Value;
}) => {
  const { colors } = useSettings();

  if (!toast) return null;

  const getIcon = () => {
    switch (toast.type) {
      case 'success': return <CheckCircle2 size={22} color={colors.success} />;
      case 'error': return <AlertCircle size={22} color={colors.error} />;
      case 'warning': return <AlertTriangle size={22} color={colors.warning} />;
      default: return <Info size={22} color={colors.primary} />;
    }
  };

  const getAccent = () => {
    switch (toast.type) {
      case 'success': return colors.success;
      case 'error': return colors.error;
      case 'warning': return colors.warning;
      default: return colors.primary;
    }
  };

  const hasTitle = !!toast.title;

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderLeftColor: getAccent(),
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={[styles.iconWrapper, hasTitle && styles.iconWrapperTop]}>
        {getIcon()}
      </View>
      <View style={styles.textContainer}>
        {hasTitle && (
          <AppText variant="body" weight="bold" style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {toast.title}
          </AppText>
        )}
        <AppText
          variant={hasTitle ? 'body-sm' : 'body'}
          weight={hasTitle ? 'medium' : 'bold'}
          style={[styles.message, { color: hasTitle ? colors.textSecondary : colors.text }]}
          numberOfLines={hasTitle ? 2 : 3}
        >
          {toast.message}
        </AppText>
      </View>
    </Animated.View>
  );
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toast, setToast] = useState<{ message: string; type: ToastType; title?: string } | null>(null);
  const translateY = useRef(new Animated.Value(-150)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastToastTime = useRef(0);

  const showToast = (messageOrOptions: string | ToastOptions, type?: ToastType) => {
    if (timerRef.current) clearTimeout(timerRef.current);

    let message: string;
    let resolvedType: ToastType;
    let title: string | undefined;
    let duration = 3500;

    if (typeof messageOrOptions === 'string') {
      message = messageOrOptions;
      resolvedType = type ?? 'success';
    } else {
      message = messageOrOptions.message;
      resolvedType = messageOrOptions.type ?? 'success';
      title = messageOrOptions.title;
      duration = messageOrOptions.duration ?? 3500;
    }

    setToast({ message, type: resolvedType, title });

    const now = Date.now();
    const isRapidFire = now - lastToastTime.current < 300;
    lastToastTime.current = now;

    if (resolvedType === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (!isRapidFire) playNice();
    } else if (resolvedType === 'error') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (!isRapidFire) playBad();
    } else if (resolvedType === 'warning') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    Animated.spring(translateY, {
      toValue: 50,
      useNativeDriver: true,
      speed: 12,
      bounciness: 8,
    }).start();

    timerRef.current = setTimeout(() => {
      hideToast();
    }, duration);
  };

  const hideToast = () => {
    Animated.timing(translateY, {
      toValue: -150,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setToast(null));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Modal transparent visible={toast !== null} animationType="none" onRequestClose={hideToast}>
        <View style={styles.modalOverlay} pointerEvents="box-none">
          <ToastDisplay toast={toast} translateY={translateY} />
        </View>
      </Modal>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 9999,
  },
  iconWrapper: {
    marginRight: 12,
  },
  iconWrapperTop: {
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    marginBottom: 2,
  },
  message: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
  },
});