/**
 * Premium first-launch onboarding for Shega Mobile.
 *
 * Flow: Welcome → 1. Business info (name + logo) → 2. Business type
 *       → 3. Location (city only, country = Ethiopia) → 4. Owner account
 *       → 5. Date system → 6. Sales tax (VAT/TOT/No tax) →
 *       7. Multiple locations → 8. Team setup (nearby-device discovery +
 *       member identity/role/permissions) → Review → POS.
 *
 * Principles: minimal fields, everything optional is skippable, progress is
 * saved locally (SecureStore) so an interrupted setup resumes at the exact
 * stage, and the business/user/device is created exactly once (idempotent
 * guard) — never duplicated on resume.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  ArrowRight, Building2, CalendarDays, Camera, Check, ChevronRight,
  CreditCard, Fingerprint, ImagePlus, MapPin, Package,
  Receipt, Store, User, Users, Warehouse,
} from 'lucide-react-native';
import { wsSyncClient } from '@/services/wsSyncClient';
import MemberApprovalModal from '@/components/MemberApprovalModal';
import { RadarPulse } from '@/components/RadarPulse';
import { generateInvitation, revokeInvitation } from '@/services/invitationService';
import { mobilePairingBeacon, getThisDeviceName } from '@/services/mobilePairingBeacon';

import { AppText } from '@/components/ui';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import {
  addLocation, createBusiness, getBusinesses, getLocations,
  getOwnerOfBusiness, setBusinessLogo, setCurrentUserId, setUserPin,
  getThisDeviceId,
} from '@/services/businessService';
import { storePinHash } from '@/services/crypto';
import { isBiometricsAvailable, setBiometricsEnabled } from '@/services/biometrics';
import { saveSaleTaxConfig } from '@/services/taxService';
import { getDB, insertItem, setFeatureFlag } from '@/database/db';

type Stage =
  | 'welcome' | 'name' | 'type' | 'location' | 'owner' | 'calendar'
  | 'product' | 'tax' | 'warehouse' | 'payments' | 'team' | 'review' | 'done';

// Required flow order (per spec): business info → type → location → owner →
// date system → sales tax → multiple locations → team setup. Optional stages
// (product, payments) sit in the flow but can be skipped without breaking
// the numbered progress indicator.
const STAGE_ORDER: Stage[] = [
  'welcome', 'name', 'type', 'location', 'owner', 'calendar',
  'product', 'tax', 'warehouse', 'payments', 'team', 'review', 'done',
];

/** Numbered steps shown to the user (matches the shared 8-step spec). */
const STAGE_STEP_NUMBER: Partial<Record<Stage, number>> = {
  name: 1, type: 2, location: 3, owner: 4, calendar: 5,
  tax: 6, warehouse: 7, team: 8,
};

const WIZARD_STATE_KEY = 'setup_wizard_state';

const BUSINESS_TYPES = [
  { id: 'retail', label: 'Retail', emoji: '🛍️' },
  { id: 'grocery', label: 'Grocery', emoji: '🥬' },
  { id: 'pharmacy', label: 'Pharmacy', emoji: '💊' },
  { id: 'wholesale', label: 'Wholesale', emoji: '📦' },
  { id: 'distributor', label: 'Distributor', emoji: '🚚' },
  { id: 'electronics', label: 'Electronics', emoji: '🔌' },
  { id: 'clothing', label: 'Clothing', emoji: '👕' },
  { id: 'restaurant', label: 'Restaurant', emoji: '🍽️' },
  { id: 'other', label: 'Other', emoji: '🏪' },
];

const PAYMENT_OPTIONS = [
  { id: 'cash', label: 'Physical Cash', sub: 'Bills and coins' },
  { id: 'mobile', label: 'Mobile Money', sub: 'Telebirr, M-Pesa…' },
  { id: 'both', label: 'Both', sub: 'Cash + Mobile Money' },
];

const COUNTRIES = ['Ethiopia'] as const;

const markDone = (key: string) => { SecureStore.setItemAsync(key, 'true').catch(() => {}); };

export default function SetupWizardScreen() {
  const { colors, calendarType, setCalendarType } = useSettings();
  const { authenticate } = useAuth();
  const G = useMemo(() => ({
    bg: colors.background, fg: colors.text, muted: colors.textSecondary,
    card: colors.card, border: colors.border, accent: colors.primary,
  }), [colors]);

  const [stage, setStage] = useState<Stage>('welcome');
  const [businessName, setBusinessName] = useState('');
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [businessTypeCustom, setBusinessTypeCustom] = useState('');
  const [country, setCountry] = useState<string>('Ethiopia');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [useBiometrics, setUseBiometrics] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productQty, setProductQty] = useState('1');
  const [productUnit, setProductUnit] = useState('pcs');
  const [taxMode, setTaxMode] = useState<'VAT' | 'TOT' | 'None'>('VAT');
  const [taxRate, setTaxRate] = useState('15');
  const [warehouses, setWarehouses] = useState<boolean | null>(false);
  const [warehouseList, setWarehouseList] = useState<Array<{ name: string; city: string }>>([]);
  const [payments, setPayments] = useState<string>('both');
  const [receipts, setReceipts] = useState<boolean>(true);
  // Team-pairing step state (owner generates a QR + code for the new member).
  const [teamInvite, setTeamInvite] = useState<null | { id: string; code: string; qrUri: string; expiresAt: string }>(null);
  const [teamRole, setTeamRole] = useState<'cashier' | 'manager' | 'inventory'>('cashier');
  const [teamPublishing, setTeamPublishing] = useState(false);
  const [nearbyDevices, setNearbyDevices] = useState<Array<{ deviceId: string; deviceName: string; platform: string; role?: string; hasInvite: boolean; code?: string }>>([]);
  const [configuringDevice, setConfiguringDevice] = useState<{ deviceId: string; deviceName: string; platform: string; code: string } | null>(null);
  const [whName, setWhName] = useState('');
  const [whCity, setWhCity] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [productsAdded, setProductsAdded] = useState(0);
  const [bizId, setBizId] = useState<string | null>(null);
  const doneRef = useRef(false);

  /** Idempotent progress persistence — interrupted setup resumes where it left off. */
  const persistProgress = (nextStage: Stage, overrides?: Record<string, unknown>) => {
    if (doneRef.current) return;
    const snapshot = {
      stage: nextStage,
      businessName, logoUri, businessType, businessTypeCustom, country, city, address,
      ownerName, phone, email,
      useBiometrics,
      productName, productPrice, productQty, productUnit,
      taxMode, taxRate, warehouses, warehouseList, payments, receipts,
      productsAdded, bizId,
      ...overrides,
    };
    SecureStore.setItemAsync(WIZARD_STATE_KEY, JSON.stringify(snapshot)).catch(() => {});
  };

  const go = (next: Stage) => { setStage(next); persistProgress(next); };

  const inviteCreatingRef = useRef(false);
  /** Publish this business's open invitation as a discovery beacon. */
  const createTeamInvite = useCallback(() => {
    if (!bizId) return;
    inviteCreatingRef.current = true;
    try {
      const inv = generateInvitation({ businessId: bizId, role: teamRole, platform: 'mobile' });
      setTeamInvite(inv as any);
      try {
        mobilePairingBeacon.advertiseInvitation({ id: inv.id, code: inv.code, businessId: bizId, role: teamRole, expiresAt: inv.expiresAt });
      } catch (e: any) { console.warn('pairing beacon unavailable:', e?.message); }
      wsSyncClient.publishInvitation({ id: inv.id, businessId: bizId, code: inv.code, role: teamRole, platform: 'mobile', expiresAt: inv.expiresAt }).catch(() => {});
    } catch (e: any) {
      setError(e?.message || 'Could not start discovery.');
    } finally {
      inviteCreatingRef.current = false;
    }
  }, [bizId, teamRole]);

  // Team step: while it is open, automatically discover nearby Shega devices
  // (LAN mDNS + pairing beacons) AND advertise our own invite so the device
  // list stays live on both sides.
  useEffect(() => {
    if (stage !== 'team') return;
    try { mobilePairingBeacon.startBrowsing(); } catch { /* mDNS unavailable */ }
    const scan = () => {
      try {
        const fromBeacons = mobilePairingBeacon.getNearbyOwners().map(({ beacon, host }) => ({
          deviceId: beacon.owner?.deviceId || host || beacon.businessId,
          deviceName: beacon.owner?.deviceName || 'Nearby device',
          platform: beacon.owner?.platform || 'mobile',
          role: beacon.role,
          hasInvite: !!beacon.code,
          code: beacon.code || undefined,
        }));
        setNearbyDevices(fromBeacons as any);
        if (!teamInvite && !inviteCreatingRef.current && !fromBeacons.some((d) => d.hasInvite)) {
          // Publish our own open invitation so nearby joiners connect by
          // themselves; without a business yet, fall back to a discovery beacon.
          if (bizId) createTeamInvite();
          else mobilePairingBeacon.setDiscoverable(true, businessName || 'Shega', 'owner');
        }
      } catch { /* ignore */ }
    };
    scan();
    const timer = setInterval(scan, 5000);
    return () => {
      clearInterval(timer);
      try { mobilePairingBeacon.stopBrowsing(); mobilePairingBeacon.setDiscoverable(false); } catch { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, bizId, teamInvite?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const raw = await SecureStore.getItemAsync(WIZARD_STATE_KEY);
      const done = await SecureStore.getItemAsync('setup_wizard_done');
      if (cancelled) return;
      if (raw && done !== 'true') {
        try {
          const s = JSON.parse(raw);
          if (s.stage && STAGE_ORDER.includes(s.stage) && s.stage !== 'done') {
            setStage(s.stage);
            if (typeof s.businessName === 'string') setBusinessName(s.businessName);
            if (typeof s.logoUri === 'string' && s.logoUri) setLogoUri(s.logoUri);
            if (typeof s.businessType === 'string' && s.businessType) setBusinessType(s.businessType);
            if (typeof s.businessTypeCustom === 'string') setBusinessTypeCustom(s.businessTypeCustom);
            if (typeof s.country === 'string') setCountry(s.country);
            if (typeof s.city === 'string') setCity(s.city);
            if (typeof s.address === 'string') setAddress(s.address);
            if (typeof s.ownerName === 'string') setOwnerName(s.ownerName);
            if (typeof s.phone === 'string') setPhone(s.phone);
            if (typeof s.email === 'string') setEmail(s.email);
            if (typeof s.useBiometrics === 'boolean') setUseBiometrics(s.useBiometrics);
            if (typeof s.productName === 'string') setProductName(s.productName);
            if (typeof s.productPrice === 'string') setProductPrice(s.productPrice);
            if (typeof s.productQty === 'string') setProductQty(s.productQty);
            if (typeof s.productUnit === 'string') setProductUnit(s.productUnit);
            if (typeof s.taxMode === 'string') setTaxMode(s.taxMode as any);
            if (typeof s.taxRate === 'string') setTaxRate(s.taxRate);
            if (typeof s.warehouses === 'boolean') setWarehouses(s.warehouses);
            if (Array.isArray(s.warehouseList)) setWarehouseList(s.warehouseList);
            if (typeof s.payments === 'string') setPayments(s.payments);
            if (typeof s.receipts === 'boolean') setReceipts(s.receipts);
            if (typeof s.productsAdded === 'number') setProductsAdded(s.productsAdded);
            if (typeof s.bizId === 'string' && s.bizId) setBizId(s.bizId);
          }
        } catch { /* corrupted state — start fresh */ }
      }
    })();
    isBiometricsAvailable().then(setBiometricsAvailable).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const hasBusiness = getBusinesses().length > 0;

  /** Idempotent business creation — safe to resume after an interrupted setup. */
  const createNow = async () => {
    if (bizId) return bizId; // already created (resumed setup) — never duplicate
    if (hasBusiness) {
      const existing = getBusinesses()[0];
      setBizId(existing.id);
      return existing.id;
    }
    if (!businessName.trim() || !ownerName.trim()) {
      setError('Enter the business name and your name');
      return null;
    }
    setSaving(true); setError('');
    try {
      const biz = createBusiness(
        {
          name: businessName.trim(),
          ownerName: ownerName.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
        },
        getThisDeviceId() ?? `dev-${Date.now().toString(36)}`,
      );
      setBizId(biz.id);
      // Owner identity must be known before any owner-only writes (e.g. logo).
      const owner = getOwnerOfBusiness(biz.id);
      if (owner) setCurrentUserId(owner.id);
      markDone('setup_business_created');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return biz.id;
    } catch (e: any) {
      setError(e?.message || 'Could not create the business');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const pickLogo = async (mode: 'camera' | 'library') => {
    try {
      if (mode === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { setError('Camera permission is needed to take a photo.'); return; }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { setError('Photo access is needed to choose a logo.'); return; }
      }
      const options = {
        mediaTypes: ['images'] as const,
        allowsEditing: true,
        aspect: [1, 1] as [number, number],
        quality: 0.6,
      };
      const result = mode === 'camera'
        ? await ImagePicker.launchCameraAsync(options as any)
        : await ImagePicker.launchImageLibraryAsync(options as any);
      if (result.canceled || !result.assets?.length) return;
      setLogoUri(result.assets[0].uri);
      setError('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      setError('Could not access the photo.');
    }
  };

  const addFirstProduct = async () => {
    if (!bizId) { setError('Finish the owner account first.'); return; }
    if (!productName.trim() || !productPrice.trim()) {
      setError('Enter at least the product name and price');
      return;
    }
    try {
      const db = getDB();
      const cat = db.getFirstSync(
        "SELECT id FROM categories WHERE businessId = ? LIMIT 1", [bizId]
      ) as any;
      let catId = cat?.id;
      if (!catId) {
        const r = db.runSync(
          'INSERT INTO categories (name, businessId, uuid) VALUES (?, ?, ?)',
          ['General', bizId, `${bizId}-general`]
        );
        catId = Number(r.lastInsertRowId);
      }
      insertItem({
        name: productName.trim(),
        categoryId: Number(catId),
        companyName: '',
        purchaseUnit: productUnit,
        baseUnit: productUnit,
        unitsPerPack: 0,
        totalPackQuantity: 0,
        totalBaseQuantity: Number(productQty) || 1,
        packPurchasePrice: 0,
        basePurchasePrice: 0,
        baseSellingPrice: Number(productPrice) || 0,
        packSellingPrice: 0,
        allowSellByBaseUnit: true,
        allowSellByPackUnit: false,
      } as any);
      setProductsAdded((c) => c + 1);
      setProductName(''); setProductPrice(''); setProductQty('1');
      setError('');
      persistProgress(stage, { productsAdded: productsAdded + 1, productName: '', productPrice: '', productQty: '1' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError(e?.message || 'Could not add the product');
    }
  };

  const finish = async () => {
    if (doneRef.current) return;
    doneRef.current = true;
    const id = bizId;
    const locationText = [address.trim(), city.trim(), country.trim()].filter(Boolean).join(', ');

    // Business profile: logo + location address (rides the sync outbox).
    if (id) {
      if (logoUri) setBusinessLogo(id, logoUri);
      if (locationText) {
        try {
          const db = getDB();
          db.runSync(
            'UPDATE businesses SET address = ?, updated_at = ?, row_version = row_version + 1, is_synced = 0 WHERE id = ?',
            [locationText, new Date().toISOString(), id]
          );
          if (getLocations(id).length === 0) {
            addLocation(id, 'Main Location', locationText);
          }
          // Multiple locations configured during onboarding (step 7: Yes).
          for (const w of warehouseList) {
            try { addLocation(id, w.name, [w.city, 'Ethiopia'].filter(Boolean).join(', ')); } catch { /* best-effort */ }
          }
        } catch { /* best-effort */ }
      }
    }

    // Preferences that determine which features appear after onboarding.
    setFeatureFlag('warehouses', warehouses !== false);

    // Tax: apply the chosen per-sale VAT config (or leave tax disabled).
    // Tax: apply the chosen per-sale config (VAT/TOT/None) — used app-wide.
    saveSaleTaxConfig({ taxType: taxMode, taxRate: taxRate || '15' });

    // Biometrics unlock — only when the user opted in and hardware supports it.
    if (useBiometrics) setBiometricsEnabled(true).catch(() => {});

    markDone('setup_wizard_done');
    SecureStore.setItemAsync('shega_payments_mode', payments).catch(() => {});
    SecureStore.setItemAsync('shega_receipts_enabled', receipts ? 'true' : 'false').catch(() => {});
    if (businessType) SecureStore.setItemAsync('shega_business_type', businessType).catch(() => {});
    if (password.trim() && id) {
      const owner = getOwnerOfBusiness(id);
      if (owner) setUserPin(owner.id, password.trim());
      try { await storePinHash(password.trim()); } catch { /* device PIN is best-effort */ }
    }
    SecureStore.deleteItemAsync(WIZARD_STATE_KEY).catch(() => {});
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    authenticate();
    router.replace('/(tabs)/dashboard' as any);
  };

  const PrimaryButton = useCallback(({ label, onPress, icon, disabled }: { label: string; onPress: () => void; icon?: React.ReactNode; disabled?: boolean }) => (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={disabled}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      style={[styles.primaryBtn, { backgroundColor: G.fg, opacity: disabled ? 0.5 : 1 }]}
    >
      {icon}
      <AppText variant="body" weight="bold" style={{ color: G.bg }}>{label}</AppText>
    </TouchableOpacity>
  ), [G]);

  const GhostButton = useCallback(({ label, onPress }: { label: string; onPress: () => void }) => (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      style={[styles.ghostBtn, { backgroundColor: G.card, borderColor: G.border }]}
    >
      <AppText variant="body" weight="bold" style={{ color: G.muted }}>{label}</AppText>
    </TouchableOpacity>
  ), [G]);

  const StepBadge = useCallback(({ step, total }: { step: number; total: number }) => (
    <View style={styles.stepRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[styles.stepDot, { backgroundColor: i < step ? G.accent : G.border }]} />
      ))}
    </View>
  ), [G]);

  const Input = useCallback(({ placeholder, value, onChange, keyboard, secure, multiline }: { placeholder: string; value: string; onChange: (v: string) => void; keyboard?: any; secure?: boolean; multiline?: boolean }) => (
    <TextInput
      style={[styles.input, { borderColor: G.border, color: G.fg, backgroundColor: G.card }]}
      placeholder={placeholder}
      placeholderTextColor={G.muted}
      value={value}
      onChangeText={(v) => { onChange(v); setError(''); }}
      keyboardType={keyboard}
      autoCapitalize={keyboard === 'numeric-address' ? 'none' : 'words'}
      secureTextEntry={secure}
      multiline={multiline}
    />
  ), [G]);

  const ChoiceRow = ({ selected, onPress, icon, title, sub, rightLabel }: {
    selected?: boolean; onPress: () => void; icon?: React.ReactNode; title: string;
    sub?: string; rightLabel?: string;
  }) => (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      style={[styles.choiceRow, { backgroundColor: G.card, borderColor: selected ? G.accent : G.border }]}
    >
      {icon}
      <View style={{ flex: 1, marginLeft: icon ? 10 : 0 }}>
        <AppText variant="body" weight="bold" style={{ color: G.fg }}>{title}</AppText>
        {!!sub && <AppText variant="caption" style={{ color: G.muted }}>{sub}</AppText>}
      </View>
      {selected && <Check size={18} color={G.accent} />}
      {rightLabel && !selected && <AppText variant="caption" weight="bold" style={{ color: G.muted }}>{rightLabel}</AppText>}
    </TouchableOpacity>
  );

  const locationText = [address.trim(), city.trim(), 'Ethiopia'].filter(Boolean).join(', ') || '—';

  /** Back target for the tax step — skips the optional product stage when unused. */
  const calendarNavBack = () => (productsAdded > 0 ? 'product' : 'calendar') as Stage;
  const taxLabel = taxMode === 'None' ? 'No tax' : `${taxMode} ${taxRate || '15'}%`;
  const warehouseLabel = warehouses === true ? 'Yes' : warehouses === false ? 'No' : '—';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: G.bg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>

          {/* ── Welcome ── */}
          {stage === 'welcome' && (
            <Animated.View entering={FadeInDown.duration(350)} style={styles.stage}>
              <View style={[styles.iconCircle, { backgroundColor: G.card, borderColor: G.border }]}>
                <Store size={28} color={G.accent} />
              </View>
              <AppText variant="display" weight="bold" align="center" style={{ color: G.fg }}>
                Welcome to Shega
              </AppText>
              <AppText variant="body" weight="medium" align="center" style={{ color: G.muted, marginTop: 10 }}>
                Your simple, powerful business management system. Let's get you selling in a few minutes.
              </AppText>
              <View style={{ marginTop: 32 }}>
                <PrimaryButton label="Create a New Business" onPress={() => go('name')} icon={<ArrowRight size={17} color={G.bg} />} />
                <View style={{ marginTop: 12 }}>
                  <GhostButton label="Join an Existing Business" onPress={() => router.replace('/join-existing' as any)} />
                </View>
                <View style={{ marginTop: 12 }}>
                  <GhostButton label="Already have an account? Sign in" onPress={() => router.replace('/user-signin' as any)} />
                </View>
              </View>
            </Animated.View>
          )}

          {/* ── Business name + logo ── */}
          {stage === 'name' && (
            <Animated.View entering={FadeInDown.duration(350)} style={styles.stage}>
              <View style={[styles.iconCircle, { backgroundColor: G.card, borderColor: G.border }]}>
                <Building2 size={26} color={G.accent} />
              </View>
              <AppText variant="display" weight="bold" align="center" style={{ color: G.fg }}>
                Your business name
              </AppText>
              <AppText variant="body" weight="medium" align="center" style={{ color: G.muted, marginTop: 10 }}>
                You can change it later in Settings.
              </AppText>
              <View style={{ marginTop: 20 }}>
                <Input placeholder="e.g. Natoli Electronics" value={businessName} onChange={setBusinessName} />
              </View>

              <View style={{ alignItems: 'center', marginTop: 18 }}>
                <View style={[styles.logoPreview, { backgroundColor: G.card, borderColor: G.border }]}>
                  {logoUri ? (
                    <Image source={{ uri: logoUri }} style={styles.logoImage} />
                  ) : (
                    <AppText style={{ fontSize: 30 }}>🪪</AppText>
                  )}
                </View>
                <AppText variant="caption" weight="medium" style={{ color: G.muted, marginTop: 8 }}>
                  Optional business logo
                </AppText>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  <TouchableOpacity
                    onPress={() => { Haptics.selectionAsync(); pickLogo('camera'); }}
                    style={[styles.logoBtn, { backgroundColor: G.card, borderColor: G.border }]}
                  >
                    <Camera size={15} color={G.fg} />
                    <AppText variant="caption" weight="bold" style={{ color: G.fg, marginLeft: 5 }}>Take photo</AppText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { Haptics.selectionAsync(); pickLogo('library'); }}
                    style={[styles.logoBtn, { backgroundColor: G.card, borderColor: G.border }]}
                  >
                    <ImagePlus size={15} color={G.fg} />
                    <AppText variant="caption" weight="bold" style={{ color: G.fg, marginLeft: 5 }}>Choose image</AppText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { Haptics.selectionAsync(); setLogoUri(null); }}
                    style={[styles.logoBtn, { backgroundColor: G.card, borderColor: G.border }]}
                  >
                    <AppText variant="caption" weight="bold" style={{ color: G.muted }}>Skip</AppText>
                  </TouchableOpacity>
                </View>
                {!!error && <AppText variant="caption" weight="bold" style={{ color: '#e74c3c', marginTop: 8 }}>{error}</AppText>}
              </View>

              <View style={{ marginTop: 22 }}>
                <PrimaryButton label="Continue" onPress={() => businessName.trim() && go('type')} icon={<ChevronRight size={17} color={G.bg} />} disabled={!businessName.trim()} />
                <View style={{ marginTop: 12 }}>
                  <GhostButton label="Back" onPress={() => go('welcome')} />
                </View>
              </View>
              <StepBadge step={1} total={8} />
            </Animated.View>
          )}

          {/* ── Business type ── */}
          {stage === 'type' && (
            <Animated.View entering={FadeInDown.duration(350)} style={styles.stage}>
              <AppText variant="display" weight="bold" align="center" style={{ color: G.fg }}>
                What type of business do you run?
              </AppText>
              <AppText variant="body" weight="medium" align="center" style={{ color: G.muted, marginTop: 10 }}>
                This helps us tailor the experience. Optional.
              </AppText>
              <View style={styles.typeGrid}>
                {BUSINESS_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    activeOpacity={0.8}
                    onPress={() => { Haptics.selectionAsync(); setBusinessType(t.id); }}
                    style={[styles.typeCard, { backgroundColor: businessType === t.id ? G.accent + '18' : G.card, borderColor: businessType === t.id ? G.accent : G.border }]}
                  >
                    <AppText style={{ fontSize: 22 }}>{t.emoji}</AppText>
                    <AppText variant="caption" weight="bold" style={{ color: G.fg, marginTop: 4 }}>{t.label}</AppText>
                  </TouchableOpacity>
                ))}
              </View>
              {businessType === 'other' && (
                <View style={{ marginTop: 12 }}>
                  <Input placeholder="Describe your business type (e.g. Auto Garage)" value={businessTypeCustom} onChange={setBusinessTypeCustom} />
                </View>
              )}
              <View style={{ marginTop: 24 }}>
                <PrimaryButton label="Continue" onPress={() => go('location')} icon={<ChevronRight size={17} color={G.bg} />} />
                <View style={{ marginTop: 12 }}>
                  <GhostButton label="Back" onPress={() => go('name')} />
                </View>
              </View>
              <StepBadge step={2} total={8} />
            </Animated.View>
          )}

          {/* ── Location ── */}
          {stage === 'location' && (
            <Animated.View entering={FadeInDown.duration(350)} style={styles.stage}>
              <View style={[styles.iconCircle, { backgroundColor: G.card, borderColor: G.border }]}>
                <MapPin size={26} color={G.accent} />
              </View>
              <AppText variant="display" weight="bold" align="center" style={{ color: G.fg }}>
                Where is your business located?
              </AppText>
              <AppText variant="body" weight="medium" align="center" style={{ color: G.muted, marginTop: 10 }}>
                Shega is for businesses in Ethiopia — country is set automatically. Just tell us the city.
              </AppText>
              <View style={{ marginTop: 18 }}>
                <View style={[styles.chip, { alignSelf: 'center', backgroundColor: G.card, borderColor: G.border }]}>
                  <AppText variant="caption" weight="bold" style={{ color: G.fg }}>🇪🇹 Ethiopia</AppText>
                </View>
                <View style={{ marginTop: 12 }}>
                  <Input placeholder="City (e.g. Addis Ababa)" value={city} onChange={setCity} />
                </View>
                <View style={{ marginTop: 10 }}>
                  <Input placeholder="Street address (optional)" value={address} onChange={setAddress} />
                </View>
              </View>
              <View style={{ marginTop: 24 }}>
                <PrimaryButton label="Continue" onPress={() => go('owner')} icon={<ChevronRight size={17} color={G.bg} />} />
                <View style={{ marginTop: 12 }}>
                  <GhostButton label="Back" onPress={() => go('type')} />
                </View>
              </View>
              <StepBadge step={3} total={8} />
            </Animated.View>
          )}

          {/* ── Owner account ── */}
          {stage === 'owner' && (
            <Animated.View entering={FadeInDown.duration(350)} style={styles.stage}>
              <View style={[styles.iconCircle, { backgroundColor: G.card, borderColor: G.border }]}>
                <User size={26} color={G.accent} />
              </View>
              <AppText variant="display" weight="bold" align="center" style={{ color: G.fg }}>
                Owner account
              </AppText>
              <AppText variant="body" weight="medium" align="center" style={{ color: G.muted, marginTop: 10 }}>
                You'll be the Owner with full access.
              </AppText>
              <View style={{ marginTop: 20 }}>
                <Input placeholder="Your name (e.g. Abebe Kebede)" value={ownerName} onChange={setOwnerName} />
                <View style={{ marginTop: 10 }}>
                  <Input placeholder="Email" value={email} onChange={setEmail} keyboard="email-address" />
                </View>
                <View style={{ marginTop: 10 }}>
                  <Input placeholder="Password (min 4 characters)" value={password} onChange={setPassword} secure />
                </View>
                <View style={{ marginTop: 10 }}>
                  <Input placeholder="Phone number (optional)" value={phone} onChange={setPhone} keyboard="phone-pad" />
                </View>
                {biometricsAvailable && (
                  <View style={{ marginTop: 12 }}>
                    <ChoiceRow
                      selected={useBiometrics}
                      onPress={() => setUseBiometrics((v) => !v)}
                      icon={<Fingerprint size={18} color={G.fg} />}
                      title="Enable biometrics to unlock"
                      sub="Fingerprint or Face ID instead of typing your PIN"
                    />
                  </View>
                )}
              </View>
              {!!error && <AppText variant="caption" weight="bold" style={{ color: '#e74c3c', marginTop: 10 }}>{error}</AppText>}
              <View style={{ marginTop: 24 }}>
                <PrimaryButton
                  label="Create Business"
                  onPress={() => {
                    if (!ownerName.trim() || !password.trim()) { setError('Enter your name and a password'); return; }
                    createNow().then((id) => id && go('calendar'));
                  }}
                  icon={<Check size={17} color={G.bg} />}
                  disabled={saving}
                />
                <View style={{ marginTop: 12 }}>
                  <GhostButton label="Back" onPress={() => go('location')} />
                </View>
              </View>
              <StepBadge step={4} total={8} />
            </Animated.View>
          )}

          {/* ── Calendar ── */}
          {stage === 'calendar' && (
            <Animated.View entering={FadeInDown.duration(350)} style={styles.stage}>
              <View style={[styles.iconCircle, { backgroundColor: G.card, borderColor: G.border }]}>
                <CalendarDays size={26} color={G.accent} />
              </View>
              <AppText variant="display" weight="bold" align="center" style={{ color: G.fg }}>
                Date system
              </AppText>
              <AppText variant="body" weight="medium" align="center" style={{ color: G.muted, marginTop: 10 }}>
                Choose your calendar. Currency is set to ETB — you can change it later in Settings.
              </AppText>
              <View style={{ marginTop: 24 }}>
                {(['ethiopian', 'gregorian'] as const).map((c) => (
                  <TouchableOpacity
                    key={c}
                    activeOpacity={0.85}
                    onPress={() => { Haptics.selectionAsync(); setCalendarType(c); }}
                    style={[styles.choiceRow, { backgroundColor: G.card, borderColor: calendarType === c ? G.accent : G.border }]}
                  >
                    <AppText variant="body" weight="bold" style={{ color: G.fg, flex: 1 }}>
                      {c === 'ethiopian' ? 'Ethiopian Calendar' : 'Gregorian Calendar'}
                    </AppText>
                    {calendarType === c && <Check size={18} color={G.accent} />}
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ marginTop: 24 }}>
                <PrimaryButton label="Continue" onPress={() => go('tax')} icon={<ChevronRight size={17} color={G.bg} />} />
                <View style={{ marginTop: 12 }}>
                  <GhostButton label="Back" onPress={() => go('owner')} />
                </View>
              </View>
              <StepBadge step={5} total={8} />
            </Animated.View>
          )}

          {/* ── First product (optional) ── */}
          {stage === 'product' && (
            <Animated.View entering={FadeInDown.duration(350)} style={styles.stage}>
              <View style={[styles.iconCircle, { backgroundColor: G.card, borderColor: G.border }]}>
                <Package size={26} color={G.accent} />
              </View>
              <AppText variant="display" weight="bold" align="center" style={{ color: G.fg }}>
                {productsAdded > 0 ? 'Add another product' : 'Add your first product?'}
              </AppText>
              <AppText variant="body" weight="medium" align="center" style={{ color: G.muted, marginTop: 10 }}>
                {productsAdded > 0
                  ? `${productsAdded} product${productsAdded > 1 ? 's' : ''} added so far.`
                  : 'Just the basics — name, price and stock. You can add everything else later.'}
              </AppText>
              <View style={{ marginTop: 20 }}>
                <Input placeholder="Product name (e.g. Coca-Cola 500ml)" value={productName} onChange={setProductName} />
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Input placeholder="Price (ETB)" value={productPrice} onChange={setProductPrice} keyboard="decimal-pad" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input placeholder="Stock qty" value={productQty} onChange={setProductQty} keyboard="number-pad" />
                  </View>
                  <View style={{ width: 90 }}>
                    <Input placeholder="Unit" value={productUnit} onChange={setProductUnit} />
                  </View>
                </View>
              </View>
              {!!error && <AppText variant="caption" weight="bold" style={{ color: '#e74c3c', marginTop: 10 }}>{error}</AppText>}
              <View style={{ marginTop: 24 }}>
                <PrimaryButton label="Add Product" onPress={addFirstProduct} icon={<Check size={17} color={G.bg} />} />
                <View style={{ marginTop: 12 }}>
                  <GhostButton label={productsAdded > 0 ? 'Done adding products' : "I'll Do It Later"} onPress={() => go('tax')} />
                </View>
              </View>
              <StepBadge step={5} total={8} />
            </Animated.View>
          )}

          {/* ── Tax (optional) ── */}
          {stage === 'tax' && (
            <Animated.View entering={FadeInDown.duration(350)} style={styles.stage}>
              <View style={[styles.iconCircle, { backgroundColor: G.card, borderColor: G.border }]}>
                <Receipt size={26} color={G.accent} />
              </View>
              <AppText variant="display" weight="bold" align="center" style={{ color: G.fg }}>
                Do you charge tax on sales?
              </AppText>
              <AppText variant="body" weight="medium" align="center" style={{ color: G.muted, marginTop: 10 }}>
                Optional. You can fully configure withholding and income tax later in Settings → Tax.
              </AppText>
              <View style={{ marginTop: 20 }}>
                {([
                  { id: 'VAT', label: 'VAT', sub: 'Value Added Tax — added to every sale (default 15%)' },
                  { id: 'TOT', label: 'TOT', sub: 'Turnover Tax — a flat 2% on monthly turnover' },
                  { id: 'None', label: 'No Tax', sub: "Don't charge tax on sales" },
                ] as const).map((o) => (
                  <ChoiceRow
                    key={o.id}
                    selected={taxMode === o.id}
                    onPress={() => { setTaxMode(o.id); if (o.id === 'TOT') setTaxRate('2'); if (o.id === 'VAT' && taxRate === '2') setTaxRate('15'); }}
                    icon={<Receipt size={18} color={G.fg} />}
                    title={o.label}
                    sub={o.sub}
                  />
                ))}
                {taxMode !== 'None' && (
                  <View style={{ marginTop: 10 }}>
                    <Input placeholder={`${taxMode} rate (%)`} value={taxRate} onChange={setTaxRate} keyboard="decimal-pad" />
                  </View>
                )}
              </View>
              <View style={{ marginTop: 24 }}>
                <PrimaryButton label="Continue" onPress={() => go('warehouse')} icon={<ChevronRight size={17} color={G.bg} />} />
                <View style={{ marginTop: 12 }}>
                  <GhostButton label="Back" onPress={() => go(calendarNavBack())} />
                </View>
              </View>
              <StepBadge step={6} total={8} />
            </Animated.View>
          )}

          {/* ── Warehouses ── */}
          {stage === 'warehouse' && (
            <Animated.View entering={FadeInDown.duration(350)} style={styles.stage}>
              <View style={[styles.iconCircle, { backgroundColor: G.card, borderColor: G.border }]}>
                <Warehouse size={26} color={G.accent} />
              </View>
              <AppText variant="display" weight="bold" align="center" style={{ color: G.fg }}>
                Do you manage stock from more than one location?
              </AppText>
              <AppText variant="body" weight="medium" align="center" style={{ color: G.muted, marginTop: 10 }}>
                A single shop keeps things simple. You can enable this later in Settings.
              </AppText>
              <View style={{ marginTop: 20 }}>
                <ChoiceRow
                  selected={warehouses === true}
                  onPress={() => setWarehouses(true)}
                  icon={<Warehouse size={18} color={G.fg} />}
                  title="Yes, multiple locations"
                  sub="Add your warehouses/branches below"
                />
                <ChoiceRow
                  selected={warehouses === false}
                  onPress={() => setWarehouses(false)}
                  icon={<Check size={18} color={G.fg} />}
                  title="No, just one shop"
                  sub="Inventory and sales stay simple"
                />
                {warehouses === true && (
                  <View style={{ marginTop: 12 }}>
                    {warehouseList.map((w, i) => (
                      <View key={i} style={[styles.choiceRow, { backgroundColor: G.card, borderColor: G.border, paddingVertical: 10 }]}>
                        <Warehouse size={15} color={G.muted} />
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <AppText variant="caption" weight="bold" style={{ color: G.fg }}>{w.name}</AppText>
                          {!!w.city && <AppText variant="micro" style={{ color: G.muted }}>{w.city}</AppText>}
                        </View>
                        <TouchableOpacity onPress={() => setWarehouseList((l) => l.filter((_, j) => j !== i))} hitSlop={8}>
                          <AppText variant="caption" weight="bold" style={{ color: '#e74c3c' }}>Remove</AppText>
                        </TouchableOpacity>
                      </View>
                    ))}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Input placeholder="Location name (e.g. Bole Branch)" value={whName} onChange={setWhName} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Input placeholder="City (optional)" value={whCity} onChange={setWhCity} />
                      </View>
                    </View>
                    <View style={{ marginTop: 10 }}>
                      <GhostButton
                        label={whName.trim() ? '+ Add this location' : 'Enter a location name above'}
                        onPress={() => {
                          if (!whName.trim()) return;
                          setWarehouseList((l) => [...l, { name: whName.trim(), city: whCity.trim() }]);
                          setWhName(''); setWhCity('');
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        }}
                      />
                    </View>
                  </View>
                )}
              </View>
              <View style={{ marginTop: 24 }}>
                <PrimaryButton label="Continue" onPress={() => go('team')} icon={<ChevronRight size={17} color={G.bg} />} />
                <View style={{ marginTop: 12 }}>
                  <GhostButton label="Back" onPress={() => go('tax')} />
                </View>
              </View>
              <StepBadge step={7} total={8} />
            </Animated.View>
          )}

          {/* ── Payments & receipts ── */}
          {stage === 'payments' && (
            <Animated.View entering={FadeInDown.duration(350)} style={styles.stage}>
              <View style={[styles.iconCircle, { backgroundColor: G.card, borderColor: G.border }]}>
                <CreditCard size={26} color={G.accent} />
              </View>
              <AppText variant="display" weight="bold" align="center" style={{ color: G.fg }}>
                How will you take payments?
              </AppText>
              <AppText variant="body" weight="medium" align="center" style={{ color: G.muted, marginTop: 10 }}>
                You can add more payment methods later.
              </AppText>
              <View style={{ marginTop: 20 }}>
                {PAYMENT_OPTIONS.map((p) => (
                  <ChoiceRow
                    key={p.id}
                    selected={payments === p.id}
                    onPress={() => setPayments(p.id)}
                    title={p.label}
                    sub={p.sub}
                  />
                ))}
                <ChoiceRow
                  selected={receipts}
                  onPress={() => setReceipts(!receipts)}
                  icon={<Receipt size={18} color={G.fg} />}
                  title="Print receipts"
                  sub="Configure printers in Settings → POS Hardware"
                  rightLabel={receipts ? 'Yes' : 'No'}
                />
                <View style={[styles.noteBox, { backgroundColor: G.card, borderColor: G.border }]}>
                  <AppText variant="caption" weight="medium" style={{ color: G.muted }}>
                    Customers and debts are optional — you can add your first customer later from the Customers tab.
                  </AppText>
                </View>
              </View>
              <View style={{ marginTop: 24 }}>
                <PrimaryButton label="Continue" onPress={() => go('team')} icon={<ChevronRight size={17} color={G.bg} />} />
                <View style={{ marginTop: 12 }}>
                  <GhostButton label="Back" onPress={() => go('warehouse')} />
                </View>
              </View>
              <StepBadge step={8} total={8} />
            </Animated.View>
          )}

          {/* ── Set up your team: nearby-device discovery + member config ── */}
          {stage === 'team' && (
            <Animated.View entering={FadeInDown.duration(350)} style={styles.stage}>
              <View style={[styles.iconCircle, { backgroundColor: G.card, borderColor: G.border }]}>
                <Users size={26} color={G.accent} />
              </View>
              <AppText variant="display" weight="bold" align="center" style={{ color: G.fg }}>
                Set up your team
              </AppText>
              <AppText variant="body" weight="medium" align="center" style={{ color: G.muted, marginTop: 10 }}>
                Nearby devices running Shega appear here automatically over LAN/P2P. Tap one to invite it to your business.
              </AppText>

              {/* Discovery radar — this is the join surface, there is no QR/code */}
              <View style={{ marginTop: 18 }}>
                <RadarPulse
                  glass={G}
                  compact
                  deviceName={getThisDeviceName()}
                  tone={nearbyDevices.length > 0 ? 'found' : 'searching'}
                  status={nearbyDevices.length > 0
                    ? `${nearbyDevices.length} device${nearbyDevices.length === 1 ? '' : 's'} found`
                    : 'Searching for nearby devices…'}
                  peers={nearbyDevices.map((d) => ({
                    id: d.deviceId,
                    name: d.deviceName,
                    platform: d.platform,
                    detail: `${d.role === 'owner' ? 'Owner' : 'Team'} · ${d.hasInvite ? 'tap to invite' : 'no open invite yet'}`,
                    disabled: !(d.hasInvite && d.code),
                  }))}
                  onPickPeer={(p) => {
                    const d = nearbyDevices.find((x) => x.deviceId === p.id);
                    if (d?.hasInvite && d.code) {
                      setConfiguringDevice({ deviceId: d.deviceId, deviceName: d.deviceName, platform: d.platform, code: d.code });
                    }
                  }}
                  emptyHint="Keep both devices on the same Wi-Fi with Shega open."
                />
              </View>

              {/* Nearby devices — auto-discovered, always scanning while this step is open */}
              <View style={{ marginTop: 20 }}>
                {nearbyDevices.length === 0 && (
                  <View style={[styles.noteBox, { backgroundColor: G.card, borderColor: G.border }]}>
                    <AppText variant="caption" weight="medium" style={{ color: G.muted }}>
                      {teamPublishing
                        ? 'Searching for nearby Shega devices…'
                        : 'No nearby devices yet. Make sure the other device has Shega open, then scan again.'}
                    </AppText>
                  </View>
                )}
              </View>

              {/* No QR and no pairing code — joining happens through the radar. */}
              <View style={{ marginTop: 18, alignItems: 'center' }}>
                <GhostButton
                  label="Scan again"
                  onPress={() => {
                    try { mobilePairingBeacon.startBrowsing(); } catch { /* mDNS unavailable */ }
                    if (!teamInvite) createTeamInvite();
                  }}
                />
              </View>

              <View style={{ marginTop: 22 }}>
                <PrimaryButton label="Continue" onPress={() => { try { if (teamInvite) revokeInvitation(teamInvite.id); } catch { /* noop */ } mobilePairingBeacon.stopPublishing(); go('review'); }} icon={<ChevronRight size={17} color={G.bg} />} />
                <View style={{ marginTop: 12 }}>
                  <GhostButton label="Back" onPress={() => go('warehouse')} />
                </View>
              </View>
              <StepBadge step={8} total={8} />
            </Animated.View>
          )}

          {/* ── Review ── */}
          {stage === 'review' && (
            <Animated.View entering={FadeInDown.duration(350)} style={styles.stage}>
              <AppText variant="display" weight="bold" align="center" style={{ color: G.fg }}>
                Your Shega setup
              </AppText>
              <AppText variant="body" weight="medium" align="center" style={{ color: G.muted, marginTop: 6 }}>
                Tap any row to change it.
              </AppText>
              <View style={[styles.reviewCard, { backgroundColor: G.card, borderColor: G.border }]}>
                {([
                  ['Business', businessName || '—', 'name'],
                  ['Logo', logoUri ? 'Added' : 'None', 'name'],
                  ['Business type', BUSINESS_TYPES.find((t) => t.id === businessType)?.label || '—', 'type'],
                  ['Location', locationText, 'location'],
                  ['Owner', ownerName || '—', 'owner'],
                  ['Email', email || '—', 'owner'],
                  ['Currency', 'ETB', 'calendar'],
                  ['Date system', calendarType === 'ethiopian' ? 'Ethiopian Calendar' : 'Gregorian Calendar', 'calendar'],
                  ['Products', `${productsAdded} added`, 'product'],
                  ['Tax', taxLabel, 'tax'],
                  ['Warehouses', warehouseLabel, 'warehouse'],
                  ['Payments', PAYMENT_OPTIONS.find((p) => p.id === payments)?.label ?? '—', 'payments'],
                  ['Receipts', receipts ? 'Yes' : 'No', 'payments'],
                  ['Customers', 'Add later', 'payments'],
                ] as [string, string, Stage][]).map(([k, v, target]) => (
                  <TouchableOpacity
                    key={k}
                    activeOpacity={0.7}
                    onPress={() => { Haptics.selectionAsync(); go(target); }}
                    style={styles.reviewRow}
                  >
                    <AppText variant="caption" style={{ color: G.muted }}>{k}</AppText>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
                      <AppText variant="body" weight="bold" style={{ color: G.fg, marginRight: 4 }} numberOfLines={1}>{v}</AppText>
                      <ChevronRight size={14} color={G.muted} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
              <AppText variant="caption" align="center" style={{ color: G.muted, marginTop: 10 }}>
                Everything can be changed later in Settings.
              </AppText>
              <View style={{ marginTop: 20 }}>
                <PrimaryButton label="Start Using Shega" onPress={finish} icon={<Store size={17} color={G.bg} />} />
              </View>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Owner configures the joining member: name, photo, role, permissions */}
      {configuringDevice && bizId && (
        <MemberApprovalModal
          request={{
            joinerUser: configuringDevice.deviceName,
            joinerName: configuringDevice.deviceName,
            platform: configuringDevice.platform,
          }}
          glass={{ bgCard: G.card, border: G.border, fg: G.fg, muted: G.muted, bg: G.bg }}
          onClose={() => setConfiguringDevice(null)}
          onConfirm={async (cfg) => {
            const target = configuringDevice;
            setConfiguringDevice(null);
            try {
              // Generate an invite scoped to this member, advertise it, and
              // stage the assigned identity so their device receives it on join.
              const inv = generateInvitation({ businessId: bizId, role: cfg.role, platform: target.platform === 'desktop' ? 'desktop' : 'mobile' });
              try {
                mobilePairingBeacon.advertiseInvitation({ id: inv.id, code: inv.code, businessId: bizId, role: cfg.role, expiresAt: inv.expiresAt });
              } catch { /* best-effort */ }
              wsSyncClient.publishInvitation({ id: inv.id, businessId: bizId, code: inv.code, role: cfg.role, platform: target.platform, expiresAt: inv.expiresAt }).catch(() => {});
              // Persist the assigned identity on a device_requests row so the
              // joiner's STATUS poll (and the roster mirror) adopt it.
              try {
                const db = getDB();
                db.runSync(
                  `INSERT OR REPLACE INTO device_requests
                     (id, business_id, code, joiner_device_id, joiner_name, joiner_model, joiner_user, role, platform, status, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
                  [`cfg-${inv.id}`, bizId, inv.code, target.deviceId, target.deviceName,
                   target.platform, cfg.name, cfg.role, target.platform, new Date().toISOString()],
                );
                try {
                  db.runSync('UPDATE device_requests SET assigned_name = ?, assigned_avatar = ?, assigned_permissions = ? WHERE id = ?',
                    [cfg.name, cfg.avatar, cfg.permissions ? JSON.stringify(cfg.permissions) : null, `cfg-${inv.id}`]);
                } catch {
                  db.runSync('ALTER TABLE device_requests ADD COLUMN assigned_name TEXT');
                  db.runSync('ALTER TABLE device_requests ADD COLUMN assigned_avatar TEXT');
                  db.runSync('ALTER TABLE device_requests ADD COLUMN assigned_permissions TEXT');
                  db.runSync('UPDATE device_requests SET assigned_name = ?, assigned_avatar = ?, assigned_permissions = ? WHERE id = ?',
                    [cfg.name, cfg.avatar, cfg.permissions ? JSON.stringify(cfg.permissions) : null, `cfg-${inv.id}`]);
                }
              } catch { /* best-effort */ }
              setTeamInvite(inv);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (e: any) {
              setError(e?.message || 'Could not send the invitation');
            }
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 28, paddingBottom: 48 },
  stage: { alignItems: 'stretch' },
  iconCircle: {
    width: 60, height: 60, borderRadius: 18, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 18,
  },
  input: {
    borderWidth: 1, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 15,
    fontFamily: 'Inter_600SemiBold', fontSize: 15,
  },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 15, borderRadius: 999, gap: 8,
  },
  ghostBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 999, borderWidth: 1,
  },
  stepRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 26 },
  stepDot: { width: 22, height: 4, borderRadius: 2 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20, justifyContent: 'center' },
  typeCard: {
    width: '30%', borderRadius: 16, borderWidth: 1, alignItems: 'center',
    paddingVertical: 12, minWidth: 96,
  },
  choiceRow: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1,
    paddingVertical: 14, paddingHorizontal: 16, marginBottom: 10,
  },
  chip: {
    borderRadius: 999, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 16,
  },
  logoPreview: {
    width: 84, height: 84, borderRadius: 42, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  logoImage: { width: 84, height: 84, borderRadius: 42 },
  logoBtn: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 999,
    paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1,
  },
  noteBox: {
    borderRadius: 14, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 14, marginTop: 4,
  },
  nearbyIcon: {
    width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  reviewCard: { borderRadius: 20, borderWidth: 1, marginTop: 20, overflow: 'hidden' },
  reviewRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 11, paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.2)',
  },
});