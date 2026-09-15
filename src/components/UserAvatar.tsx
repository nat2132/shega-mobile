import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui';
import { PROFILE_IMAGES } from '@/context/SettingsContext';

/**
 * Small round avatar for activity feeds: shows the team member's
 * profile image when available, otherwise a clean initials circle.
 */
export function UserAvatar({
  name,
  avatarUri,
  avatarIndex,
  size = 20,
  color,
  backgroundColor,
}: {
  name?: string | null;
  avatarUri?: string | null;
  avatarIndex?: number | null;
  size?: number;
  color?: string;
  backgroundColor?: string;
}) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  const src = avatarUri
    ? { uri: avatarUri }
    : avatarIndex != null && avatarIndex >= 0
      ? PROFILE_IMAGES[avatarIndex % PROFILE_IMAGES.length]
      : null;

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: backgroundColor ?? 'rgba(128,128,128,0.18)',
        },
      ]}
    >
      {src ? (
        <Image source={src} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <AppText variant="micro" weight="bold" style={{ color: color ?? '#666', fontSize: size * 0.5 }}>
          {initial}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
});
