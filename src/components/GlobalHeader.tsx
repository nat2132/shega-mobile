import React from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  Dimensions, 
  Platform 
} from 'react-native';
import { BlurView } from 'expo-blur';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  Bell, 
  Languages, 
  Moon, 
  Sun 
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSettings, PROFILE_IMAGES } from '@/context/SettingsContext';
import { useSidebar } from '@/context/SidebarContext';
import { Fonts } from '@/constants/theme';
import { useNotifications } from '@/hooks/useNotifications';
import { AppText } from '@/components/ui';
import Animated, { 
  FadeIn, 
  useAnimatedStyle, 
  withSpring 
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const GlobalHeader = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userProfile, theme, setTheme, colors, language } = useSettings();
  const { openSidebar } = useSidebar();
  const { notifCount } = useNotifications();

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <View style={[styles.outerContainer, { top: 0, paddingTop: insets.top + 10 }]}>
      <BlurView 
        intensity={Platform.OS === 'ios' ? 80 : 100} 
        tint={theme !== 'light' ? 'dark' : 'light'} 
        style={[
          styles.blurContainer, 
          { 
            paddingTop: Platform.OS === 'ios' ? 6 : 6,
            backgroundColor: theme !== 'light' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.7)',
            borderColor: colors.border
          }
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
                <View style={[styles.badge, { borderColor: theme === 'dark' ? '#000' : '#FFF' }]}>
                  <AppText variant="micro" weight="bold" style={styles.badgeText}>{notifCount}</AppText>
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
      </BlurView>
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
  blurContainer: {
    paddingBottom: 15,
    borderRadius: 35,
    overflow: 'hidden',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF3B30',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  badgeText: {
    color: '#FFF',
    fontFamily: Fonts.bold,
    lineHeight: 12,
  },
});

export default GlobalHeader;
