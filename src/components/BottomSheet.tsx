// Generic bottom sheet used for notification details, quick actions, etc.
// Uses Modal + Reanimated for the slide-in animation.

import React, { useEffect, useRef } from 'react';
import { Modal, Pressable, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Platform } from 'react-native';
import { X } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { AppText } from '@/components/ui';
interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  actions?: Array<{
    label: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'destructive';
    icon?: React.ReactNode;
  }>;
  height?: number | string;
  contentStyle?: ViewStyle;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  children,
  actions = [],
  height = 'auto',
  contentStyle,
}) => {
  const { colors, theme } = useSettings();
  const [mounted, setMounted] = React.useState(visible);
  const progress = useRef(useSharedValue(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.cubic) });
    } else if (mounted) {
      progress.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) {
          runOnJS(setMounted)(false);
        }
      });
    }
  }, [visible, mounted, progress]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 800 }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  if (!mounted) return null;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, overlayStyle]}>
          {Platform.OS === 'ios' ? (
            <BlurView tint="dark" intensity={40} style={StyleSheet.absoluteFill}>
              <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
            </BlurView>
          ) : (
            <Pressable
              style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
              onPress={onClose}
            />
          )}
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              height: height as any,
              maxHeight: '85%',
            },
            sheetStyle,
            contentStyle,
          ]}
        >
          {/* Handle */}
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
          </View>

          {/* Header */}
          {(title || subtitle) && (
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                {title && (
                  <AppText variant="heading" weight="bold" style={[styles.title, { color: colors.text }]} numberOfLines={2}>{title}</AppText>
                )}
                {subtitle && (
                  <AppText variant="body" weight="medium" style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={3}>{subtitle}</AppText>
                )}
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Body */}
          <View style={styles.body}>{children}</View>

          {/* Action buttons */}
          {actions.length > 0 && (
            <View style={styles.actions}>
              {actions.map((action, idx) => {
                const bg =
                  action.variant === 'primary' ? colors.text :
                  action.variant === 'destructive' ? '#FF3B30' :
                  colors.card;
                const fg =
                  action.variant === 'primary' ? colors.background :
                  action.variant === 'destructive' ? '#FFF' :
                  colors.text;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.actionBtn,
                      {
                        backgroundColor: bg,
                        borderColor: action.variant === 'secondary' ? colors.border : bg,
                      },
                    ]}
                    onPress={() => {
                      action.onPress();
                    }}
                  >
                    {action.icon}
                    <AppText variant="subtitle" weight="bold" style={[styles.actionText, { color: fg }]} numberOfLines={1}>{action.label}</AppText>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingBottom: 32,
    elevation: 20,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 14,
  },
  title: {

    fontFamily: Fonts.bold,
    marginBottom: 2,
  },
  subtitle: {

    fontFamily: Fonts.medium,
  },
  closeBtn: {
    padding: 6,
  },
  body: {
    paddingHorizontal: 24,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 110,
  },
  actionText: {

    fontFamily: Fonts.bold,
  },
});
