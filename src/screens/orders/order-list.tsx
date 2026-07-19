import React, { useCallback, useState, useMemo } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSettings } from "@/context/SettingsContext";
import { useSidebar } from "@/context/SidebarContext";
import {
  getOrders,
  getOrderSummary,
} from "@/database/db";
import { AppNumber, AppText } from "@/components/ui";
import { Fonts, LightTheme } from "@/constants/theme";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  Package,
  Plus,
  ShoppingBag,
  XCircle,
  Clock,
  ChevronRight,
  User,
} from "lucide-react-native";
import { getOrdersGlass } from './glass-orders';
import { useTutorial, TutorialTarget, TutorialButton } from '@/tutorials';
import { ordersTutorial } from '@/tutorials/definitions';

const ORD_GLASS = getOrdersGlass(LightTheme);


type OrderTab = "active" | "converted" | "cancelled" | "all";

const TAB_OPTIONS: { key: OrderTab; labelKey: string }[] = [
  { key: "active", labelKey: "order.active" },
  { key: "converted", labelKey: "order.completed" },
  { key: "cancelled", labelKey: "order.cancelled_tab" },
];

const statusColors: Record<string, string> = {
  Order: ORD_GLASS.muted,
  Sale: ORD_GLASS.fgSecondary,
  Debt: ORD_GLASS.fgSecondary,
  Cancelled: ORD_GLASS.muted,
};

const statusIcons: Record<string, React.ReactNode> = {
  Order: <Clock size={14} color={ORD_GLASS.muted} />,
  Sale: <ShoppingBag size={14} color={ORD_GLASS.fgSecondary} />,
  Debt: <Package size={14} color={ORD_GLASS.fgSecondary} />,
  Cancelled: <XCircle size={14} color={ORD_GLASS.muted} />,
};

const OrderCard = React.memo(
  ({ order, index }: { order: any; index: number }) => {
    const { colors, t } = useSettings();
    const ORD_GLASS = useMemo(() => getOrdersGlass(colors), [colors]);
    const router = useRouter();
    const statusColor = statusColors[order.status] || ORD_GLASS.fgSecondary;

    return (
      <Animated.View
        entering={FadeInDown.delay(Math.min(index, 10) * 50).duration(500)}
      >
        <TouchableOpacity
          style={[
            styles.orderCard,
            { backgroundColor: ORD_GLASS.bgCard, borderColor: ORD_GLASS.border },
          ]}
          activeOpacity={0.7}
          onPress={() => (router as any).push(`/order-detail/${order.id}`)}
        >
          <View style={styles.cardTop}>
            <View style={styles.orderInfo}>
              <AppText
                variant="body"
                weight="bold"
                style={[styles.orderNumber, { color: ORD_GLASS.fg }]}
                numberOfLines={1}
              >
                {order.orderNumber}
              </AppText>
              <AppText
                variant="caption"
                weight="medium"
                style={[styles.orderDate, { color: ORD_GLASS.fgSecondary }]}
                numberOfLines={1}
              >
                {new Date(order.createdAt).toLocaleDateString()}
              </AppText>
            </View>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: ORD_GLASS.bgCard },
              ]}
            >
              {statusIcons[order.status]}
              <AppText
                variant="micro"
                weight="bold"
                style={[styles.statusText, { color: statusColor }]}
                numberOfLines={1}
              >
                {order.status}
              </AppText>
            </View>
          </View>

          <View style={[styles.cardDivider, { backgroundColor: ORD_GLASS.border }]} />

          <View style={styles.cardBottom}>
            <View style={styles.customerInfo}>
              <User size={14} color={ORD_GLASS.fgSecondary} />
              <AppText
                variant="body-sm"
                weight="medium"
                style={[styles.customerName, { color: ORD_GLASS.fgSecondary }]}
                numberOfLines={1}
              >
                {order.customerName || t("common.guest")}
              </AppText>
            </View>
            <View style={styles.amountRow}>
            <AppNumber
              value={Number(order.totalPrice)}
              showCurrency
              size="body"
              weight="bold"
              style={[styles.amount, { color: ORD_GLASS.fg }]}
            />
              <ChevronRight size={16} color={ORD_GLASS.border} />
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  },
);
OrderCard.displayName = "OrderCard";

const OrdersScreen = () => {
  const { colors, t } = useSettings();
  const ORD_GLASS = useMemo(() => getOrdersGlass(colors), [colors]);
  const { openSidebar } = useSidebar();
  const router = useRouter();
  const tutorial = useTutorial({ tutorial: ordersTutorial });
  const [activeTab, setActiveTab] = useState<OrderTab>("active");
  const [orders, setOrders] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadOrders = useCallback(() => {
    const statusMap: Record<OrderTab, string | undefined> = {
      active: "Order",
      converted: undefined,
      cancelled: "Cancelled",
      all: undefined,
    };

    const statusFilter = statusMap[activeTab];
    const allOrders = getOrders(statusFilter);

    if (activeTab === "converted") {
      setOrders(allOrders.filter((o: any) => o.status === "Sale" || o.status === "Debt"));
    } else {
      setOrders(allOrders);
    }

    setSummary(getOrderSummary());
  }, [activeTab]);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [loadOrders]),
  );

  const onRefresh = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setRefreshing(true);
    loadOrders();
    setTimeout(() => setRefreshing(false), 800);
  }, [loadOrders]);

  const renderTabBar = () => (
    <View style={[styles.tabBar, { backgroundColor: ORD_GLASS.bgCard, borderColor: ORD_GLASS.border }]}>
      {TAB_OPTIONS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tabItem,
              isActive && { backgroundColor: ORD_GLASS.fg },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab(tab.key);
            }}
            activeOpacity={0.7}
          >
            <AppText
              variant="body-sm"
              weight="bold"
              style={[
                styles.tabText,
                { color: isActive ? ORD_GLASS.bg : ORD_GLASS.fgSecondary },
              ]}
              numberOfLines={1}
            >
              {t(tab.labelKey)}
            </AppText>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderSummaryCards = () => {
    if (!summary) return null;
    const cards = [
      {
        label: t('order.active'),
        value: summary.active || 0,
        color: ORD_GLASS.muted,
        icon: <Clock size={18} color={ORD_GLASS.muted} />,
      },
      {
        label: t('order.completed'),
        value: summary.converted || 0,
        color: ORD_GLASS.fgSecondary,
        icon: <ShoppingBag size={18} color={ORD_GLASS.fgSecondary} />,
      },
      {
        label: t('order.cancelled_tab'),
        value: summary.cancelled || 0,
        color: ORD_GLASS.muted,
        icon: <XCircle size={18} color={ORD_GLASS.muted} />,
      },
    ];

    return (
      <View style={styles.summaryRow}>
        {cards.map((card, idx) => (
          <View
            key={idx}
            style={[
              styles.summaryCard,
              { backgroundColor: ORD_GLASS.bgCard, borderColor: ORD_GLASS.border },
            ]}
          >
            <View style={[styles.summaryIcon, { backgroundColor: ORD_GLASS.bgCard }]}>
              {card.icon}
            </View>
            <AppNumber
              value={card.value}
              size="title"
              weight="extrabold"
              style={[styles.summaryValue, { color: ORD_GLASS.fg }]}
            />
            <AppText
              variant="caption"
              weight="medium"
              style={[styles.summaryLabel, { color: ORD_GLASS.fgSecondary }]}
              numberOfLines={1}
            >
              {card.label}
            </AppText>
          </View>
        ))}
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIcon, { backgroundColor: ORD_GLASS.bgCard }]}>
        <Package size={40} color={ORD_GLASS.fgSecondary} />
      </View>
      <AppText
        variant="body"
        weight="bold"
        style={[styles.emptyTitle, { color: ORD_GLASS.fgSecondary }]}
      >
        No orders found
      </AppText>
      <AppText
        variant="body-sm"
        weight="medium"
        style={[styles.emptySubtitle, { color: ORD_GLASS.fgSecondary }]}
      >
        Create a new order to get started
      </AppText>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: ORD_GLASS.bg }]}>
      {/* Ambient glow washes */}
      <View style={styles.glowTopRight} />
      <View style={styles.glowBottomLeft} />
      <View style={styles.glowCenter} />
      <TutorialTarget id="ord-header">
      <View style={styles.header}>
        <TouchableOpacity onPress={openSidebar} style={styles.menuBtn}>
          <View style={[styles.menuDot, { backgroundColor: ORD_GLASS.fg }]} />
          <View style={[styles.menuDot, { backgroundColor: ORD_GLASS.fg }]} />
          <View style={[styles.menuDot, { backgroundColor: ORD_GLASS.fg }]} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <AppText
            variant="micro"
            weight="bold"
            transform="uppercase"
            style={[styles.headerSub, { color: ORD_GLASS.fgSecondary }]}
            numberOfLines={1}
          >
            Sales
          </AppText>
          <AppText
            variant="heading-lg"
            weight="bold"
            style={[styles.headerTitle, { color: ORD_GLASS.fg }]}
            numberOfLines={1}
          >
            Order Management
          </AppText>
        </View>
        <TutorialButton tutorialId="orders" screenName={t('screen.orders')} />
      </View>
      </TutorialTarget>

      <TutorialTarget id="ord-list">
      <FlatList
        data={orders}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => (
          <OrderCard order={item} index={index} />
        )}
        ListHeaderComponent={
          <>
            {renderSummaryCards()}
            {renderTabBar()}
          </>
        }
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ORD_GLASS.fg}
          />
        }
      />
      </TutorialTarget>

      <TutorialTarget id="ord-add-btn">
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: ORD_GLASS.fg }]}
        activeOpacity={0.8}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          (router as any).push("/create-order");
        }}
      >
        <Plus size={24} color={ORD_GLASS.bg} />
      </TouchableOpacity>
      </TutorialTarget>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    gap: 14,
  },
  menuBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    gap: 3,
  },
  menuDot: {
    width: 18,
    height: 2.5,
    borderRadius: 2,
  },
  headerSub: {
    fontFamily: Fonts.bold,
    letterSpacing: 1,
  },
  headerTitle: {
    fontFamily: Fonts.bold,
    marginTop: 2,
  },
  summaryRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
    gap: 6,
    overflow: 'hidden',
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  summaryValue: {
    fontFamily: Fonts.extrabold,
  },
  summaryLabel: {
    fontFamily: Fonts.medium,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tabBar: {
    flexDirection: "row",
    marginHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    padding: 4,
    marginBottom: 16,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  tabText: {
    fontFamily: Fonts.bold,
  },
  listContent: {
    paddingBottom: 100,
  },
  orderCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderInfo: {
    flex: 1,
    gap: 2,
  },
  orderNumber: {
    fontFamily: Fonts.bold,
  },
  orderDate: {
    fontFamily: Fonts.medium,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusText: {
    fontFamily: Fonts.bold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cardDivider: {
    height: 1,
    marginVertical: 12,
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  customerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  customerName: {
    fontFamily: Fonts.medium,
    flex: 1,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  amount: {
    fontFamily: Fonts.bold,
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 60,
    gap: 10,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  emptyTitle: {
    fontFamily: Fonts.bold,
  },
  emptySubtitle: {
    fontFamily: Fonts.medium,
  },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: ORD_GLASS.fg,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  glowTopRight: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: ORD_GLASS.mutedLight,
    opacity: 0.4,
    pointerEvents: 'none',
  },
  glowBottomLeft: {
    position: 'absolute',
    bottom: -80,
    left: -120,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: ORD_GLASS.mutedLight,
    opacity: 0.25,
    pointerEvents: 'none',
  },
  glowCenter: {
    position: 'absolute',
    top: '40%',
    alignSelf: 'center',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: ORD_GLASS.mutedLight,
    opacity: 0.15,
    pointerEvents: 'none',
  },
});

export default OrdersScreen;