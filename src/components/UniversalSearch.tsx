import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Dimensions,
  TouchableWithoutFeedback,
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
  ChevronRight,
  TrendingDown,
  AlertTriangle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSettings } from '@/context/SettingsContext';
import { AppText, AppNumber } from '@/components/ui';
import { searchAll, SearchResult } from '@/services/searchService';
import { Fonts } from '@/constants/theme';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const { height } = Dimensions.get('window');

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

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 150,
};

const HighlightedText = React.memo(({
  text,
  query,
  highlightColor,
  textColor,
  variant = 'body',
  weight = 'bold',
  numberOfLines = 1,
}: {
  text: string;
  query: string;
  highlightColor: string;
  textColor: string;
  variant?: any;
  weight?: any;
  numberOfLines?: number;
}) => {
  if (!query.trim()) {
    return <AppText variant={variant} weight={weight} color={textColor} numberOfLines={numberOfLines}>{text}</AppText>;
  }

  const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));

  return (
    <AppText variant={variant} weight={weight} color={textColor} numberOfLines={numberOfLines}>
      {parts.map((part, index) => {
        const isMatch = part.toLowerCase() === query.toLowerCase();
        return isMatch ? (
          <AppText key={index} variant={variant} weight="extrabold" color={highlightColor}>{part}</AppText>
        ) : (
          part
        );
      })}
    </AppText>
  );
});
HighlightedText.displayName = 'HighlightedText';

const SearchResultRow = React.memo(({ 
  result, 
  config, 
  index, 
  query, 
  colors, 
  onPress 
}: { 
  result: SearchResult; 
  config: any; 
  index: number; 
  query: string; 
  colors: any; 
  onPress: () => void;
}) => {
  const Icon = config.icon;
  const themeColor = config.color(colors);
  
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => { scale.value = withSpring(0.96, SPRING_CONFIG); };
  const handlePressOut = () => { scale.value = withSpring(1, SPRING_CONFIG); };

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * 40).springify().damping(22)}
      layout={Layout.springify()}
      style={[pressStyle, { marginBottom: 8 }]}
    >
      <TouchableWithoutFeedback
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
      >
        <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.resultIconBox, { backgroundColor: themeColor + '15' }]}>
            <Icon size={18} color={themeColor} />
          </View>
          <View style={styles.resultInfo}>
            <HighlightedText
              text={result.title}
              query={query}
              highlightColor={colors.primary}
              textColor={colors.text}
              variant="body"
              weight="bold"
            />
            {!!result.subtitle && (
              <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
                {result.subtitle}
              </AppText>
            )}
          </View>
          <View style={[styles.actionBtn, { backgroundColor: colors.background }]}>
             <ChevronRight size={16} color={colors.textSecondary} />
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Animated.View>
  );
});
SearchResultRow.displayName = 'SearchResultRow';

export function UniversalSearch({ visible, onClose, onNavigate }: UniversalSearchProps) {
  const { colors, t, calendarType, language } = useSettings();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setQuery('');
      setResults([]);
      setTimeout(() => {
        setIsFocused(true);
        inputRef.current?.focus();
      }, 300); // Wait for modal animation
    } else {
      setIsFocused(false);
    }
  }, [visible]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        setResults(searchAll(query, t, calendarType, language));
      } else {
        setResults([]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query, t, calendarType, language]);

  const grouped = useMemo(() => results.reduce((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {} as Record<string, SearchResult[]>), [results]);

  const typeOrder = useMemo(() => Object.keys(TYPE_CONFIG).filter((t) => grouped[t]), [grouped]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (onNavigate) onNavigate(result);
      else onClose();
    },
    [onNavigate, onClose],
  );

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
            <Animated.View entering={FadeIn.duration(300)} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)' }]} />
          </Pressable>
          
          <Animated.View 
            entering={FadeInUp.springify().damping(24).stiffness(200)}
            style={[styles.sheet, { backgroundColor: colors.background }]}
          >
            {/* Ambient background glows */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
               <View style={[styles.glowBlob, { top: -50, left: -50, backgroundColor: colors.primary + '15' }]} />
               <View style={[styles.glowBlob, { right: -50, top: 100, backgroundColor: colors.secondary + '10' }]} />
            </View>

            <View style={styles.header}>
               <View style={[styles.handle, { backgroundColor: colors.border }]} />
               <View style={styles.headerTitleRow}>
                 <AppText variant="title" weight="bold" style={{ color: colors.text }}>
                    {t('sale.global_retrieval')}
                 </AppText>
                 <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.card, borderColor: colors.border }]} activeOpacity={0.7}>
                   <X size={18} color={colors.textSecondary} />
                 </TouchableOpacity>
               </View>
            </View>

            <View style={styles.searchContainer}>
              <Animated.View style={[
                styles.inputWrapper, 
                { backgroundColor: colors.card, borderColor: isFocused ? colors.primary : colors.border },
                isFocused && { shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 }
              ]}>
                <Search size={20} color={isFocused ? colors.primary : colors.textSecondary} />
                <TextInput
                  ref={inputRef}
                  style={[styles.input, { color: colors.text }]}
                   placeholder={t('search.placeholder')}
                  placeholderTextColor={colors.textSecondary}
                  value={query}
                  onChangeText={setQuery}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                  selectionColor={colors.primary}
                />
                {query.length > 0 && (
                  <TouchableOpacity 
                    onPress={() => { setQuery(''); inputRef.current?.focus(); }}
                    style={styles.clearBtn}
                    activeOpacity={0.7}
                  >
                    <X size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </Animated.View>
            </View>

            <View style={styles.content}>
              {query.trim().length === 0 && results.length === 0 ? (
                <Animated.View entering={FadeIn.delay(100)} style={styles.emptyState}>
                  <View style={[styles.emptyIconBox, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '20' }]}>
                    <Search size={32} color={colors.primary} />
                  </View>
                  <AppText variant="heading" weight="bold" style={{ color: colors.text, marginTop: 16 }}>
                    {t('search.hint')}
                  </AppText>
                  <AppText variant="body-sm" weight="medium" align="center" style={{ color: colors.textSecondary, marginTop: 6, paddingHorizontal: 40 }}>
                    {t('search.hint_desc')}
                  </AppText>
                </Animated.View>
              ) : results.length === 0 && query.trim().length > 0 ? (
                <Animated.View entering={FadeIn} style={styles.emptyState}>
                  <View style={[styles.emptyIconBox, { backgroundColor: colors.error + '10', borderColor: colors.error + '20' }]}>
                    <AlertTriangle size={32} color={colors.error} />
                  </View>
                  <AppText variant="heading" weight="bold" style={{ color: colors.text, marginTop: 16 }}>
                    {t('search.no_results')}
                  </AppText>
                  <AppText variant="body-sm" weight="medium" align="center" style={{ color: colors.textSecondary, marginTop: 6, paddingHorizontal: 40 }}>
                    {t('search.no_results_msg', { query })}
                  </AppText>
                </Animated.View>
              ) : (
                <Animated.FlatList
                  data={typeOrder}
                  keyExtractor={(item) => item}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.listContent}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item: type, index: sectionIndex }) => {
                    const items = grouped[type];
                    const config = TYPE_CONFIG[type];
                    const Icon = config.icon;
                    return (
                      <Animated.View entering={FadeInDown.delay(sectionIndex * 50)} style={styles.section}>
                        <View style={styles.sectionHeader}>
                          <View style={[styles.sectionBadge, { backgroundColor: config.color(colors) + '15' }]}>
                            <Icon size={14} color={config.color(colors)} />
                            <AppText variant="caption" weight="bold" transform="uppercase" style={{ color: config.color(colors), marginLeft: 6 }}>
                              {t(config.labelKey)}
                            </AppText>
                          </View>
                          <View style={[styles.countBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <AppText variant="micro" weight="bold" style={{ color: colors.textSecondary }}>
                              {items.length}
                            </AppText>
                          </View>
                        </View>
                        <View style={styles.sectionItems}>
                          {items.slice(0, 5).map((result, idx) => (
                            <SearchResultRow
                              key={result.id}
                              result={result}
                              config={config}
                              index={idx}
                              query={query}
                              colors={colors}
                              onPress={() => handleSelect(result)}
                            />
                          ))}
                        </View>
                      </Animated.View>
                    );
                  }}
                />
              )}
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-start', // Modal slides from top or acts as a full-screen sheet
  },
  sheet: {
    flex: 1,
    marginTop: Platform.OS === 'ios' ? 50 : 20, // Leave some space at top
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  glowBlob: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.5,
  },
  header: {
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
    zIndex: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
    zIndex: 10,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: Fonts.medium,
    height: '100%',
  },
  clearBtn: {
    padding: 6,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
  },
  content: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    paddingTop: height * 0.15,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  sectionItems: {
    gap: 8,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  resultIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  resultInfo: {
    flex: 1,
    marginRight: 10,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
