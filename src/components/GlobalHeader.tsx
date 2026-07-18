import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Text,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bell,
  Languages,
  Moon,
  Sun
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSettings, PROFILE_IMAGES } from '@/context/SettingsContext';
import { useSidebar } from '@/context/SidebarContext';
import { useNotifications } from '@/hooks/useNotifications';

const GlobalHeader = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userProfile, theme, setTheme, previousDarkTheme, colors } = useSettings();
  const { openSidebar } = useSidebar();
  const { notifCount } = useNotifications();

  const toggleTheme = () => {
    setTheme(theme === 'light' ? previousDarkTheme : 'light');
  };

  return (
    <View style={[styles.outerContainer, { top: 0, paddingTop: insets.top + 10 }]}>
      <View
        style={[
          styles.headerContainer,
          {
            backgroundColor: colors.header,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerContent}>
          {/* Left: Avatar */}
          <TouchableOpacity
            onPress={openSidebar}
            activeOpacity={0.7}
            style={styles.avatarTouch}
          >
            <View style={[styles.avatarBorder, { borderColor: colors.border }]}>
               <Image
                 source={userProfile.avatarUri ? { uri: userProfile.avatarUri } : PROFILE_IMAGES[userProfile.avatarIndex >= 0 ? userProfile.avatarIndex : 0]}
                 style={styles.avatarImage}
               />
            </View>
          </TouchableOpacity>

          {/* Right: Actions */}
          <View style={styles.actionGroup}>
            {/* Translation */}
            <TouchableOpacity
              onPress={() => router.push('/translation')}
              style={[styles.iconBtn, { backgroundColor: colors.card }]}
            >
              <Languages size={18} color={colors.text} />
            </TouchableOpacity>

            {/* Notifications */}
            <TouchableOpacity
              onPress={() => router.push('/notifications')}
              style={[styles.iconBtn, { backgroundColor: colors.card }]}
            >
              <Bell size={18} color={colors.text} />
              {notifCount > 0 && (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: colors.error || '#FF3B30', borderColor: colors.background },
                    notifCount > 9 && styles.badgeWide,
                  ]}
                >
                  <Text style={styles.badgeText} numberOfLines={1}>
                    {notifCount > 99 ? '99+' : notifCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Theme Toggle */}
            <TouchableOpacity
              onPress={toggleTheme}
              style={[styles.iconBtn, { backgroundColor: colors.text }]}
            >
              {theme === 'light' ? (
                <Moon size={18} color={colors.background} />
              ) : (
                <Sun size={18} color={colors.background} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: 20,
  },
  headerContainer: {
    paddingBottom: 15,
    borderRadius: 24,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  avatarTouch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarBorder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    paddingHorizontal: 4,
  },
  badgeWide: {
    minWidth: 26,
    paddingHorizontal: 5,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    fontWeight: '700',
    lineHeight: 14,
    textAlign: 'center',
  },
});

export default GlobalHeader;
