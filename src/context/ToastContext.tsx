import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import * as Haptics from 'expo-haptics';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react-native';
import React, { createContext, ReactNode, useContext, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui';
export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastContextProps {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextProps | undefined>(undefined);

// Separate component so useSettings is called inside the SettingsProvider tree
function ToastDisplay({
  toast,
  translateY,
}: {
  toast: { message: string; type: ToastType } | null;
  translateY: Animated.Value;
}) {
  const { colors } = useSettings();

  if (!toast) return null;

  const getIcon = () => {
    switch (toast.type) {
      case 'success': return <CheckCircle2 size={20} color="#34C759" />;
      case 'error': return <AlertCircle size={20} color="#FF3B30" />;
      case 'warning': return <AlertTriangle size={20} color="#FF9500" />;
      default: return <Info size={20} color="#007AFF" />;
    }
  };

  const getAccent = () => {
    switch (toast.type) {
      case 'success': return '#34C759';
      case 'error': return '#FF3B30';
      case 'warning': return '#FF9500';
      default: return '#007AFF';
    }
  };

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
      <View style={styles.content}>
        {getIcon()}
        <AppText variant="body" weight="bold" style={[styles.message, { color: colors.text }]} numberOfLines={3}>{toast.message}</AppText>
      </View>
    </Animated.View>
  );
}

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const translateY = useRef(new Animated.Value(-150)).current;

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });

    if (type === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (type === 'error') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    else if (type === 'warning') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    Animated.spring(translateY, {
      toValue: 50,
      useNativeDriver: true,
      speed: 12,
      bounciness: 8,
    }).start();

    setTimeout(() => {
      hideToast();
    }, 3500);
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
      <ToastDisplay toast={toast} translateY={translateY} />
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
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  message: {

    fontFamily: Fonts.bold,
    marginLeft: 12,
    flex: 1,
  },
});
