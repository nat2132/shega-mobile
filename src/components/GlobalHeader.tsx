import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Text,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bell,
  Languages,
  Moon,
  Sun,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  LogOut,
  Menu,
  ChevronRight,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSettings, PROFILE_IMAGES } from '@/context/SettingsContext';
import { useSidebar } from '@/context/SidebarContext';
import { useNotifications } from '@/hooks/useNotifications';
import { useSync } from '@/context/SyncContext';
import { useToast } from '@/context/ToastContext';
import { useAccount } from '@/context/AccountContext';
import { useBusinessAuth } from '@/hooks/useBusinessAuth';
import { setCurrentUserId } from '@/services/businessService';
import { AppText } from '@/components/ui';

const GlobalHeader = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userProfile, theme, setTheme, colors, t } = useSettings();
  const { openSidebar } = useSidebar();
  const { notifCount } = useNotifications();
  const { status, busy, lastError, lastResult, runSync } = useSync();
  const { showToast } = useToast();
  const { logout } = useAccount();
  const auth = useBusinessAuth();

  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const handleLogout = async () => {
    setShowProfileMenu(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      setCurrentUserId(null);
      await logout();
    } catch { /* ignore */ }
    router.replace('/user-signin' as any);
  };

  const handleOpenFullMenu = () => {
    setShowProfileMenu(false);
    openSidebar();
  };

  // Show toast on sync completion/error
  useEffect(() => {
    if (lastResult) {
      const { pushed, pulled, conflicts } = lastResult;
      if (pushed > 0 || pulled > 0) {
        showToast({
          message: t('sync.completed', { pushed: String(pushed), pulled: String(pulled) }),
          type: 'success',
          title: t('sync.title')
        });
      }
      if (conflicts > 0) {
        showToast({
          message: t('sync.conflicts', { count: String(conflicts) }),
          type: 'warning',
          title: t('sync.title')
        });
      }
    }
  }, [lastResult, t, showToast]);

  useEffect(() => {
    if (lastError) {
      showToast({
        message: lastError,
        type: 'error',
        title: t('sync.error_title')
      });
    }
  }, [lastError, t, showToast]);

  const getSyncState = () => {
    if (busy) return 'syncing';
    if (!status.hub) return 'unconfigured';
    if (lastError) return 'error';
    return 'online';
  };

  const syncState = getSyncState();

  const renderSyncIcon = () => {
    switch (syncState) {
      case 'syncing':
        return <RefreshCw size={18} color={colors.primary} style={styles.spinningIcon} />;
      case 'error':
        return <AlertTriangle size={18} color={colors.error || '#FF3B30'} />;
      case 'unconfigured':
        return <WifiOff size={18} color={colors.textSecondary} />;
      default:
        return <Wifi size={18} color={colors.success || '#34C759'} />;
    }
  };

  const pendingCount = status.outboxCount || 0;

  const handleSyncPress = () => {
    runSync();
  };

  const roleName = auth.user?.roleName || auth.user?.role || (auth.isOwner ? 'Owner' : 'Cashier');

  return (
    <View style={[styles.outerContainer, { top: 0, paddingTop: insets.top + 10 }] as const}>
      <View
        style={[
          styles.headerContainer,
          {
            backgroundColor: colors.header,
            borderBottomColor: colors.border,
          } as const,
        ]}
      >
        <View style={styles.headerContent}>
          {/* Left: Avatar */}
          <TouchableOpacity
            onPress={() => { Haptics.selectionAsync(); setShowProfileMenu(true); }}
            activeOpacity={0.7}
            style={styles.avatarTouch}
          >
            <View style={[styles.avatarBorder, { borderColor: colors.border } as const]}>
               <Image
                 source={auth.user?.avatar ? { uri: auth.user.avatar } : (userProfile.avatarUri ? { uri: userProfile.avatarUri } : PROFILE_IMAGES[userProfile.avatarIndex >= 0 ? userProfile.avatarIndex : 0])}
                 style={styles.avatarImage}
               />
            </View>
          </TouchableOpacity>

          {/* Right: Actions */}
          <View style={styles.actionGroup}>
            {/* Sync Status Indicator */}
            <TouchableOpacity
              onPress={handleSyncPress}
              style={styles.iconBtn}
              accessibilityLabel={t('sync.status_' + syncState)}
            >
              {renderSyncIcon()}
              {pendingCount > 0 && (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: colors.primary, borderColor: colors.background } as const,
                    pendingCount > 9 && styles.badgeWide,
                  ]}
                >
                  <Text style={styles.badgeText} numberOfLines={1}>
                    {pendingCount > 99 ? '99+' : String(pendingCount)}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Translation */}
            <TouchableOpacity
              onPress={() => router.push('/translation')}
              style={styles.iconBtn}
            >
              <Languages size={18} color={colors.text} />
            </TouchableOpacity>

            {/* Notifications */}
            <TouchableOpacity
              onPress={() => router.push('/notifications')}
              style={styles.iconBtn}
            >
              <Bell size={18} color={colors.text} />
              {notifCount > 0 && (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: colors.error || '#FF3B30', borderColor: colors.background } as const,
                    notifCount > 9 && styles.badgeWide,
                  ]}
                >
                  <Text style={styles.badgeText} numberOfLines={1}>
                    {notifCount > 99 ? '99+' : String(notifCount)}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Theme Toggle */}
            <TouchableOpacity
              onPress={toggleTheme}
              style={styles.iconBtn}
            >
              {theme === 'light' ? (
                <Moon size={18} color={colors.text} />
              ) : (
                <Sun size={18} color={colors.text} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Profile Avatar Dropdown Menu Modal */}
      <Modal visible={showProfileMenu} transparent animationType="fade" onRequestClose={() => setShowProfileMenu(false)}>
        <TouchableWithoutFeedback onPress={() => setShowProfileMenu(false)}>
          <View style={styles.menuBackdrop}>
            <TouchableWithoutFeedback>
              <View style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border, top: insets.top + 60 }]}>
                {/* Profile Header */}
                <View style={styles.menuHeader}>
                  <Image
                    source={auth.user?.avatar ? { uri: auth.user.avatar } : (userProfile.avatarUri ? { uri: userProfile.avatarUri } : PROFILE_IMAGES[userProfile.avatarIndex >= 0 ? userProfile.avatarIndex : 0])}
                    style={styles.menuAvatar}
                  />
                  <View style={{ flex: 1 }}>
                    <AppText variant="body" weight="bold" style={{ color: colors.text }}>
                      {auth.user?.name || userProfile.name || 'Team Member'}
                    </AppText>
                    <View style={[styles.roleBadge, { backgroundColor: colors.primary + '1A' }]}>
                      <AppText variant="micro" weight="bold" style={{ color: colors.primary }}>
                        {roleName.toUpperCase()}
                      </AppText>
                    </View>
                  </View>
                </View>

                <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />

                {/* Open Sidebar Menu */}
                <TouchableOpacity onPress={handleOpenFullMenu} style={styles.menuItem}>
                  <Menu size={18} color={colors.text} />
                  <AppText variant="body-sm" weight="semibold" style={{ color: colors.text, flex: 1, marginLeft: 12 }}>
                    Open Menu
                  </AppText>
                  <ChevronRight size={16} color={colors.textSecondary} />
                </TouchableOpacity>

                {/* Logout Button */}
                <TouchableOpacity onPress={handleLogout} style={styles.menuItem}>
                  <LogOut size={18} color={colors.error || '#FF3B30'} />
                  <AppText variant="body-sm" weight="bold" style={{ color: colors.error || '#FF3B30', flex: 1, marginLeft: 12 }}>
                    Log Out
                  </AppText>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  menuCard: {
    position: 'absolute',
    left: 20,
    width: 260,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  menuDivider: {
    height: 1,
    marginVertical: 12,
    opacity: 0.5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
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
    fontWeight: '700' as const,
    lineHeight: 14,
    textAlign: 'center' as const,
  },
  spinningIcon: {
    // Animation handled by lucide-react-native's built-in spin prop or use Animated API
    // For now, just a placeholder style
  },
});

export default GlobalHeader;
