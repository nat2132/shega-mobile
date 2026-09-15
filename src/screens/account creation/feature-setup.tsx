import React, { useMemo, useState } from 'react';
import { StyleSheet, View, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { getAccountGlass } from './glass-account';
import { useSettings } from '@/context/SettingsContext';
import { AppText } from '@/components/ui';
import { Warehouse, Truck, Users, ChevronRight } from 'lucide-react-native';
import { getFeatureFlag as dbGetFeatureFlag } from '@/database/db';

const { width } = Dimensions.get('window');

interface Props {
  onComplete: () => void;
}

const FeatureSetupScreen: React.FC<Props> = ({ onComplete }) => {
  const { colors, featureFlags, setFeatureFlag } = useSettings();
  const G = getAccountGlass(colors);
  const [warehouses, setWarehouses] = useState(featureFlags.warehousesEnabled);
  const [shipments, setShipments] = useState(featureFlags.shipmentsEnabled);
  const [customers, setCustomers] = useState(() => dbGetFeatureFlag('customers_enabled', false));

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: G.bg },
    scrollContent: { paddingHorizontal: 25, paddingTop: 60, paddingBottom: 40 },
    header: { marginBottom: 40, alignItems: 'center' },
    title: { fontFamily: 'Inter-ExtraBold' as any, fontWeight: '800', color: G.fg, textAlign: 'center', marginBottom: 12, fontSize: 26 },
    subtitle: { color: G.fgSecondary, textAlign: 'center', lineHeight: 22, fontFamily: 'Inter-Medium' as any, paddingHorizontal: 15 },
    card: {
      backgroundColor: G.bgCard,
      borderWidth: 1,
      borderColor: G.border,
      borderRadius: 24,
      padding: 20,
      marginBottom: 16,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
    iconCircle: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: G.bg,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cardTitle: { fontFamily: 'Inter-Bold' as any, color: G.fg, fontSize: 15 },
    cardDesc: { fontFamily: 'Inter-Medium' as any, color: G.fgSecondary, fontSize: 13, marginBottom: 16, lineHeight: 20 },
    toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    toggleLabel: { fontFamily: 'Inter-SemiBold' as any, color: G.fg, fontSize: 13 },
    toggleTrack: {
      width: 52,
      height: 30,
      borderRadius: 15,
      justifyContent: 'center',
      paddingHorizontal: 2,
    },
    toggleThumb: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: '#fff',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
    },
    actionBtn: {
      flexDirection: 'row',
      width: '100%',
      height: 68,
      backgroundColor: G.fg,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
      marginTop: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 10,
      elevation: 8,
    },
    btnText: { fontFamily: 'Inter-Bold' as any, color: G.bg, fontSize: 15, letterSpacing: 1 },
  }), [G]);

  const handleContinue = () => {
    setFeatureFlag('warehouses', warehouses);
    setFeatureFlag('shipments', shipments);
    setFeatureFlag('customers', customers);
    onComplete();
  };

  const Toggle: React.FC<{ value: boolean; onValueChange: (v: boolean) => void }> = ({ value, onValueChange }) => (
    <TouchableOpacity
      onPress={() => onValueChange(!value)}
      activeOpacity={0.7}
      style={[styles.toggleTrack, { backgroundColor: value ? G.fg : G.border }]}
    >
      <View style={[styles.toggleThumb, { marginLeft: value ? 24 : 0 }]} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn.duration(600)} exiting={FadeOut}>
          <View style={styles.header}>
            <AppText style={styles.title} variant="display" weight="bold" numberOfLines={2}>
              Business Features
            </AppText>
            <AppText style={styles.subtitle} variant="body" weight="medium" numberOfLines={3}>
              Choose which advanced modules your business needs. You can change these later in Settings.
            </AppText>
          </View>

          {/* Warehouses */}
          <View style={[styles.card, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: G.bg }]}>
                <Warehouse size={20} color={G.fg} />
              </View>
              <AppText style={styles.cardTitle} variant="title" weight="bold">
                Multi-Warehouse
              </AppText>
            </View>
            <AppText style={styles.cardDesc} variant="body-sm" weight="medium" numberOfLines={3}>
              Manage stock across multiple physical locations with warehouse-specific inventory tracking.
            </AppText>
            <View style={styles.toggleRow}>
              <AppText style={styles.toggleLabel} variant="body" weight="semibold">Enable warehouses</AppText>
              <Toggle value={warehouses} onValueChange={setWarehouses} />
            </View>
          </View>

          {/* Shipments */}
          <View style={[styles.card, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: G.bg }]}>
                <Truck size={20} color={G.fg} />
              </View>
              <AppText style={styles.cardTitle} variant="title" weight="bold">
                Shipments
              </AppText>
            </View>
            <AppText style={styles.cardDesc} variant="body-sm" weight="medium" numberOfLines={3}>
              Track incoming and outgoing shipments, manage carriers, and monitor delivery status.
            </AppText>
            <View style={styles.toggleRow}>
              <AppText style={styles.toggleLabel} variant="body" weight="semibold">Enable shipments</AppText>
              <Toggle value={shipments} onValueChange={setShipments} />
            </View>
          </View>

          {/* Customers */}
          <View style={[styles.card, { backgroundColor: G.bgCard, borderColor: G.border }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: G.bg }]}>
                <Users size={20} color={G.fg} />
              </View>
              <AppText style={styles.cardTitle} variant="title" weight="bold">
                Customers
              </AppText>
            </View>
            <AppText style={styles.cardDesc} variant="body-sm" weight="medium" numberOfLines={3}>
              Track customer details, record credit sales, and manage customer payments and balances.
            </AppText>
            <View style={styles.toggleRow}>
              <AppText style={styles.toggleLabel} variant="body" weight="semibold">Enable customers</AppText>
              <Toggle value={customers} onValueChange={setCustomers} />
            </View>
          </View>

          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8} onPress={handleContinue}>
            <AppText style={styles.btnText} variant="body" weight="bold" numberOfLines={1}>
              Continue
            </AppText>
            <ChevronRight size={20} color={G.bg} />
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default FeatureSetupScreen;
