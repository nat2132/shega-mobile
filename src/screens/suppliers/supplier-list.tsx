import { Fonts } from '@/constants/theme';
import { getSuppliersGlass } from './glass-suppliers';
import { NotificationBell } from '@/components/NotificationBell';
import { PROFILE_IMAGES, useSettings } from '@/context/SettingsContext';
import { useSidebar } from '@/context/SidebarContext';
import {
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { getSupplierList, SupplierRow } from '@/database/db';
import * as Haptics from 'expo-haptics';
import {
  Edit2,
  PhoneCall,
  Plus,
  Search,
  Truck,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';

import Animated, { FadeIn } from 'react-native-reanimated';
import SupplierForm from './supplier-form';
import { useNotifications } from '@/hooks/useNotifications';
import { useAutoHideScroll } from '@/hooks/useAutoHideScroll';
import { useDataChangedRefresh } from '@/hooks/useDataChangedRefresh';
import { useRouter } from 'expo-router';
import { useDebounce } from '@/hooks/useDebounce';
import { SkeletonList } from '@/components/Skeleton';
import { AppText, AppCard } from '@/components/ui';

const FILTERS = [
  { key: 'all', label: 'suppliers.filter_all' },
  { key: 'active', label: 'suppliers.filter_active' },
  { key: 'inactive', label: 'suppliers.filter_inactive' },
  { key: 'debt', label: 'suppliers.filter_debt' },
] as const;

function getInitials(name: string) {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

const SupplierCard = React.memo(({
  supplier,
  onPress,
  onCall,
  onEdit,
}: {
  supplier: SupplierRow & { outstanding: number; hasDebt: boolean };
  onPress: (s: any) => void;
  onCall: (phone: string) => void;
  onEdit: (s: any) => void;
}) => {
  const { colors, t } = useSettings();
  const G = getSuppliersGlass(colors);
  const catColor = colors.success;

  return (
    <AppCard
      padding={13}
      gap={11}
      radius={14}
      background={G.bgCard}
      bordered
      style={{ borderColor: G.border, marginBottom: 7, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }}
    >
      <TouchableOpacity
        activeOpacity={0.72}
        onPress={() => onPress(supplier)}
        style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 11 }}
      >
        <View style={[styles.avatar, { backgroundColor: catColor + '22' }]}>
          <AppText variant="body" weight="bold" shrink={false} style={[styles.avatarText, { color: catColor }]} numberOfLines={1}>
            {getInitials(supplier.fullName)}
          </AppText>
        </View>

        <View style={styles.info}>
          <AppText variant="body" weight="bold" style={[styles.name, { color: G.fg }]} numberOfLines={1}>
            {supplier.fullName}
          </AppText>
          <View style={styles.metaRow}>
            {supplier.hasDebt ? (
              <View style={[styles.debtTag, { backgroundColor: colors.error + '18' }]}>
                <AppText variant="micro" weight="bold" transform="uppercase" shrink={false} style={[styles.debtTagText, { color: colors.error }]} numberOfLines={1}>
                  {t('suppliers.outstanding')}
                </AppText>
              </View>
            ) : (
              <View style={[styles.paidTag, { backgroundColor: colors.success + '18' }]}>
                <AppText variant="micro" weight="bold" transform="uppercase" shrink={false} style={[styles.paidTagText, { color: colors.success }]} numberOfLines={1}>
                  {t('suppliers.settled')}
                </AppText>
              </View>
            )}
            {supplier.phone ? (
              <AppText variant="caption" weight="medium" style={[styles.phone, { color: G.muted }]} numberOfLines={1}>
                {supplier.phone}
              </AppText>
            ) : null}
          </View>
          {supplier.companyName ? (
            <AppText variant="caption" weight="medium" style={[styles.company, { color: G.fgSecondary }]} numberOfLines={1}>
              {supplier.companyName}
            </AppText>
          ) : null}
        </View>
      </TouchableOpacity>

      <View style={styles.actions}>
        {supplier.phone ? (
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: G.accentGlass }]}
            onPress={(e) => { e.stopPropagation(); onCall(supplier.phone as string); }}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <PhoneCall size={14} color={G.fgSecondary} strokeWidth={2} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: G.accentGlass }]}
          onPress={(e) => { e.stopPropagation(); onEdit(supplier); }}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Edit2 size={13} color={G.muted} strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </AppCard>
  );
});
SupplierCard.displayName = 'SupplierCard';

export default function SupplierList() {
  const { colors, userProfile, t } = useSettings();
  const G = getSuppliersGlass(colors);
  const hideFABStyle = useAutoHideScroll();
  const { openSidebar } = useSidebar();
  const { notifCount } = useNotifications();
  const router = useRouter();

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive' | 'debt'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const debouncedSearch = useDebounce(searchQuery, 250);

  const loadSuppliers = useCallback(() => {
    let data: any[] = getSupplierList(activeFilter);
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      data = data.filter((s: any) =>
        s.fullName.toLowerCase().includes(q) ||
        (s.companyName && s.companyName.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q))
      );
    }
    setSuppliers(data);
    setIsLoading(false);
    setRefreshing(false);
  }, [activeFilter, debouncedSearch]);

  useDataChangedRefresh(loadSuppliers);

  useEffect(() => { loadSuppliers(); }, [loadSuppliers]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadSuppliers();
  }, [loadSuppliers]);

  const handleCall = useCallback((phone: string) => {
    if (phone) Linking.openURL(`tel:${phone}`);
  }, []);

  const handleSelect = useCallback((s: any) => {
    router.push(`/suppliers/${s.id}` as any);
  }, [router]);

  const handleEdit = useCallback((s: any) => {
    setEditingSupplier(s);
    setShowForm(true);
  }, []);

  const renderItem = useCallback(({ item }: { item: any }) => (
    <SupplierCard
      supplier={item}
      onPress={handleSelect}
      onCall={handleCall}
      onEdit={handleEdit}
    />
  ), [handleSelect, handleCall, handleEdit]);

  const keyExtractor = useCallback((item: any) => String(item.id), []);

  return (
    <View style={[styles.container, { backgroundColor: G.bg }]}>

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[styles.bgGlow, { top: -80, left: -60, backgroundColor: '#FFFFFF', opacity: 0.03 }]} />
        <View style={[styles.bgGlow, { bottom: -60, right: -40, backgroundColor: '#FFFFFF', opacity: 0.025, width: 250, height: 250, borderRadius: 125 }]} />
        <View style={[styles.bgGlow, { top: '40%', left: '30%', backgroundColor: '#FFFFFF', opacity: 0.015, width: 200, height: 200, borderRadius: 100 }]} />
      </View>

      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.headerSub, { color: G.muted }]} numberOfLines={1}>{t('suppliers.subtitle')}</AppText>
          <AppText variant="display" weight="bold" style={[styles.headerTitle, { color: G.fg }]} numberOfLines={2}>{t('suppliers.title')}</AppText>
        </View>
        <View style={styles.headerActions}>
          <NotificationBell size={22} count={notifCount} />
          <TouchableOpacity
            onPress={openSidebar}
            activeOpacity={0.7}
            style={[styles.headerAvatarWrap, { backgroundColor: G.bgCard, borderColor: G.borderLight }]}
          >
            <Image source={userProfile.avatarUri ? { uri: userProfile.avatarUri } : PROFILE_IMAGES[userProfile.avatarIndex >= 0 ? userProfile.avatarIndex : 0]} style={styles.headerAvatar} />
            <View style={[styles.onlineIndicator, { backgroundColor: G.fg, borderColor: G.bg }]} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.searchBar, { backgroundColor: G.bgCard, borderColor: G.border }]}>
        <Search size={16} color={G.muted} />
        <TextInput
          style={[styles.searchInput, { color: G.fg }]}
          placeholder={t('suppliers.search_ph')}
          placeholderTextColor={G.muted + '80'}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <View style={[styles.clearBtn, { backgroundColor: G.bgCardStrong }]}>
              <X size={11} color={G.muted} strokeWidth={2.5} />
            </View>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillRow}
        style={{ maxHeight: 46, marginVertical: 2 }}
      >
        {FILTERS.map((f) => {
          const isActive = activeFilter === f.key;
          const pillColor = colors.primary;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => { Haptics.selectionAsync(); setActiveFilter(f.key); }}
              style={[
                styles.pill,
                {
                  backgroundColor: isActive ? pillColor : G.bgCard,
                  borderColor: isActive ? pillColor : G.border,
                },
              ]}
              activeOpacity={0.75}
            >
              <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.pillLabel, { color: isActive ? colors.background : G.muted }]} numberOfLines={1}>
                {t(f.label)}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {suppliers.length > 0 && (
        <View style={styles.countBar}>
          <AppText variant="caption" weight="medium" style={[styles.countText, { color: G.muted }]} numberOfLines={1}>
            {t('suppliers.count', { count: String(suppliers.length) })}
          </AppText>
        </View>
      )}

      {isLoading ? (
        <SkeletonList
          count={8}
          cardHeight={76}
          style={styles.listContent}
        />
      ) : suppliers.length === 0 ? (
        <Animated.View entering={FadeIn.duration(400)} style={styles.emptyState}>
          <View style={[styles.emptyIconWrap, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <Truck size={34} color={G.muted} strokeWidth={1.5} />
          </View>
          <AppText variant="title" weight="bold" align="center" style={[styles.emptyTitle, { color: G.fg }]} numberOfLines={2}>
            {searchQuery ? t('suppliers.no_results') : t('suppliers.no_suppliers_yet')}
          </AppText>
          <AppText variant="body" weight="medium" align="center" style={[styles.emptySub, { color: G.muted }]} numberOfLines={3}>
            {searchQuery ? t('suppliers.nothing_matched', { query: searchQuery }) : t('suppliers.tap_to_add')}
          </AppText>
          {!searchQuery && (
            <TouchableOpacity
              style={[styles.emptyAddBtn, { backgroundColor: G.fg }]}
              onPress={() => { setEditingSupplier(null); setShowForm(true); }}
            >
              <Plus size={15} color={G.bg} />
              <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.emptyAddBtnText, { color: G.bg }]} numberOfLines={1}>{t('suppliers.add_supplier')}</AppText>
            </TouchableOpacity>
          )}
        </Animated.View>
      ) : (
        <FlatList
          data={suppliers}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews={true}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={G.fgSecondary}
              colors={[G.fgSecondary]}
            />
          }
        />
      )}

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <SupplierForm
          supplier={editingSupplier}
          onClose={() => { setShowForm(false); setEditingSupplier(null); }}
          onSaved={() => { setShowForm(false); setEditingSupplier(null); loadSuppliers(); }}
        />
      </Modal>

      <Animated.View style={[styles.dockedBarWrapper, hideFABStyle]}>
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: G.bgCardStrong, borderColor: G.borderLight }]}
          onPress={() => { setEditingSupplier(null); setShowForm(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          activeOpacity={0.85}
        >
          <Plus size={24} color={G.fg} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  bgGlow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 45,
    paddingBottom: 10,
  },
  headerSub: {
    fontFamily: Fonts.bold,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  headerTitle: {
    fontFamily: Fonts.extrabold,
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerAvatarWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
    position: 'relative',
  },
  headerAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
  },
  onlineIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    position: 'absolute',
    bottom: 0,
    right: 0,
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 24,
    marginBottom: 6,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.medium,
  },
  clearBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },

  pillRow: {
    paddingHorizontal: 24,
    paddingTop: 2,
    paddingBottom: 4,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    borderWidth: 1,
    gap: 6,
  },
  pillLabel: {
    fontFamily: Fonts.semibold,
  },

  countBar: {
    paddingHorizontal: 24,
    marginBottom: 4,
  },
  countText: {
    fontFamily: Fonts.medium,
  },

  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 90,
    paddingTop: 6,
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontFamily: Fonts.extrabold,
    letterSpacing: 0.5,
  },
  info: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  name: {
    fontFamily: Fonts.bold,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexWrap: 'wrap',
  },
  debtTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  debtTagText: {
    fontFamily: Fonts.bold,
    letterSpacing: 0.3,
  },
  paidTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  paidTagText: {
    fontFamily: Fonts.bold,
    letterSpacing: 0.3,
  },
  phone: {
    fontFamily: Fonts.medium,
    flexShrink: 1,
  },
  company: {
    fontFamily: Fonts.medium,
  },
  actions: {
    flexDirection: 'row',
    gap: 5,
    flexShrink: 0,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },

  emptyState: {
    alignItems: 'center',
    paddingTop: 70,
    gap: 10,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    fontFamily: Fonts.bold,
  },
  emptySub: {
    fontFamily: Fonts.medium,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 13,
    marginTop: 10,
  },
  emptyAddBtnText: {
    fontFamily: Fonts.bold,
  },

  dockedBarWrapper: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
});
