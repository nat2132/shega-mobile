import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import {
  Search,
  X,
  Package,
  ShoppingCart,
  Wallet,
  TrendingUp,
  BarChart3,
  FolderOpen,
  Building2,
  Users,
  Bell,
  FileText,
  ExternalLink,
  TrendingDown,
  AlertTriangle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSettings } from '@/context/SettingsContext';
import { AppText, AppNumber } from '@/components/ui';
import { searchAll, SearchResult } from '@/services/searchService';
import { Fonts } from '@/constants/theme';

interface UniversalSearchProps {
  visible: boolean;
  onClose: () => void;
  onNavigate?: (result: SearchResult) => void;
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: (colors: any) => string; labelKey: string }> = {
  item: { icon: Package, color: (c) => c.primary, labelKey: 'search.items' },
  sale: { icon: ShoppingCart, color: (c) => c.success, labelKey: 'search.sales' },
  expense: { icon: Wallet, color: (c) => c.warning, labelKey: 'search.expenses' },
  adjustment: { icon: TrendingUp, color: (c) => c.error, labelKey: 'search.adjustments' },
  budget: { icon: BarChart3, color: (c) => c.tint, labelKey: 'search.budgets' },
  category: { icon: FolderOpen, color: (c) => c.secondary, labelKey: 'search.categories' },
  warehouse: { icon: Building2, color: (c) => c.primary, labelKey: 'search.warehouses' },
  contact: { icon: Users, color: (c) => c.success, labelKey: 'search.contacts' },
  notification: { icon: Bell, color: (c) => c.warning, labelKey: 'search.notifications' },
  draft: { icon: FileText, color: (c) => c.tint, labelKey: 'search.drafts' },
};

export function UniversalSearch({ visible, onClose, onNavigate }: UniversalSearchProps) {
  const { colors, t } = useSettings();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setQuery('');
      setResults([]);
      setSelectedIndex(-1);
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [visible]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        setResults(searchAll(query, t));
      } else {
        setResults([]);
      }
      setSelectedIndex(-1);
    }, 150);
    return () => clearTimeout(timer);
  }, [query, t]);

  const grouped = results.reduce((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  const typeOrder = Object.keys(TYPE_CONFIG).filter((t) => grouped[t]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (onNavigate) onNavigate(result);
      else onClose();
    },
    [onNavigate, onClose],
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.background }]} onPress={() => {}}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <View style={styles.handleRow}>
              <View style={[styles.handle, { backgroundColor: colors.border }]} />
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Search size={18} color={colors.textSecondary} />
              <TextInput
                ref={inputRef}
                style={[styles.input, { color: colors.text }]}
                placeholder={t('search.placeholder')}
                placeholderTextColor={colors.textSecondary}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery('')}>
                  <X size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {results.length === 0 && query.trim().length > 0 && (
              <View style={styles.emptyState}>
                <Search size={40} color={colors.border} />
                <AppText variant="body" weight="medium" style={{ color: colors.textSecondary, marginTop: 12 }}>
                  {t('search.no_results')}
                </AppText>
              </View>
            )}

            {query.trim().length === 0 && results.length === 0 && (
              <View style={styles.emptyState}>
                <Search size={40} color={colors.border} />
                <AppText variant="body" weight="medium" style={{ color: colors.textSecondary, marginTop: 12 }}>
                  {t('search.hint')}
                </AppText>
              </View>
            )}

            {results.length > 0 && (
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {typeOrder.map((type) => {
                  const items = grouped[type];
                  const config = TYPE_CONFIG[type];
                  const Icon = config.icon;

                  return (
                    <View key={type} style={styles.section}>
                      <View style={styles.sectionHeader}>
                        <Icon size={14} color={config.color(colors)} />
                        <AppText
                          variant="caption"
                          weight="bold"
                          transform="uppercase"
                          style={{ color: config.color(colors), marginLeft: 6 }}
                        >
                          {t(config.labelKey)}
                        </AppText>
                        <AppText
                          variant="micro"
                          weight="medium"
                          style={{ color: colors.textSecondary, marginLeft: 6 }}
                        >
                          {items.length}
                        </AppText>
                      </View>

                      {items.slice(0, 5).map((result) => (
                        <TouchableOpacity
                          key={result.id}
                          style={[styles.resultRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                          onPress={() => handleSelect(result)}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.resultIcon, { backgroundColor: config.color(colors) + '15' }]}>
                            <Icon size={16} color={config.color(colors)} />
                          </View>
                          <View style={styles.resultBody}>
                            <AppText variant="body" weight="bold" style={{ color: colors.text }} numberOfLines={1}>
                              {result.title}
                            </AppText>
                            <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary }} numberOfLines={1}>
                              {result.subtitle}
                            </AppText>
                          </View>
                          <ExternalLink size={14} color={colors.textSecondary} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
  },
  handleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 12,
    position: 'relative',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  closeBtn: {
    position: 'absolute',
    right: 20,
    top: 0,
    padding: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: Fonts.medium,
    height: 48,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  resultIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  resultBody: {
    flex: 1,
  },
});
