import React, { useCallback, useState } from 'react';
import { View, TouchableOpacity, Image, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X, ChevronRight, User as UserIcon, Crown, Truck, Store, Package, Users, Wallet, Building2, Sliders, Shield } from 'lucide-react-native';
import { Fonts, Spacing } from '@/constants/theme';
import { useSettings, PROFILE_IMAGES } from '@/context/SettingsContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { useAccount } from '@/context/AccountContext';
import { AppText, AppListItem } from '@/components/ui';

import { getBarsGlass } from './glass-bars';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { getActiveBusiness, getBusinessLogo } from '@/services/businessService';
import { useDataChangedRefresh } from '@/hooks/useDataChangedRefresh';

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

  const [activeBiz, setActiveBiz] = useState(() => getActiveBusiness());
  const [bizLogo, setBizLogo] = useState<string | null>(() => (activeBiz ? getBusinessLogo(activeBiz.id) : null));

  const loadData = useCallback(() => {
    const biz = getActiveBusiness();
    setActiveBiz(biz);
    setBizLogo(biz ? getBusinessLogo(biz.id) : null);
  }, []);

  useDataChangedRefresh(loadData);

  /** Role-gate an entry using the shared permission catalog (hide when denied). */
  const canAny = (keys?: string[]): boolean => {
    if (!keys || keys.length === 0) return true;
    return keys.some((k) => auth.can(k));
  };

  const handleRoute = (routePath: string) => {
    if (onClose) onClose();
    setTimeout(() => {
      router.push(routePath as any);
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

  const bizName = activeBiz?.name || auth.business?.name || userProfile.businessName || 'Shega Business';
  const userName = auth.user?.name || userProfile.name || 'Team Member';
  const userAvatar = auth.user?.avatar || userProfile.avatarUri || null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: G.bg }]}>
      {/* Header with Close Button */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <X size={28} color={G.fg} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Business & Profile Section */}
        <Animated.View entering={FadeIn.duration(800)} style={styles.profileSection}>
          <TouchableOpacity
            style={[styles.bizCard, { borderColor: G.border, backgroundColor: G.bgCard }]}
            activeOpacity={0.8}
            onPress={() => handleRoute('/settings')}
          >
            {bizLogo ? (
              <Image source={{ uri: bizLogo }} style={styles.bizImage} />
            ) : (
              <View style={[styles.bizPlaceholder, { backgroundColor: colors.primary + '18' }]}>
                <Store size={32} color={colors.primary} />
              </View>
            )}
            <View style={[styles.activeBadge, { backgroundColor: colors.primary }]}>
              <AppText variant="micro" weight="bold" style={{ color: '#FFFFFF' }}>ACTIVE</AppText>
            </View>
          </TouchableOpacity>

          <AppText variant="display" weight="extrabold" style={[styles.storeName, { color: G.fg, marginTop: 12 }]} numberOfLines={2}>
            {bizName}
          </AppText>

          <TouchableOpacity
            style={[styles.userChip, { backgroundColor: G.bgCard, borderColor: G.border }]}
            activeOpacity={0.8}
            onPress={() => handleRoute('/profile-settings')}
          >
            <View style={[styles.miniAvatar, { backgroundColor: colors.primary + '20' }]}>
              {userAvatar ? (
                <Image source={{ uri: userAvatar }} style={styles.miniAvatarImage} />
              ) : (
                <AppText variant="caption" weight="bold" style={{ color: colors.primary }}>
                  {userName.slice(0, 1).toUpperCase()}
                </AppText>
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText variant="body-sm" weight="bold" style={{ color: G.fg }} numberOfLines={1}>
                {userName}
              </AppText>
              <AppText variant="micro" weight="medium" style={{ color: G.fgSecondary }} numberOfLines={1}>
                {auth.user?.roleName ? auth.user.roleName : auth.isOwner ? 'Owner' : 'Member'}
              </AppText>
            </View>
            <ChevronRight size={14} color={G.fgSecondary} />
          </TouchableOpacity>
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
            icon={Truck}
            label={t('sidebar.suppliers')}
            onPress={() => handleRoute('/suppliers')}
            delay={100}
          />

          <MenuItem
            icon={Sliders}
            label={t('sidebar.business_center')}
            onPress={() => handleRoute('/business-center')}
            delay={150}
          />

          <MenuItem
            icon={Users}
            label={t('sidebar.team_members')}
            onPress={() => handleRoute('/teams')}
            delay={200}
          />

          <MenuItem
            icon={Crown}
            label={t('sidebar.subscription')}
            onPress={() => handleRoute('/subscription/manage')}
            delay={225}
          />

          <MenuItem
            icon={Shield}
            label={t('settings.configuration')}
            onPress={() => handleRoute('/settings')}
            delay={250}
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
  container: { flex: 1 },
  header: { paddingHorizontal: 25, paddingTop: 10, alignItems: 'flex-end' },
  closeButton: { padding: 10 },
  profileSection: { paddingHorizontal: 30, marginTop: 10, marginBottom: 25, alignItems: 'flex-start' },
  bizCard: { width: 90, height: 90, borderRadius: 24, borderWidth: 1, position: 'relative', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  bizImage: { width: '100%', height: '100%', borderRadius: 24 },
  bizPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  activeBadge: { position: 'absolute', bottom: 4, right: 4, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  storeName: { fontFamily: Fonts.extrabold, fontWeight: '800' },
  userChip: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, padding: 10, marginTop: 12, width: '100%' },
  miniAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  miniAvatarImage: { width: 32, height: 32, borderRadius: 16 },
  menuList: { paddingHorizontal: 30 },
  sectionHeading: { fontFamily: Fonts.bold, letterSpacing: 1.5, marginBottom: 16, opacity: 0.6 },
  iconContainer: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  trialBanner: { marginHorizontal: 30, marginBottom: 20, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  trialBannerInner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  footerNode: { paddingHorizontal: 30, paddingBottom: 20, alignItems: 'center' },
  footerText: { letterSpacing: 1.5 },
});

export default MyStoreMenu;
