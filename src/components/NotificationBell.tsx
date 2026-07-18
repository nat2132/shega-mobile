import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Bell } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSettings } from '@/context/SettingsContext';
import { useNotificationCenter } from '@/context/NotificationContext';
import { Fonts } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
interface NotificationBellProps {
  size?: number;
  showBadge?: boolean;
  onPress?: () => void;
  count?: number;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  size = 24,
  showBadge = true,
  onPress,
  count: countProp,
}) => {
  const { colors } = useSettings();
  const { unreadCount } = useNotificationCenter();
  const router = useRouter();

  const displayCount = countProp ?? unreadCount;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onPress) {
      onPress();
    } else {
      router.push('/notifications' as any);
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={styles.container}
      accessibilityLabel="Open notifications"
      accessibilityRole="button"
    >
      <Bell size={size} color={colors.text} strokeWidth={2} />
      {showBadge && displayCount > 0 && (
        <View
          style={[
            styles.badge,
            { backgroundColor: colors.error || '#FF3B30', borderColor: colors.background },
            displayCount > 9 && styles.badgeWide,
          ]}
        >
          <Text style={styles.badgeText} numberOfLines={1}>
            {displayCount > 99 ? '99+' : displayCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 8,
    overflow: 'visible',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeWide: {
    minWidth: 26,
    paddingHorizontal: 5,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: Fonts.bold,
    fontWeight: '700',
    lineHeight: 14,
    textAlign: 'center',
  },
});
