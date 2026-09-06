import React from 'react';
import { View, TouchableOpacity, Image, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X, Banknote, SlidersHorizontal, ClipboardList, LogOut, ChevronRight, User as UserIcon, TrendingUp, Users, Crown, Truck } from 'lucide-react-native';
import { Fonts , Spacing } from '@/constants/theme';
import { useSettings, PROFILE_IMAGES } from '@/context/SettingsContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { useAccount } from '@/context/AccountContext';
import { AppText, AppListItem } from '@/components/ui';

import { getBarsGlass } from './glass-bars';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
interface SidebarProps {
  onClose: () => void;
}

const MyStoreMenu: React.FC<SidebarProps> = ({ onClose }) => {
  const router = useRouter();
  const { userProfile, t, theme, colors } = useSettings();
  const { isTrial, trialDaysRemaining, isPremium, isFeatureUnlocked } = useSubscription();
  const { logout } = useAccount();
  const auth = useBusinessAuth();
  const G = getBarsGlass(colors);
  const gold = '#D4AF37';

  /** Role-gate an entry using the shared permission catalog (hide when denied). */
  const canAny = (keys?: string[]): boolean => {
    if (!keys || keys.length === 0) return true;
    return keys.some((k) => auth.can(k));
  };

  const handleExitSession = () => {
    if (onClose) onClose();
    setTimeout(async () => {
      await logout();
      router.replace('/login');
    }, 150);
  };

  const handleRoute = (routePath: string) => {
    if (onClose) onClose();
    setTimeout(() => {
      router.push(routePath as any);
    }, 150);
  };

  const handlePremiumRoute = (routePath: string, featureId: string) => {
    if (onClose) onClose();
    setTimeout(() => {
      if (isFeatureUnlocked(featureId)) {
        router.push(routePath as any);
      } else {
        router.push(`/subscription/upgrade?feature=${featureId}` as any);
      }
    }, 150);
  };

  const MenuItem = ({ icon: Icon, label, onPress, delay = 0, locked = false }: { icon: any; label: string; onPress: () => void; delay?: number; locked?: boolean }) => (
    <Animated.View entering={FadeInDown.delay(delay).duration(500)}>
      <AppListItem
        left={
            <View style={[styles.iconContainer, { backgroundColor: locked ? G.error + '18' : G.mutedLight }]}>
             <Icon color={locked ? G.error : G.fg} size={22} strokeWidth={2} />
          </View>
        }
        title={label}
        titleMaxLines={2}
        right={
          <ChevronRight size={18} color={locked ? G.error : G.border} />
        }
        onPress={onPress}
        noBorder
        padding={Spacing.sm}
        style={{
          backgroundColor: 'transparent',
          minHeight: 56,
          opacity: locked ? 0.6 : 1,
        }}
      />
    </Animated.View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: G.bg }]}>
      {/* Header with Close Button */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <X size={28} color={G.fg} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* ScrollView as a child to avoid nesting issues */}
      <ScrollView showsVerticalScrollIndicator={false}>
            {/* Profile Section */}
            <Animated.View entering={FadeIn.duration(800)} style={styles.profileSection}>
              <TouchableOpacity 
                style={[styles.avatarNode, { borderColor: G.border }]} 
                activeOpacity={0.8} 
                onPress={() => handleRoute('/profile-settings')}
              >
                <Image 
                  source={userProfile.avatarUri ? { uri: userProfile.avatarUri } : PROFILE_IMAGES[userProfile.avatarIndex >= 0 ? userProfile.avatarIndex : 0]} 
                  style={styles.avatarRender} 
                />
                <View style={[styles.editBadge, { backgroundColor: G.fg }]}>
                   <UserIcon size={12} color={G.bg} />
                </View>
              </TouchableOpacity>
              
              <AppText variant="display-lg" weight="extrabold" style={[styles.storeName, { color: G.fg }]} numberOfLines={2}>
                {userProfile.businessName}
              </AppText>
              <AppText variant="title-sm" weight="medium" style={[styles.userName, { color: G.fgSecondary }]} numberOfLines={1}>
                {userProfile.name}
              </AppText>
            </Animated.View>

            {/* Trial Banner */}
            {isTrial && (
              <Animated.View entering={FadeInDown.delay(100).duration(500)} style={[styles.trialBanner, { backgroundColor: gold + '15', borderColor: gold + '30' }]}>
                <TouchableOpacity
                  style={styles.trialBannerInner}
                  onPress={() => handleRoute('/subscription/manage')}
                  activeOpacity={0.7}
                >
                  <Crown size={18} color={gold} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="body-sm" weight="bold" style={{ color: gold }}>
                      {t('subscription.trial')}
                    </AppText>
                    <AppText variant="micro" weight="medium" style={{ color: gold + 'CC' }}>
                      {t('subscription.trial_banner', { days: String(trialDaysRemaining) })}
                    </AppText>
                  </View>
                  <ChevronRight size={16} color={gold} />
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* Menu Items List */}
            <View style={styles.menuList}>
              <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.sectionHeading, { color: G.fgSecondary }]} numberOfLines={1}>
                {t('sidebar.quick_links')}
              </AppText>
              
              <MenuItem 
                icon={Users} 
                label={t('sidebar.contacts')} 
                onPress={() => handleRoute('/contacts')} 
                delay={150}
              />
              {canAny(['inventory.suppliers']) && (
                <MenuItem 
                  icon={Truck} 
                  label={t('sidebar.suppliers')} 
                  onPress={() => handlePremiumRoute('/(tabs)/suppliers', 'supplier_management')} 
                  locked={!isFeatureUnlocked('supplier_management')}
                  delay={200}
                />
              )}
              {canAny(['payments.manageExpenses']) && (
                <MenuItem 
                  icon={Banknote} 
                  label={t('sidebar.expense_tracker')} 
                  onPress={() => handlePremiumRoute('/expense', 'expense')} 
                  locked={!isFeatureUnlocked('expense')}
                  delay={250}
                />
              )}
              {canAny(['inventory.adjust']) && (
                <MenuItem 
                  icon={SlidersHorizontal} 
                  label={t('sidebar.stock_adjustments')} 
                  onPress={() => handleRoute('/adjustment')} 
                  delay={300}
                />
              )}
              {canAny(['reports.viewOwn', 'reports.viewAll']) && (
                <MenuItem 
                  icon={ClipboardList} 
                  label={t('sidebar.reports_analytics')} 
                  onPress={() => handlePremiumRoute('/summary', 'reports')} 
                  locked={!isFeatureUnlocked('reports')}
                  delay={350}
                />
              )}
              {canAny(['reports.viewAll']) && (
                <MenuItem 
                  icon={TrendingUp} 
                  label={t('sidebar.financial_reports')} 
                  onPress={() => handlePremiumRoute('/reports', 'reports')} 
                  locked={!isFeatureUnlocked('reports')}
                  delay={400}
                />
              )}
              {canAny(['subscription.view']) && (
                <MenuItem 
                  icon={Crown} 
                  label={t('subscription.manage')} 
                  onPress={() => handleRoute('/subscription/manage')} 
                  delay={450}
                />
              )}

              <View style={[styles.divider, { backgroundColor: G.border }]} />
              
              <MenuItem 
                icon={LogOut} 
                label={t('sidebar.exit_session')} 
                onPress={handleExitSession} 
                delay={500}
              />
            </View>
          </ScrollView>

      {/* Footer Meta */}
      <View style={styles.footerNode}>
         <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.footerText, { color: G.border }]} numberOfLines={1}>
            {t('common.app_name')} {(theme ?? '').toUpperCase()}
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
  trialBanner: {
    marginHorizontal: 35,
    marginBottom: 24,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  trialBannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
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