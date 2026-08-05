import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect, useRouter, useLocalSearchParams } from "expo-router";
import { useSettings } from "@/context/SettingsContext";
import { formatDate, parseLocalDate } from '@/utils/date-utils';
import { useDialog } from "@/context/DialogContext";
import { useToast } from "@/context/ToastContext";
import {
  getOrderById,
  convertOrderToSale,
  convertOrderToDebt,
  cancelOrder,
} from "@/database/db";
import { AppNumber, AppText } from "@/components/ui";
import { Fonts, LightTheme } from "@/constants/theme";
import * as Haptics from "expo-haptics";
import { playBad } from '@/services/soundService';
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  ChevronLeft,
  Package,
  ShoppingBag,
  XCircle,
  User,
  FileText,
  ArrowRight,
  Calendar,
  Check,
} from "lucide-react-native";
import { useTutorial, TutorialTarget, TutorialButton, TutorialScrollView } from '@/tutorials';
import { orderDetailTutorial } from '@/tutorials/definitions';
import { getOrdersGlass } from './glass-orders';

const ORD_GLASS = getOrdersGlass(LightTheme);


const statusColors: Record<string, string> = {
  Order: ORD_GLASS.muted,
  Sale: ORD_GLASS.fgSecondary,
  Debt: ORD_GLASS.fgSecondary,
  Cancelled: ORD_GLASS.muted,
};

const OrderDetailScreen = () => {
  const { colors, t, calendarType, language } = useSettings();
  const ORD_GLASS = useMemo(() => getOrdersGlass(colors), [colors]);
  const router = useRouter();
  const dialog = useDialog();
  const { showToast } = useToast();
  const tutorial = useTutorial({ tutorial: orderDetailTutorial });
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadOrder = useCallback(() => {
    if (!id) return;
    const data = getOrderById(Number(id));
    setOrder(data);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadOrder();
    }, [loadOrder]),
  );

  const handleConvertToSale = async () => {
    const confirmed = await dialog.confirm({
      title: t('order.convert_to_sale'),
      message: t('order.convert_sale_desc'),
      confirmText: t('common.confirm') || 'Convert',
      cancelText: t('common.cancel'),
      iconType: "warning",
    });
    if (!confirmed) return;

    setActionLoading("sale");
    const result = convertOrderToSale(Number(id));
    setActionLoading(null);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast({ title: t('toast.order_converted'), message: t('order.converted_sale'), type: 'success' });
      loadOrder();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      playBad();
      await dialog.alert({
        title: t('order.conversion_failed'),
        message: result.error || t('order.conversion_failed'),
        iconType: "danger",
      });
    }
  };

  const handleConvertToDebt = async () => {
    const confirmed = await dialog.confirm({
      title: t('order.convert_to_debt'),
      message: t('order.convert_debt_desc'),
      confirmText: t('common.confirm') || 'Convert',
      cancelText: t('common.cancel'),
      iconType: "warning",
    });
    if (!confirmed) return;

    setActionLoading("debt");
    const result = convertOrderToDebt(Number(id));
    setActionLoading(null);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast({ title: t('toast.order_converted'), message: t('order.converted_debt'), type: 'success' });
      loadOrder();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      playBad();
      await dialog.alert({
        title: t('order.conversion_failed'),
        message: result.error || t('order.conversion_failed'),
        iconType: "danger",
      });
    }
  };

  const handleCancel = async () => {
    const confirmed = await dialog.confirm({
      title: t('order.cancel_order'),
      message: t('order.cancel_desc'),
      confirmText: t('order.cancel_order'),
      cancelText: t('order.keep_order'),
      iconType: "danger",
      destructive: true,
    });
    if (!confirmed) return;

    setActionLoading("cancel");
    const result = cancelOrder(Number(id));
    setActionLoading(null);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      playBad();
      showToast({ title: t('toast.order_cancelled'), message: t('order.cancelled_msg'), type: 'info' });
      loadOrder();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      playBad();
      await dialog.alert({
        title: t('common.error'),
        message: result.error || t('order.cancel_failed'),
        iconType: "danger",
      });
    }
  };

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: ORD_GLASS.bg },
        ]}
      >
        <ActivityIndicator size="large" color={ORD_GLASS.fg} />
      </View>
    );
  }

  if (!order) {
    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: ORD_GLASS.bg },
        ]}
      >
        <AppText variant="body" weight="bold" style={{ color: ORD_GLASS.fgSecondary }}>
          Order not found
        </AppText>
      </View>
    );
  }

  const statusColor = statusColors[order.status] || ORD_GLASS.fgSecondary;
  const isActive = order.status === "Order";

  return (
    <View style={[styles.container, { backgroundColor: ORD_GLASS.bg }]}>
      {/* Ambient glow washes */}
      <View style={styles.glowTopRight} />
      <View style={styles.glowBottomLeft} />
      <View style={styles.glowCenter} />
      <TutorialTarget id="od-header" style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[
            styles.backBtn,
            { backgroundColor: ORD_GLASS.bgCard, borderColor: ORD_GLASS.border },
          ]}
        >
          <ChevronLeft size={20} color={ORD_GLASS.fg} />
        </TouchableOpacity>
        <TutorialButton tutorialId="order-detail" screenName={t('screen.order_details')} />
        <View style={{ flex: 1 }}>
          <AppText
            variant="micro"
            weight="bold"
            transform="uppercase"
            style={[styles.headerSub, { color: ORD_GLASS.fgSecondary }]}
            numberOfLines={1}
          >
            Orders
          </AppText>
          <AppText
            variant="heading-lg"
            weight="bold"
            style={[styles.headerTitle, { color: ORD_GLASS.fg }]}
            numberOfLines={1}
          >
            {order.orderNumber}
          </AppText>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: ORD_GLASS.bgCard },
          ]}
        >
          <AppText
            variant="micro"
            weight="bold"
            style={[styles.statusText, { color: statusColor }]}
            numberOfLines={1}
          >
            {order.status}
          </AppText>
        </View>
      </TutorialTarget>

      <TutorialScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollPadding}
        showsVerticalScrollIndicator={false}
      >
        {/* Info Card */}
        <TutorialTarget id="od-notes">
        <Animated.View entering={FadeInDown.duration(500)}>
          <View
            style={[
              styles.infoCard,
              { backgroundColor: ORD_GLASS.bgCard, borderColor: ORD_GLASS.border },
            ]}
          >
            <View style={styles.infoRow}>
              <Calendar size={16} color={ORD_GLASS.fgSecondary} />
              <AppText
                variant="body-sm"
                weight="medium"
                style={{ color: ORD_GLASS.fgSecondary, flex: 1 }}
              >
                Created: {formatDate(new Date(order.createdAt), calendarType, language)}
              </AppText>
            </View>
            {order.convertedAt && (
              <View style={styles.infoRow}>
                <Check size={16} color={ORD_GLASS.fgSecondary} />
                <AppText
                  variant="body-sm"
                  weight="medium"
                  style={{ color: ORD_GLASS.fgSecondary, flex: 1 }}
                >
                  Converted: {formatDate(new Date(order.convertedAt), calendarType, language)}
                </AppText>
              </View>
            )}
            {order.cancelledAt && (
              <View style={styles.infoRow}>
                <XCircle size={16} color={ORD_GLASS.fgSecondary} />
                <AppText
                  variant="body-sm"
                  weight="medium"
                  style={{ color: ORD_GLASS.fgSecondary, flex: 1 }}
                >
                  Cancelled: {formatDate(new Date(order.cancelledAt), calendarType, language)}
                </AppText>
              </View>
            )}
            {order.customerName && (
              <View style={styles.infoRow}>
                <User size={16} color={ORD_GLASS.fgSecondary} />
                <AppText
                  variant="body-sm"
                  weight="medium"
                  style={{ color: ORD_GLASS.fg, flex: 1 }}
                >
                  {order.customerName}
                  {order.customerPhone ? ` - ${order.customerPhone}` : ""}
                </AppText>
              </View>
            )}
            {order.notes && (
              <View style={styles.infoRow}>
                <FileText size={16} color={ORD_GLASS.fgSecondary} />
                <AppText
                  variant="body-sm"
                  weight="medium"
                  style={{ color: ORD_GLASS.fgSecondary, flex: 1 }}
                >
                  {order.notes}
                </AppText>
              </View>
            )}
          </View>
        </Animated.View>
        </TutorialTarget>

        {/* Items */}
        <TutorialTarget id="od-items">
        <Animated.View entering={FadeInDown.delay(100)} style={styles.section}>
          <AppText
            variant="body"
            weight="bold"
            style={[styles.sectionTitle, { color: ORD_GLASS.fg }]}
          >
            Items
          </AppText>
          {order.items?.map((item: any, idx: number) => (
            <View
              key={item.id || idx}
              style={[
                styles.itemRow,
                { borderBottomColor: ORD_GLASS.border },
                idx === (order.items?.length || 0) - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <View
                style={[
                  styles.itemDot,
                  { backgroundColor: ORD_GLASS.bgCard },
                ]}
              >
                <Package size={16} color={ORD_GLASS.fg} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText
                  variant="body"
                  weight="bold"
                  style={{ color: ORD_GLASS.fg }}
                  numberOfLines={1}
                >
                  {item.itemName}
                </AppText>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <AppNumber value={Number(item.price)} showCurrency size="caption" weight="medium" style={{ color: ORD_GLASS.fgSecondary }} />
                  <AppText variant="caption" weight="medium" style={{ color: ORD_GLASS.fgSecondary }}>x</AppText>
                  <AppNumber value={item.quantity} size="caption" weight="medium" style={{ color: ORD_GLASS.fgSecondary }} />
                  <AppText variant="caption" weight="medium" style={{ color: ORD_GLASS.fgSecondary }}>{item.unit}</AppText>
                </View>
              </View>
              <AppNumber
                value={Number(item.totalPrice)}
                showCurrency
                size="body"
                weight="bold"
                style={{ color: ORD_GLASS.fg }}
              />
            </View>
          ))}
        </Animated.View>
        </TutorialTarget>

        {/* Total */}
        <TutorialTarget id="od-summary">
        <Animated.View
          entering={FadeInDown.delay(200)}
          style={[
            styles.totalCard,
            { backgroundColor: ORD_GLASS.bgCard, borderColor: ORD_GLASS.border },
          ]}
        >
          <AppText
            variant="body"
            weight="medium"
            style={{ color: ORD_GLASS.fgSecondary }}
          >
            Total Amount
          </AppText>
          <AppNumber
            value={Number(order.totalPrice)}
            showCurrency
            size="display"
            weight="extrabold"
            style={{ color: ORD_GLASS.fg }}
          />
        </Animated.View>
        </TutorialTarget>

        {/* History */}
        {order.history && order.history.length > 0 && (
          <Animated.View entering={FadeInDown.delay(300)} style={styles.section}>
            <AppText
              variant="body"
              weight="bold"
              style={[styles.sectionTitle, { color: ORD_GLASS.fg }]}
            >
              History
            </AppText>
            {order.history.map((entry: any, idx: number) => (
              <View key={entry.id || idx} style={styles.historyRow}>
                <View style={styles.timeline}>
                  <View
                    style={[
                      styles.timelineDot,
                      {
                        backgroundColor:
                          entry.toStatus === "Cancelled"
                            ? ORD_GLASS.fgSecondary
                            : entry.toStatus === "Sale" || entry.toStatus === "Debt"
                              ? ORD_GLASS.fgSecondary
                              : ORD_GLASS.muted,
                      },
                    ]}
                  />
                  {idx < order.history.length - 1 && (
                    <View
                      style={[
                        styles.timelineLine,
                        { backgroundColor: ORD_GLASS.border },
                      ]}
                    />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <AppText
                    variant="body-sm"
                    weight="bold"
                    style={{ color: ORD_GLASS.fg }}
                  >
                    {entry.fromStatus
                      ? `${entry.fromStatus} → ${entry.toStatus}`
                      : `${entry.toStatus} created`}
                  </AppText>
                  <AppText
                    variant="caption"
                    weight="medium"
                    style={{ color: ORD_GLASS.fgSecondary }}
                  >
                    {(() => {
                      const d = parseLocalDate(entry.changedAt);
                      return d ? formatDate(d, calendarType, language) : '';
                    })()}
                  </AppText>
                </View>
              </View>
            ))}
          </Animated.View>
        )}

        {/* Action Buttons */}
        {isActive && (
          <Animated.View entering={FadeInDown.delay(400)} style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: ORD_GLASS.bgCardStrong }]}
              activeOpacity={0.8}
              onPress={handleConvertToSale}
              disabled={actionLoading !== null}
            >
              {actionLoading === "sale" ? (
                <ActivityIndicator color={ORD_GLASS.fg} />
              ) : (
                <>
                  <ShoppingBag size={18} color={ORD_GLASS.fg} />
                  <AppText
                    variant="body"
                    weight="bold"
                    style={styles.actionText}
                  >
                    Convert to Sale
                  </AppText>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: ORD_GLASS.bgCard }]}
              activeOpacity={0.8}
              onPress={handleConvertToDebt}
              disabled={actionLoading !== null}
            >
              {actionLoading === "debt" ? (
                <ActivityIndicator color={ORD_GLASS.fg} />
              ) : (
                <>
                  <ArrowRight size={18} color={ORD_GLASS.fg} />
                  <AppText
                    variant="body"
                    weight="bold"
                    style={styles.actionText}
                  >
                    Convert to Debt
                  </AppText>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: ORD_GLASS.bgCardStrong }]}
              activeOpacity={0.8}
              onPress={handleCancel}
              disabled={actionLoading !== null}
            >
              {actionLoading === "cancel" ? (
                <ActivityIndicator color={ORD_GLASS.fg} />
              ) : (
                <>
                  <XCircle size={18} color={ORD_GLASS.fg} />
                  <AppText
                    variant="body"
                    weight="bold"
                    style={styles.actionText}
                  >
                    Cancel Order
                  </AppText>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        )}
      </TutorialScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
    gap: 14,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerSub: {
    fontFamily: Fonts.bold,
    letterSpacing: 1,
  },
  headerTitle: {
    fontFamily: Fonts.bold,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontFamily: Fonts.bold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  scrollContent: {
    flex: 1,
  },
  scrollPadding: {
    padding: 20,
    paddingBottom: 40,
  },
  infoCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontFamily: Fonts.bold,
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  itemDot: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  totalCard: {
    marginTop: 24,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    overflow: 'hidden',
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  historyRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 6,
    minHeight: 44,
  },
  timeline: {
    alignItems: "center",
    width: 20,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 2,
  },
  actions: {
    marginTop: 32,
    gap: 12,
    paddingBottom: 20,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 54,
    borderRadius: 18,
  },
  actionText: {
    color: ORD_GLASS.fg,
    fontFamily: Fonts.bold,
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

export default OrderDetailScreen;