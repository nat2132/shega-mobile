import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSettings } from "@/context/SettingsContext";
import { useToast } from "@/context/ToastContext";
import { useDialog } from "@/context/DialogContext";
import { searchInventory, insertOrder} from "@/database/db";
import { AppNumber, AppText } from "@/components/ui";
import { Fonts, LightTheme } from "@/constants/theme";
import * as Haptics from "expo-haptics";
import { playBad } from '@/services/soundService';
import Animated, { FadeInDown, Layout } from "react-native-reanimated";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Search,
  X,
  Package,
  Plus,
  Minus,
  ChevronLeft,
  User,
  ShoppingCart,
  FileText,
} from "lucide-react-native";
import { getOrdersGlass } from './glass-orders';
import { useTutorial, useTutorialExample, TutorialTarget, TutorialButton, TutorialScrollView } from '@/tutorials';
import { createOrderTutorial } from '@/tutorials/definitions';

const ORD_GLASS = getOrdersGlass(LightTheme);


interface CartItem {
  itemId?: number;
  itemName: string;
  quantity: number;
  unitType: string;
  unit?: string;
  price: number;
}

const CreateOrderScreen = () => {
  const { colors, t } = useSettings();
  const ORD_GLASS = useMemo(() => getOrdersGlass(colors), [colors]);
  const tutorial = useTutorial({ tutorial: createOrderTutorial });
  useEffect(() => {
    if (tutorial.isActive && tutorial.currentStep?.targetId === 'co-customer') {
      setCustomerPhone('0911-234-567');
    }
  }, [tutorial.isActive, tutorial.currentStep?.targetId]);
  const router = useRouter();
  const { showToast } = useToast();
  const dialog = useDialog();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  useTutorialExample('co-customer', setCustomerName);
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const debouncedQuery = useDebounce(searchQuery, 250);

  useFocusEffect(
    useCallback(() => {
      if (debouncedQuery.trim()) {
        const results = searchInventory(debouncedQuery.trim());
        setSearchResults(results);
      } else {
        setSearchResults([]);
      }
    }, [debouncedQuery]),
  );

  const addToCart = (item: any) => {
    Haptics.selectionAsync();
    const existing = cart.find(
      (c) => c.itemId === item.id && c.unitType === "base",
    );
    if (existing) {
      setCart((prev) =>
        prev.map((c) =>
          c.itemId === item.id && c.unitType === "base"
            ? { ...c, quantity: c.quantity + 1 }
            : c,
        ),
      );
    } else {
      setCart((prev) => [
        ...prev,
        {
          itemId: item.id,
          itemName: item.name,
          quantity: 1,
          unitType: "base",
          unit: item.baseUnit || "pcs",
          price: item.baseSellingPrice || 0,
        },
      ]);
    }
    setSearchQuery("");
    setSearchResults([]);
  };

  const updateQty = (index: number, delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCart((prev) => {
      const updated = [...prev];
      const newQty = Math.max(1, updated[index].quantity + delta);
      updated[index] = { ...updated[index], quantity: newQty };
      return updated;
    });
  };

  const removeFromCart = (index: number) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const totalPrice = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  const handleCreate = async () => {
    if (cart.length === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      await dialog.alert({
        title: t("common.error"),
        message: t('order.add_item_error'),
        iconType: "danger",
      });
      return;
    }

    setSubmitting(true);
    try {
      const orderId = insertOrder({
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        notes: notes.trim() || undefined,
        items: cart,
      });

      if (orderId) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast({ title: 'Order Created', message: t('order.create_success'), type: 'success' });
        router.back();
      } else {
        playBad();
        await dialog.alert({
          title: t("common.error"),
          message: t('order.create_failed_msg'),
          iconType: "danger",
        });
      }
    } catch (error) {
      console.error("Create order error:", error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: ORD_GLASS.bg }]}>
      {/* Ambient glow washes */}
      <View style={styles.glowTopRight} />
      <View style={styles.glowBottomLeft} />
      <View style={styles.glowCenter} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <TutorialTarget id="co-header">
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: ORD_GLASS.bgCard, borderColor: ORD_GLASS.border }]}
          >
            <ChevronLeft size={20} color={ORD_GLASS.fg} />
          </TouchableOpacity>
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
              New Order
            </AppText>
          </View>
          <View
            style={[
              styles.cartBadge,
              { backgroundColor: ORD_GLASS.fg + "10" },
            ]}
          >
            <ShoppingCart size={16} color={ORD_GLASS.fg} />
            <AppNumber
              value={cart.length}
              size="body-sm"
              weight="bold"
                style={[styles.cartCount, { color: ORD_GLASS.fg }]}
              />
            </View>
            <TutorialButton tutorialId="create-order" screenName="Create Order" />
          </View>
        </TutorialTarget>

        <TutorialScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollPadding}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Search */}
          <TutorialTarget id="co-item-search">
          <Animated.View entering={FadeInDown.duration(500)}>
            <View
              style={[
                styles.searchBar,
                { backgroundColor: ORD_GLASS.bgCard, borderColor: ORD_GLASS.border },
              ]}
            >
              <Search size={18} color={ORD_GLASS.fgSecondary} />
              <TextInput
                style={[styles.searchInput, { color: ORD_GLASS.fg }]}
                placeholder={t('order.search_items')}
                placeholderTextColor={ORD_GLASS.fgSecondary + "60"}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => { setSearchQuery(""); setSearchResults([]); }}>
                  <X size={18} color={ORD_GLASS.fgSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>

            {searchResults.length > 0 && (
              <View
                style={[
                  styles.searchResults,
                  { backgroundColor: ORD_GLASS.bgCard, borderColor: ORD_GLASS.border },
                ]}
              >
                {searchResults.map((item, idx) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.searchResultItem,
                      idx < searchResults.length - 1 && {
                        borderBottomWidth: 1,
                        borderBottomColor: ORD_GLASS.border,
                      },
                    ]}
                    onPress={() => addToCart(item)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.itemIcon,
                        { backgroundColor: ORD_GLASS.bgCard },
                      ]}
                    >
                      <Package size={18} color={ORD_GLASS.fg} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText
                        variant="body"
                        weight="bold"
                        style={{ color: ORD_GLASS.fg }}
                        numberOfLines={1}
                      >
                        {item.name}
                      </AppText>
                      <AppText
                        variant="caption"
                        weight="medium"
                        style={{ color: ORD_GLASS.fgSecondary }}
                        numberOfLines={1}
                      >
                        {item.companyName || ""} | <AppNumber value={Number(item.baseSellingPrice)} prefix="ETB " size="caption" />/{item.baseUnit}
                      </AppText>
                    </View>
                    <View
                      style={[
                        styles.addBtn,
                        { backgroundColor: ORD_GLASS.bgCard },
                      ]}
                    >
                      <Plus size={16} color={ORD_GLASS.fg} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Animated.View>
          </TutorialTarget>

          {/* Cart */}
          {cart.length > 0 && (
            <Animated.View
              entering={FadeInDown.delay(100)}
              style={styles.cartSection}
            >
              <AppText
                variant="body"
                weight="bold"
                style={[styles.sectionTitle, { color: ORD_GLASS.fg }]}
              >
                Order Items
              </AppText>

              {cart.map((item, idx) => (
                <Animated.View
                  key={`${item.itemId}-${idx}`}
                  entering={FadeInDown.delay(idx * 50)}
                  layout={Layout}
                  style={[
                    styles.cartItem,
                    { backgroundColor: ORD_GLASS.bgCard, borderColor: ORD_GLASS.border },
                  ]}
                >
                  <View style={styles.cartItemInfo}>
                    <AppText
                      variant="body"
                      weight="bold"
                      style={{ color: ORD_GLASS.fg }}
                      numberOfLines={1}
                    >
                      {item.itemName}
                    </AppText>
                    <AppText
                      variant="caption"
                      weight="medium"
                      style={{ color: ORD_GLASS.fgSecondary }}
                      numberOfLines={1}
                    >
                      <AppNumber value={Number(item.price)} prefix="ETB " size="caption" /> / {item.unit}
                    </AppText>
                  </View>

                  <View style={styles.cartItemActions}>
                    <TouchableOpacity
                      style={[
                        styles.qtyBtn,
                        { backgroundColor: ORD_GLASS.bgCard, borderColor: ORD_GLASS.border },
                      ]}
                      onPress={() => updateQty(idx, -1)}
                    >
                      <Minus size={14} color={ORD_GLASS.fg} />
                    </TouchableOpacity>
                    <AppNumber
                      value={item.quantity}
                      size="body"
                      weight="bold"
                      style={[styles.qtyValue, { color: ORD_GLASS.fg }]}
                    />
                    <TouchableOpacity
                      style={[
                        styles.qtyBtn,
                        { backgroundColor: ORD_GLASS.bgCard, borderColor: ORD_GLASS.border },
                      ]}
                      onPress={() => updateQty(idx, 1)}
                    >
                      <Plus size={14} color={ORD_GLASS.fg} />
                    </TouchableOpacity>
                    <AppNumber
                      value={item.price * item.quantity}
                      size="body"
                      weight="bold"
                      style={[styles.itemTotal, { color: ORD_GLASS.fg }]}
                    />
                    <TouchableOpacity
                      onPress={() => removeFromCart(idx)}
                      hitSlop={12}
                    >
                      <X size={16} color={ORD_GLASS.fgSecondary} />
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              ))}
            </Animated.View>
          )}

          {/* Customer Info */}
          <TutorialTarget id="co-customer">
          <Animated.View
            entering={FadeInDown.delay(200)}
            style={styles.formSection}
          >
            <AppText
              variant="body"
              weight="bold"
              style={[styles.sectionTitle, { color: ORD_GLASS.fg }]}
            >
              Customer Information
            </AppText>

            <View
              style={[
                styles.inputField,
                { backgroundColor: ORD_GLASS.bgCard, borderColor: ORD_GLASS.border },
              ]}
            >
              <User size={16} color={ORD_GLASS.fgSecondary} />
              <TextInput
                style={[styles.textInput, { color: ORD_GLASS.fg }]}
                placeholder={t('order.customer_name_ph')}
                placeholderTextColor={ORD_GLASS.fgSecondary + "60"}
                value={customerName}
                onChangeText={setCustomerName}
              />
            </View>

            <View
              style={[
                styles.inputField,
                { backgroundColor: ORD_GLASS.bgCard, borderColor: ORD_GLASS.border },
              ]}
            >
              <User size={16} color={ORD_GLASS.fgSecondary} />
              <TextInput
                style={[styles.textInput, { color: ORD_GLASS.fg }]}
                placeholder={t('order.customer_phone_ph')}
                placeholderTextColor={ORD_GLASS.fgSecondary + "60"}
                value={customerPhone}
                onChangeText={setCustomerPhone}
                keyboardType="phone-pad"
              />
            </View>
          </Animated.View>
          </TutorialTarget>

          {/* Notes */}
          <Animated.View entering={FadeInDown.delay(300)}>
            <View
              style={[
                styles.inputField,
                styles.notesField,
                { backgroundColor: ORD_GLASS.bgCard, borderColor: ORD_GLASS.border },
              ]}
            >
              <FileText size={16} color={ORD_GLASS.fgSecondary} />
              <TextInput
                style={[styles.textInput, { color: ORD_GLASS.fg }]}
                placeholder={t('order.notes_ph')}
                placeholderTextColor={ORD_GLASS.fgSecondary + "60"}
                value={notes}
                onChangeText={setNotes}
                multiline
              />
            </View>
          </Animated.View>
        </TutorialScrollView>

        {/* Bottom Bar */}
        <View
          style={[
            styles.bottomBar,
            { backgroundColor: ORD_GLASS.bg, borderTopColor: ORD_GLASS.border },
          ]}
        >
          <View style={styles.totalRow}>
            <AppText
              variant="body"
              weight="medium"
              style={{ color: ORD_GLASS.fgSecondary }}
            >
              Total
            </AppText>
            <AppNumber
              value={totalPrice}
              prefix="ETB "
              size="title"
              weight="extrabold"
              style={{ color: ORD_GLASS.fg }}
            />
          </View>
          <TutorialTarget id="co-commit-btn">
          <TouchableOpacity
            style={[
              styles.submitBtn,
              {
                backgroundColor:
                  cart.length > 0 ? ORD_GLASS.fg : ORD_GLASS.fgSecondary + "40",
              },
            ]}
            activeOpacity={0.8}
            onPress={handleCreate}
            disabled={cart.length === 0 || submitting}
          >
            <AppText
              variant="body"
              weight="bold"
              style={[styles.submitText, { color: ORD_GLASS.bg }]}
            >
              {submitting ? t('order.creating') : t('order.create_order')}
            </AppText>
          </TouchableOpacity>
          </TutorialTarget>
        </View>
      </KeyboardAvoidingView>
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
  cartBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  cartCount: {
    fontFamily: Fonts.bold,
  },
  scrollContent: {
    flex: 1,
  },
  scrollPadding: {
    padding: 16,
    paddingBottom: 60,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 44,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 15,
    height: "100%",
  },
  searchResults: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  cartSection: {
    marginTop: 16,
    gap: 8,
  },
  sectionTitle: {
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  cartItem: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 10,
    overflow: 'hidden',
  },
  cartItemInfo: {
    gap: 2,
  },
  cartItemActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyValue: {
    fontFamily: Fonts.bold,
    minWidth: 24,
    textAlign: "center",
  },
  itemTotal: {
    fontFamily: Fonts.bold,
    flex: 1,
    textAlign: "right",
  },
  formSection: {
    marginTop: 16,
    gap: 8,
  },
  inputField: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 44,
    gap: 10,
  },
  notesField: {
    height: 80,
    alignItems: "flex-start",
    paddingVertical: 14,
    marginTop: 16,
  },
  textInput: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 15,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 28 : 16,
    borderTopWidth: 1,
    gap: 10,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  submitBtn: {
    height: 54,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  submitText: {
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

export default CreateOrderScreen;