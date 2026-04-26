import React from 'react';
import { View, Text as RNText, TouchableOpacity, Image, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X, Banknote, SlidersHorizontal, ClipboardList, LogOut, ChevronRight, User as UserIcon } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';
import { useSettings, PROFILE_IMAGES } from '@/context/SettingsContext';
import Animated, { FadeIn, FadeInDown, FadeOut, Layout } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

interface SidebarProps {
  onClose: () => void;
}

const MyStoreMenu: React.FC<SidebarProps> = ({ onClose }) => {
  const router = useRouter();
  const { userProfile, colors, t, theme } = useSettings();

  const handleRoute = (routePath: string) => {
    if (onClose) onClose();
    setTimeout(() => {
      router.push(routePath as any);
    }, 150);
  };

  const MenuItem = ({ icon: Icon, label, onPress, delay = 0 }: { icon: any; label: string; onPress: () => void; delay?: number }) => (
    <Animated.View entering={FadeInDown.delay(delay).duration(500)}>
      <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.6}>
        <View style={[styles.iconContainer, { backgroundColor: colors.text + '05' }]}>
          <Icon color={colors.text} size={22} strokeWidth={2} />
        </View>
        <RNText style={[styles.menuLabel, { color: colors.text }]}>{label}</RNText>
        <ChevronRight size={18} color={colors.border} />
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header with Close Button */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <X size={28} color={colors.text} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <Animated.View entering={FadeIn.duration(800)} style={styles.profileSection}>
          <TouchableOpacity 
            style={[styles.avatarNode, { borderColor: colors.border }]} 
            activeOpacity={0.8} 
            onPress={() => handleRoute('/profile-settings')}
          >
            <Image 
              source={PROFILE_IMAGES[userProfile.avatarIndex]} 
              style={styles.avatarRender} 
            />
            <View style={[styles.editBadge, { backgroundColor: colors.text }]}>
               <UserIcon size={12} color={colors.background} />
            </View>
          </TouchableOpacity>
          <RNText style={[styles.storeName, { color: colors.text }]} numberOfLines={1}>
            {userProfile.businessName}
          </RNText>
          <RNText style={[styles.userName, { color: colors.textSecondary }]}>
            {userProfile.fullName}
          </RNText>
        </Animated.View>

        {/* Menu Items List */}
        <View style={styles.menuList}>
          <RNText style={[styles.sectionHeading, { color: colors.textSecondary }]}>TERMINAL NAVIGATION</RNText>
          
          <MenuItem 
            icon={Banknote} 
            label={t('expense.header')} 
            onPress={() => handleRoute('/expense')} 
            delay={200}
          />
          <MenuItem 
            icon={SlidersHorizontal} 
            label={t('common.edit')} 
            onPress={() => handleRoute('/adjustment')} 
            delay={300}
          />
          <MenuItem 
            icon={ClipboardList} 
            label={t('tabs.summary')} 
            onPress={() => handleRoute('/summary')} 
            delay={400}
          />

          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          
          <MenuItem 
            icon={LogOut} 
            label="Exit Session" 
            onPress={onClose} 
            delay={500}
          />
        </View>
      </ScrollView>

      {/* Footer Meta */}
      <View style={styles.footerNode}>
         <RNText style={[styles.footerText, { color: colors.border }]}>ORCHESTRATION v4.2.0 • {theme.toUpperCase()}</RNText>
      </View>
    </SafeAreaView>
  );
};

// Internal local wrap to avoid ScrollView issue since caller might wrap it
const ScrollView = (props: any) => {
  const { ScrollView: RNScrollView } = require('react-native');
  return <RNScrollView {...props} />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 25,
    paddingTop: 10,
    alignItems: 'flex-end',
  },
  closeButton: {
    padding: 10,
  },
  profileSection: {
    paddingHorizontal: 35,
    marginTop: 10,
    marginBottom: 40,
  },
  avatarNode: {
    width: 100,
    height: 100,
    borderRadius: 35,
    borderWidth: 1,
    marginBottom: 20,
    position: 'relative',
    padding: 4,
  },
  avatarRender: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
  },
  editBadge: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
  },
  storeName: {
    fontSize: 32,
    fontFamily: Fonts.extrabold,
    fontWeight: '800',
  },
  userName: {
    fontSize: 16,
    fontFamily: Fonts.medium,
    marginTop: 4,
  },
  menuList: {
    paddingHorizontal: 35,
  },
  sectionHeading: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    letterSpacing: 1.5,
    marginBottom: 20,
    opacity: 0.6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    marginBottom: 4,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuLabel: {
    flex: 1,
    fontSize: 18,
    fontFamily: Fonts.bold,
  },
  divider: {
    height: 1,
    marginVertical: 20,
    opacity: 0.3,
  },
  footerNode: {
    padding: 35,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 9,
    fontFamily: Fonts.bold,
    letterSpacing: 1.2,
  },
});

export default MyStoreMenu;