// InAppBanner — themed transient banner notifications anchored to the top
// of the screen. The notification system (NotificationContext) and the
// push-notification trigger hook both dispatch into this provider so a
// banner can appear while the app is in the foreground without pulling
// the user out of the current screen (as a system notification would).
//
// The provider is a no-render stub when no banner is queued. It exposes
// `useInAppBanner()` so other contexts can call `banner.show({...})`
// from anywhere inside the provider tree.

import { BorderRadius, Fonts, Spacing } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import * as Haptics from 'expo-haptics';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react-native';
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { AppText } from './AppText';

export type InAppBannerIconType = 'success' | 'error' | 'warning' | 'info';

export interface InAppBannerOptions {
  title?: string;
  message: string;
  iconType?: InAppBannerIconType;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

interface BannerEntry {
  id: number;
  options: InAppBannerOptions;
}

export interface InAppBannerContextType {
  show: (options: InAppBannerOptions) => void;
  dismiss: (id?: number) => void;
}

const InAppBannerContext = createContext<InAppBannerContextType | undefined>(
  undefined,
);

function BannerIcon({ type, colors }: { type?: InAppBannerIconType; colors: any }) {
  if (!type) return null;
  const color =
    type === 'success' ? colors.success :
    type === 'error' ? colors.error :
    type === 'warning' ? colors.warning :
    colors.primary;
  const bg =
    type === 'success' ? colors.success + '24' :
    type === 'error' ? colors.error + '24' :
    type === 'warning' ? colors.warning + '29' :
    colors.primary + '24';
  switch (type) {
    case 'success':
      return (
        <View style={[styles.iconCircle, { backgroundColor: bg }]}>
          <CheckCircle2 size={20} color={color} />
        </View>
      );
    case 'error':
      return (
        <View style={[styles.iconCircle, { backgroundColor: bg }]}>
          <AlertCircle size={20} color={color} />
        </View>
      );
    case 'warning':
      return (
        <View style={[styles.iconCircle, { backgroundColor: bg }]}>
          <AlertTriangle size={20} color={color} />
        </View>
      );
    case 'info':
    default:
      return (
        <View style={[styles.iconCircle, { backgroundColor: bg }]}>
          <Info size={20} color={color} />
        </View>
      );
  }
}

interface BannerCardProps {
  entry: BannerEntry;
  onDismiss: (id: number) => void;
}

const BannerCard: React.FC<BannerCardProps> = React.memo(({ entry, onDismiss }) => {
  const { colors } = useSettings();
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        speed: 14,
        bounciness: 6,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    const ms = entry.options.durationMs ?? 4500;
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -120,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => onDismiss(entry.id));
    }, ms);

    return () => clearTimeout(timer);
  }, [entry, onDismiss, translateY, opacity]);

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <BannerIcon type={entry.options.iconType} colors={colors} />
      <View style={styles.content}>
        {entry.options.title ? (
          <AppText
            variant="body"
            weight="bold"
            numberOfLines={1}
            style={[styles.title, { color: colors.text }]}
          >
            {entry.options.title}
          </AppText>
        ) : null}
        <AppText
          variant="caption"
          weight="medium"
          numberOfLines={3}
          style={[styles.message, { color: colors.textSecondary }]}
        >
          {entry.options.message}
        </AppText>
        {entry.options.actionLabel ? (
          <Pressable
            onPress={() => {
              if (entry.options.onAction) {
                try {
                  entry.options.onAction();
                } catch {
                  // swallow — the banner shouldn't crash on a bad action
                }
              }
              onDismiss(entry.id);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <AppText
              variant="caption"
              weight="bold"
              numberOfLines={1}
              color={colors.primary}
              style={styles.action}
            >
              {entry.options.actionLabel}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      <Pressable
        onPress={() => onDismiss(entry.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.dismiss}
      >
        <X size={16} color={colors.textSecondary} />
      </Pressable>
    </Animated.View>
  );
});

BannerCard.displayName = 'BannerCard';

export const InAppBannerProvider = ({ children }: { children: ReactNode }) => {
  const [banners, setBanners] = useState<BannerEntry[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id?: number) => {
    setBanners((prev) => (id === undefined ? [] : prev.filter((b) => b.id !== id)));
  }, []);

  const show = useCallback((options: InAppBannerOptions) => {
    idRef.current += 1;
    const entry: BannerEntry = { id: idRef.current, options };
    setBanners((prev) => [...prev, entry]);

    switch (options.iconType) {
      case 'success':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'error':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
      case 'warning':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      default:
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
    }
  }, []);

  return (
    <InAppBannerContext.Provider value={{ show, dismiss }}>
      {children}
      <View pointerEvents="box-none" style={styles.layer}>
        {banners.map((entry) => (
          <BannerCard key={entry.id} entry={entry} onDismiss={dismiss} />
        ))}
      </View>
    </InAppBannerContext.Provider>
  );
};

export const useInAppBanner = () => {
  const context = useContext(InAppBannerContext);
  if (context === undefined) {
    throw new Error('useInAppBanner must be used within an InAppBannerProvider');
  }
  return context;
};

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    zIndex: 10000,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: Fonts.bold,
    marginBottom: 2,
  },
  message: {
    fontFamily: Fonts.regular,
  },
  action: {
    marginTop: Spacing.xs,
  },
  dismiss: {
    marginLeft: Spacing.sm,
    padding: Spacing.xs,
  },
});
