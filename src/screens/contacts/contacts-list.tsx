import { Fonts } from '@/constants/theme';
import { PROFILE_IMAGES, useSettings } from '@/context/SettingsContext';
import { useSidebar } from '@/context/SidebarContext';
import { useDialog } from '@/context/DialogContext';
import { Image } from 'react-native';
import { deleteContact, getContacts, getContactsByCategory } from '@/database/db';
import * as Haptics from 'expo-haptics';
import {
  Bell,
  Edit2,
  MoreHorizontal,
  PhoneCall,
  Plus,
  Search,
  Truck,
  User,
  Users,
  Wrench,
  X,
  Home,
  Store,
  Warehouse,
  Settings as SettingsIcon
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Linking,
  Modal,
  Platform,
  SectionList,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import ContactDetails from './contact-details';
import ContactForm from './contact-form';
import { useNotifications } from '@/hooks/useNotifications';
import { useRouter } from 'expo-router';
import { useDebounce } from '@/hooks/useDebounce';
import { SkeletonList } from '@/components/Skeleton';
import { AppText, AppListItem, AppRow, AppCard } from '@/components/ui';
const { width } = Dimensions.get('window');

const CATEGORIES = [
  { key: 'all',              label: 'All',       icon: Users,          color: '#2F6FED' },
  { key: 'supplier',         label: 'Suppliers', icon: Truck,          color: '#34C759' },
  { key: 'worker',           label: 'Workers',   icon: User,           color: '#FF9500' },
  { key: 'service_provider', label: 'Service',   icon: Wrench,         color: '#FF3B30' },
  { key: 'other',            label: 'Other',     icon: MoreHorizontal, color: '#AF52DE' },
];

const CATEGORY_MAP: Record<string, { labelKey: string; color: string }> = {
  supplier:         { labelKey: 'contacts.cat_supplier',         color: '#34C759' },
  worker:           { labelKey: 'contacts.cat_worker',           color: '#FF9500' },
  service_provider: { labelKey: 'contacts.cat_service', color: '#FF3B30' },
  other:            { labelKey: 'contacts.cat_other',            color: '#AF52DE' },
};

function subCatKey(s: string) {
  const map: Record<string, string> = {
    'Plumber / Pipe Worker': 'plumber',
  };
  return map[s] || s.toLowerCase().replace(/[\s\/]+/g, '_');
}

function getInitials(name: string) {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

// Memoized contact row — used inside the SectionList to avoid
// re-rendering every card whenever the parent re-renders (e.g. on
// search keystroke, modal toggle, etc).
const ContactRow = React.memo(({
  contact,
  onPress,
  onCall,
  onEdit,
}: {
  contact: any;
  onPress: (c: any) => void;
  onCall: (phone: string) => void;
  onEdit: (c: any) => void;
}) => {
  const { colors, t } = useSettings();
  const info = React.useMemo(() => {
    const meta = CATEGORY_MAP[contact.category] || CATEGORY_MAP.other;
    return { label: t(meta.labelKey), color: meta.color };
  }, [contact.category, t]);
  const label = React.useMemo(
    () => (contact.subCategory ? t('contacts.sub_' + subCatKey(contact.subCategory)) : t('contacts.cat_' + contact.category)),
    [contact.subCategory, contact.category, t],
  );

  return (
    <AppCard
      padding={13}
      gap={11}
      radius={14}
      background={colors.card}
      bordered
      style={{ borderColor: colors.border, marginBottom: 7, flexDirection: 'row', alignItems: 'center' }}
    >
      <TouchableOpacity
        activeOpacity={0.72}
        onPress={() => onPress(contact)}
        style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 11 }}
      >
        <View style={[styles.avatar, { backgroundColor: info.color + '22' }]}>
          <AppText variant="body" weight="bold" shrink={false} style={[styles.avatarText, { color: info.color }]} numberOfLines={1}>
            {getInitials(contact.fullName)}
          </AppText>
        </View>

        <View style={styles.contactInfo}>
          <AppText variant="body" weight="bold" style={[styles.contactName, { color: colors.text }]} numberOfLines={1}>
            {contact.fullName}
          </AppText>
          <View style={styles.contactMeta}>
            <View style={[styles.categoryTag, { backgroundColor: info.color + '18' }]}>
              <AppText variant="micro" weight="bold" transform="uppercase" shrink={false} style={[styles.categoryTagText, { color: info.color }]} numberOfLines={1}>
                {label}
              </AppText>
            </View>
            {contact.phone && (
              <AppText variant="caption" weight="medium" style={[styles.contactPhone, { color: colors.textSecondary }]} numberOfLines={1}>
                {contact.phone}
              </AppText>
            )}
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.cardActions}>
        {contact.phone && (
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: '#34C75918' }]}
            onPress={(e) => { e.stopPropagation(); onCall(contact.phone); }}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <PhoneCall size={14} color="#34C759" strokeWidth={2} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: colors.border + '60' }]}
          onPress={(e) => { e.stopPropagation(); onEdit(contact); }}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Edit2 size={13} color={colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </AppCard>
  );
});
ContactRow.displayName = 'ContactRow';

export default function ContactsList() {
  const { colors, userProfile, t } = useSettings();
  const { openSidebar } = useSidebar();
  const { notifCount } = useNotifications();
  const router = useRouter();
  const dialog = useDialog();

  const [contacts, setContacts]           = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery]     = useState('');
  const [showForm, setShowForm]           = useState(false);
  const [showDetails, setShowDetails]     = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [editingContact, setEditingContact]   = useState<any>(null);
  const [isLoading, setIsLoading]         = useState(true);
  const debouncedSearch = useDebounce(searchQuery, 250);

  const loadContacts = useCallback(() => {
    let data: any[] = activeCategory === 'all'
      ? getContacts()
      : getContactsByCategory(activeCategory);
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      data = data.filter((c: any) =>
        c.fullName.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.subCategory && c.subCategory.toLowerCase().includes(q))
      );
    }
    setContacts(data);
    setIsLoading(false);
  }, [activeCategory, debouncedSearch]);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  const sections = useMemo(() => {
    const map: Record<string, any[]> = {};
    contacts.forEach(c => {
      const letter = c.fullName?.[0]?.toUpperCase() || '#';
      if (!map[letter]) map[letter] = [];
      map[letter].push(c);
    });
    return Object.keys(map).sort().map(letter => ({
      title: letter,
      data: map[letter],
    }));
  }, [contacts]);

  const handleDelete = async (contact: any) => {
    const ok = await dialog.confirm({
      title: t('contacts.delete_title'),
      message: t('contacts.delete_msg', { name: contact.fullName }),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      iconType: 'danger',
      destructive: true,
    });
    if (ok) {
      deleteContact(contact.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadContacts();
    }
  };

  const handleCall = useCallback((phone: string) => {
    if (phone) Linking.openURL(`tel:${phone}`);
  }, []);

  const handleSelect = useCallback((c: any) => {
    setSelectedContact(c);
    setShowDetails(true);
  }, []);

  const handleEdit = useCallback((c: any) => {
    setEditingContact(c);
    setShowForm(true);
  }, []);

  const renderItem = useCallback(({ item }: { item: any }) => (
    <ContactRow
      contact={item}
      onPress={handleSelect}
      onCall={handleCall}
      onEdit={handleEdit}
    />
  ), [handleSelect, handleCall, handleEdit]);

  const renderSectionHeader = useCallback(({ section }: { section: { title: string } }) => (
    <View style={styles.sectionHeader}>
      <AppText variant="title" weight="bold" shrink={false} style={[styles.sectionLetter, { color: colors.primary }]} numberOfLines={1}>{section.title}</AppText>
      <View style={[styles.sectionLine, { backgroundColor: colors.border }]} />
    </View>
  ), [colors.primary, colors.border]);

  const keyExtractor = useCallback((item: any) => String(item.id), []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      {/* Subtle background glow */}
      <View style={[styles.bgGlow, { top: -100, left: -50, backgroundColor: colors.primary }]} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.headerSub, { color: colors.textSecondary }]} numberOfLines={1}>{t('contacts.directory')}</AppText>
          <AppText variant="display" weight="bold" style={[styles.headerTitle, { color: colors.text }]} numberOfLines={2}>{t('contacts.title')}</AppText>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => router.push('/notifications')}
            style={[styles.headerIconBtn, { borderColor: colors.border }]}
          >
            <Bell size={24} color={colors.text} strokeWidth={2} />
            {notifCount > 0 && (
              <View style={[styles.notifBadge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
                <AppText variant="micro" weight="bold" shrink={false} style={[styles.notifBadgeText, { color: colors.background }]} numberOfLines={1}>{notifCount}</AppText>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={openSidebar}
            activeOpacity={0.7}
            style={[styles.headerAvatarWrap, { borderColor: colors.border }]}
          >
            <Image source={userProfile.avatarUri ? { uri: userProfile.avatarUri } : PROFILE_IMAGES[userProfile.avatarIndex >= 0 ? userProfile.avatarIndex : 0]} style={styles.headerAvatar} />
            <View style={[styles.onlineIndicator, { backgroundColor: '#34C759', borderColor: colors.background }]} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Search ── */}
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Search size={16} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder={t('contacts.search_name_phone')}
          placeholderTextColor={colors.textSecondary + '80'}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <View style={[styles.clearBtn, { backgroundColor: colors.border }]}>
              <X size={11} color={colors.textSecondary} strokeWidth={2.5} />
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Category Pills (bigger) ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillRow}
        style={{ maxHeight: 46, marginVertical: 2 }}
      >
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.key;
          return (
            <TouchableOpacity
              key={cat.key}
              onPress={() => { Haptics.selectionAsync(); setActiveCategory(cat.key); }}
              style={[
                styles.pill,
                {
                  backgroundColor: isActive ? cat.color : colors.card,
                  borderColor: isActive ? cat.color : colors.border,
                },
              ]}
              activeOpacity={0.75}
            >
              <Icon size={16} color={isActive ? '#FFF' : colors.textSecondary} strokeWidth={2} />
              <AppText variant="body-sm" weight="bold" shrink={false} style={[styles.pillLabel, { color: isActive ? '#FFF' : colors.textSecondary }]} numberOfLines={1}>
                {t('contacts.cat_' + cat.key)}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Count ── */}
      {contacts.length > 0 && (
        <View style={styles.countBar}>
          <AppText variant="caption" weight="medium" style={[styles.countText, { color: colors.textSecondary }]} numberOfLines={1}>
            {t('contacts.count', { count: String(contacts.length) })}
          </AppText>
        </View>
      )}

      {/* ── List ── */}
      {isLoading ? (
        <SkeletonList
          count={8}
          cardHeight={76}
          style={styles.listContent}
        />
      ) : sections.length === 0 ? (
        <Animated.View entering={FadeIn.duration(400)} style={styles.emptyState}>
          <View style={[styles.emptyIconWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Users size={34} color={colors.textSecondary} strokeWidth={1.5} />
          </View>
          <AppText variant="title" weight="bold" align="center" style={[styles.emptyTitle, { color: colors.text }]} numberOfLines={2}>
            {searchQuery ? t('contacts.no_results') : t('contacts.no_contacts_yet')}
          </AppText>
          <AppText variant="body" weight="medium" align="center" style={[styles.emptySub, { color: colors.textSecondary }]} numberOfLines={3}>
            {searchQuery ? t('contacts.nothing_matched', { query: searchQuery }) : t('contacts.tap_to_add')}
          </AppText>
          {!searchQuery && (
            <TouchableOpacity
              style={[styles.emptyAddBtn, { backgroundColor: colors.primary }]}
              onPress={() => { setEditingContact(null); setShowForm(true); }}
            >
              <Plus size={15} color="#FFF" />
              <AppText variant="body-sm" weight="bold" shrink={false} style={styles.emptyAddBtnText} numberOfLines={1}>{t('contacts.add_contact')}</AppText>
            </TouchableOpacity>
          )}
        </Animated.View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews={true}
          stickySectionHeadersEnabled={false}
        />
      )}


      {/* ── Modals ── */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <ContactForm
          contact={editingContact}
          onClose={() => { setShowForm(false); setEditingContact(null); }}
          onSaved={() => { setShowForm(false); setEditingContact(null); loadContacts(); }}
        />
      </Modal>

      <Modal visible={showDetails} animationType="slide" presentationStyle="pageSheet">
        {selectedContact && (
          <ContactDetails
            contact={selectedContact}
            onClose={() => { setShowDetails(false); setSelectedContact(null); }}
            onEdit={() => {
              setShowDetails(false);
              setEditingContact(selectedContact);
              setShowForm(true);
            }}
            onDeleted={() => {
              setShowDetails(false);
              setSelectedContact(null);
              loadContacts();
            }}
          />
        )}
      </Modal>

      {/* Floating Add Button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => { setEditingContact(null); setShowForm(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
        activeOpacity={0.85}
      >
        <Plus size={24} color="#FFF" />
      </TouchableOpacity>
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
    opacity: 0.06,
  },

  // Header
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
  headerIconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
  },
  notifBadgeText: {

    fontFamily: Fonts.bold,
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

  // Search
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

  // Bigger pills
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

  // Count
  countBar: {
    paddingHorizontal: 24,
    marginBottom: 4,
  },
  countText: {

    fontFamily: Fonts.medium,
  },

  // List — less bottom padding
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 90,
    paddingTop: 6,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    marginBottom: 6,
  },
  sectionLetter: {

    fontFamily: Fonts.extrabold,
    letterSpacing: 0.5,
    minWidth: 14,
  },
  sectionLine: {
    flex: 1,
    height: 1,
  },

  // Contact card
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 7,
    gap: 11,
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
  contactInfo: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  contactName: {

    fontFamily: Fonts.bold,
  },
  contactMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexWrap: 'wrap',
  },
  categoryTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  categoryTagText: {

    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  contactPhone: {

    fontFamily: Fonts.medium,
    flexShrink: 1,
  },
  cardActions: {
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


  // Empty state
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
    color: '#FFF',
  },
  fab: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
});