import React, { useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Fonts } from "@/constants/theme";
import { Image } from "expo-image";
import {
  Package,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  ArrowRight,
  PlusCircle,
} from "lucide-react-native";
import { useSettings } from "@/context/SettingsContext";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, Layout } from "react-native-reanimated";
import { getSalesGlass } from "./glass-sales";
import { AppText, AppNumber } from "@/components/ui";
import { getLinePrice, getLineUnitLabel, getLineStock, calcLineTotal, cartSubtotal } from '@/utils/cartUtils';
const PendingRow = React.memo(
  ({
    item,
    index,
    onUpdate,
    onRemove,
  }: {
    item: any;
    index: number;
    onUpdate?: (id: string, updates: any) => void;
    onRemove?: (id: string) => void;
  }) => {
    const { colors } = useSettings();
    const SALES_GLASS = useMemo(() => getSalesGlass(colors), [colors]);
    const currentUnitPrice = getLinePrice(item);
    const currentUnitLabel = getLineUnitLabel(item) || 'pcs';
    const lineTotal = calcLineTotal(item);

    const decrement = useCallback(() => {
      if (item.quantity > 1)
        onUpdate?.(item.id, {
          quantity: Math.max(1, (item.quantity || 1) - 1),
        });
    }, [item, onUpdate]);

    const increment = useCallback(() => {
      const maxStock = getLineStock(item);
      if ((item.quantity || 0) >= maxStock) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }
      onUpdate?.(item.id, { quantity: (item.quantity || 0) + 1 });
    }, [item, onUpdate]);

    const handleRemove = useCallback(
      () => onRemove?.(item.id),
      [item.id, onRemove],
    );

    return (
      <Animated.View
        entering={FadeInDown.delay(Math.min(index, 6) * 50).duration(500)}
      >
        <View
          style={[
            styles.itemCard,
            { backgroundColor: SALES_GLASS.bgCard, borderColor: SALES_GLASS.border },
          ]}
        >
          <View style={styles.cardHeader}>
            <View
              style={[styles.iconBox, { backgroundColor: SALES_GLASS.fg + "08" }]}
            >
              {item.image ? (
                <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
              ) : (
                <Package size={20} color={SALES_GLASS.fg} />
              )}
            </View>
            <View style={styles.nameArea}>
              <AppText
                variant="body"
                weight="bold"
                style={[styles.itemName, { color: SALES_GLASS.fg }]}
                numberOfLines={1}
              >
                {item.name}
              </AppText>
              <View
                style={[
                  styles.unitBadge,
                  { backgroundColor: colors.primary + "15" },
                ]}
              >
                <AppText
                  variant="micro"
                  weight="bold"
                  transform="uppercase"
                  shrink={false}
                  style={[styles.unitBadgeText, { color: colors.primary }]}
                  numberOfLines={1}
                >
                  {currentUnitLabel}
                </AppText>
              </View>
            </View>
            <View style={styles.costArea}>
              <AppNumber
                value={lineTotal}
                size="body"
                weight="bold"
                showCurrency
                color={SALES_GLASS.fg}
                style={styles.linePrice}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <AppNumber
                  value={currentUnitPrice}
                  size="caption"
                  weight="medium"
                  color={SALES_GLASS.fgSecondary}
                  style={styles.unitPrice}
                />
                <AppText
                  variant="caption"
                  weight="medium"
                  style={[styles.unitPrice, { color: SALES_GLASS.fgSecondary }]}
                  numberOfLines={1}
                >
                  {" / Unit"}
                </AppText>
              </View>
            </View>
          </View>

          <View style={[styles.cardFooter, { borderTopColor: SALES_GLASS.border }]}>
            <View
              style={[
                styles.qtyControl,
                {
                  backgroundColor: SALES_GLASS.bgCard,
                  borderColor: SALES_GLASS.border,
                },
              ]}
            >
              <TouchableOpacity style={styles.qtyBtn} onPress={decrement}>
                <Minus size={14} color={SALES_GLASS.fg} />
              </TouchableOpacity>
              <AppNumber
                value={item.quantity}
                size="body"
                weight="bold"
                color={SALES_GLASS.fg}
                style={styles.qtyValue}
              />
              <TouchableOpacity style={styles.qtyBtn} onPress={increment}>
                <Plus size={14} color={SALES_GLASS.fg} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.removeBtn,
                { backgroundColor: colors.error + "15" },
              ]}
              onPress={handleRemove}
            >
              <Trash2 size={16} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    );
  },
);
PendingRow.displayName = "PendingRow";

interface PendingSalesProps {
  items: any[];
  onUpdateItem?: (id: string, updates: any) => void;
  onRemoveItem?: (id: string) => void;
  onAddMore?: () => void;
  onFinish?: () => void;
}

const PendingSales: React.FC<PendingSalesProps> = ({
  items,
  onUpdateItem,
  onRemoveItem,
  onAddMore,
  onFinish,
}) => {
  const { colors, t, theme } = useSettings();
  const SALES_GLASS = useMemo(() => getSalesGlass(colors), [colors]);
  const safeItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const totalAmount = useMemo(() => cartSubtotal(safeItems), [safeItems]);

  const renderItem = useCallback(
    ({ item, index }: { item: any; index: number }) => (
      <PendingRow
        item={item}
        index={index}
        onUpdate={onUpdateItem}
        onRemove={onRemoveItem}
      />
    ),
    [onUpdateItem, onRemoveItem],
  );

  const keyExtractor = useCallback((item: any) => item.id, []);

  return (
    <View style={[styles.container, { backgroundColor: SALES_GLASS.bg }]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={{ position: 'absolute', top: -120, left: -60, width: 320, height: 320, borderRadius: 160, backgroundColor: SALES_GLASS.mutedLight }} />
        <View style={{ position: 'absolute', bottom: -100, right: -50, width: 280, height: 280, borderRadius: 140, backgroundColor: SALES_GLASS.glow }} />
        <View style={{ position: 'absolute', top: '40%', left: '30%', width: 200, height: 200, borderRadius: 100, backgroundColor: SALES_GLASS.mutedLight }} />
      </View>
      <View style={styles.headerRow}>
        <View>
          <AppText
            variant="micro"
            weight="bold"
            transform="uppercase"
            style={[styles.headerSub, { color: SALES_GLASS.fgSecondary }]}
            numberOfLines={1}
          >
            {t("sale.active_transaction")}
          </AppText>
          <AppText
            variant="title"
            weight="bold"
            style={[styles.header, { color: SALES_GLASS.fg }]}
            numberOfLines={2}
          >
            {t("sale.orchestration_ledger")}
          </AppText>
        </View>
        <View
          style={[styles.badgeNode, { backgroundColor: SALES_GLASS.fg + "08" }]}
        >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <AppNumber
            value={safeItems.length}
            size="caption"
            weight="bold"
            color={SALES_GLASS.fg}
            style={styles.itemCount}
          />
          <AppText
            variant="caption"
            weight="bold"
            style={[styles.itemCount, { color: SALES_GLASS.fg }]}
            numberOfLines={1}
          >
            {" Units"}
          </AppText>
        </View>
        </View>
      </View>

      <Animated.FlatList
        data={safeItems}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        itemLayoutAnimation={Layout.springify()}
        renderItem={renderItem}
        initialNumToRender={10}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews={true}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <View
              style={[
                styles.emptyIconCircle,
                { backgroundColor: SALES_GLASS.fg + "05" },
              ]}
            >
              <ShoppingCart size={48} color={SALES_GLASS.border} strokeWidth={1} />
            </View>
            <AppText
              variant="title"
              weight="bold"
              align="center"
              style={[styles.emptyTitle, { color: SALES_GLASS.fg }]}
              numberOfLines={2}
            >
              {t("sale.ledger_is_empty")}
            </AppText>
            <AppText
              variant="body"
              weight="medium"
              align="center"
              style={[styles.emptySub, { color: SALES_GLASS.fgSecondary }]}
              numberOfLines={3}
            >
              {t("sale.add_assets_begin")}
            </AppText>
            <TouchableOpacity
              style={[styles.addInitialBtn, { backgroundColor: SALES_GLASS.fg }]}
              onPress={onAddMore}
            >
              <PlusCircle size={18} color={SALES_GLASS.bg} />
              <AppText
                variant="body-sm"
                weight="bold"
                shrink={false}
                style={[styles.addInitialBtnText, { color: SALES_GLASS.bg }]}
                numberOfLines={1}
              >
                {t("sale.begin_search")}
              </AppText>
            </TouchableOpacity>
          </View>
        )}
      />

      {safeItems.length > 0 && (
        <View
          style={[styles.checkoutAnchor, { borderTopColor: SALES_GLASS.border }]}
        >
          <View
            style={[styles.checkoutBlur, { backgroundColor: colors.background }]}
          >
            <View style={styles.summaryBox}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <AppText
                  variant="micro"
                  weight="bold"
                  transform="uppercase"
                  style={[styles.summaryLabel, { color: SALES_GLASS.fgSecondary }]}
                  numberOfLines={1}
                >
                  {t("sale.total_settlement")}
                </AppText>
                <AppNumber
                  value={totalAmount}
                  size="title"
                  weight="bold"
                  showCurrency
                  color={SALES_GLASS.fg}
                  adjustsFontSizeToFit
                  style={styles.totalAmount}
                />
              </View>

              <View style={styles.actionCluster}>
                <TouchableOpacity
                  style={[styles.moreBtn, { borderColor: SALES_GLASS.border }]}
                  onPress={onAddMore}
                >
                  <Plus size={22} color={SALES_GLASS.fg} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.checkoutBtn, { backgroundColor: SALES_GLASS.fg }]}
                  onPress={onFinish}
                >
                  <AppText
                    variant="body"
                    weight="bold"
                    shrink={false}
                    style={[
                      styles.checkoutBtnText,
                      { color: SALES_GLASS.bg },
                    ]}
                    numberOfLines={1}
                  >
                    {t("sale.commit")}
                  </AppText>
                  <ArrowRight size={18} color={SALES_GLASS.bg} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 25,
    paddingTop: 20,
    marginBottom: 20,
  },
  headerSub: {
    fontFamily: Fonts.semibold,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  header: {
    fontFamily: Fonts.bold,
  },
  badgeNode: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  itemCount: {
    fontFamily: Fonts.bold,
  },
  listContent: {
    paddingHorizontal: 25,
    paddingBottom: 160,
  },
  itemCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  nameArea: {
    flex: 1,
    marginLeft: 14,
  },
  itemName: {
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  unitBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  unitBadgeText: {
    fontFamily: Fonts.bold,
    textTransform: "uppercase",
  },
  costArea: {
    alignItems: "flex-end",
  },
  linePrice: {
    fontFamily: Fonts.bold,
  },
  currency: {
    opacity: 0.6,
  },
  unitPrice: {
    fontFamily: Fonts.medium,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  qtyControl: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
  },
  qtyBtn: {
    padding: 10,
  },
  qtyValue: {
    width: 36,
    textAlign: "center",
    fontFamily: Fonts.bold,
  },
  removeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 100,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontFamily: Fonts.bold,
  },
  emptySub: {
    fontFamily: Fonts.medium,
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  addInitialBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    marginTop: 25,
    gap: 8,
  },
  addInitialBtnText: {
    fontFamily: Fonts.bold,
  },

  checkoutAnchor: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    borderTopWidth: 1,
  },
  checkoutBlur: {
    paddingHorizontal: 25,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 25,
  },
  summaryBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    fontFamily: Fonts.semibold,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  totalAmount: {
    fontFamily: Fonts.bold,
  },
  totalCurrency: {
    opacity: 0.6,
  },
  actionCluster: {
    flexDirection: "row",
    gap: 12,
  },
  moreBtn: {
    width: 60,
    height: 60,
    borderWidth: 1.5,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  checkoutBtn: {
    flexDirection: "row",
    height: 60,
    paddingHorizontal: 25,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  checkoutBtnText: {
    fontFamily: Fonts.bold,
  },
});

export default PendingSales;