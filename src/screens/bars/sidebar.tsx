import React from 'react';
import { View, TouchableOpacity, Image, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X, Banknote, SlidersHorizontal, ClipboardList, LogOut, ChevronRight, User as UserIcon, TrendingUp, Users, Phone, HandCoins } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';
import { useSettings, PROFILE_IMAGES } from '@/context/SettingsContext';
import { AppText, AppListItem } from '@/components/ui';
import { BorderRadius, Spacing } from '@/constants/theme';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
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
      <AppListItem
        left={
          <View style={[styles.iconContainer, { backgroundColor: colors.text + '05' }]}>
            <Icon color={colors.text} size={22} strokeWidth={2} />
          </View>
        }
        title={label}
        titleMaxLines={2}
        right={
          <ChevronRight size={18} color={colors.border} />
        }
        onPress={onPress}
        noBorder
        padding={Spacing.sm}
        style={{
          backgroundColor: 'transparent',
          minHeight: 56,
        }}
      />
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

      {/* ScrollView as a child to avoid nesting issues */}
      {(() => {
        const RNScrollView = require('react-native').ScrollView;
        return (
          <RNScrollView showsVerticalScrollIndicator={false}>
            {/* Profile Section */}
            <Animated.View entering={FadeIn.duration(800)} style={styles.profileSection}>
              <TouchableOpacity 
                style={[styles.avatarNode, { borderColor: colors.border }]} 
                activeOpacity={0.8} 
                onPress={() => handleRoute('/profile-settings')}
              >
                <Image 
                  source={userProfile.avatarUri ? { uri: userProfile.avatarUri } : PROFILE_IMAGES[userProfile.avatarIndex >= 0 ? userProfile.avatarIndex : 0]} 
                  style={styles.avatarRender} 
                />
                <View style={[styles.editBadge, { backgroundColor: colors.text }]}>
                   <UserIcon size={12} color={colors.background} />
                </View>
              </TouchableOpacity>
              
              <AppText variant="display-lg" weight="extrabold" style={[styles.storeName, { color: colors.text }]} numberOfLines={2}>
                {userProfile.businessName}
              </AppText>
              <AppText variant="title-sm" weight="medium" style={[styles.userName, { color: colors.textSecondary }]} numberOfLines={1}>
                {userProfile.name}
              </AppText>
            </Animated.View>

            {/* Menu Items List */}
            <View style={styles.menuList}>
              <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.sectionHeading, { color: colors.textSecondary }]} numberOfLines={1}>
                {t('sidebar.quick_links')}
              </AppText>
              
              <MenuItem 
                icon={Users} 
                label={t('sidebar.suppliers_contacts')} 
                onPress={() => handleRoute('/contacts')} 
                delay={150}
              />
              <MenuItem 
                icon={Banknote} 
                label={t('sidebar.expense_tracker')} 
                onPress={() => handleRoute('/expense')} 
                delay={200}
              />
              <MenuItem 
                icon={SlidersHorizontal} 
                label={t('sidebar.stock_adjustments')} 
                onPress={() => handleRoute('/adjustment')} 
                delay={300}
              />
              <MenuItem 
                icon={ClipboardList} 
                label={t('sidebar.reports_analytics')} 
                onPress={() => handleRoute('/summary')} 
                delay={400}
              />
              <MenuItem 
                icon={TrendingUp} 
                label={t('sidebar.financial_reports')} 
                onPress={() => handleRoute('/reports')} 
                delay={430}
              />
              <MenuItem 
                icon={HandCoins} 
                label={t('sidebar.debt_management')} 
                onPress={() => handleRoute('/debt-detail')} 
                delay={460}
              />

              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              
              <MenuItem 
                icon={LogOut} 
                label={t('sidebar.exit_session')} 
                onPress={onClose} 
                delay={500}
              />
            </View>
          </RNScrollView>
        );
      })()}

      {/* Footer Meta */}
      <View style={styles.footerNode}>
         <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.footerText, { color: colors.border }]} numberOfLines={1}>
           ORCHESTRATION v4.2.0 • {theme.toUpperCase()}
         </AppText>
      </View>
    </SafeAreaView>
  );
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
    alignItems: 'flex-start',
  },
  avatarNode: {
    width: 100,
    height: 100,
    borderRadius: 35,
    borderWidth: 1,
    position: 'relative',
    padding: 4,
    marginBottom: 15,
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
  },
  storeName: {
    fontFamily: Fonts.extrabold,
    fontWeight: '800',
  },
  userName: {
    fontFamily: Fonts.medium,
    marginTop: 4,
  },
  menuList: {
    paddingHorizontal: 35,
  },
  sectionHeading: {
    fontFamily: Fonts.bold,
    letterSpacing: 1.5,
    marginBottom: 20,
    opacity: 0.6,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
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
    fontFamily: Fonts.bold,
    letterSpacing: 1.2,
  },
});

export default MyStoreMenu;