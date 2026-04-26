import React from 'react';
import { Fonts } from '@/constants/theme';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';

const NefasSilkScreen = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.icon}>🏢</Text>
            <View>
              <Text style={styles.title}>Nefas Silk Kelam</Text>
              <Text style={styles.phone}>📞 +(251) 9-123-456</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.overdueBadge}>
              <View style={styles.dot} />
              <Text style={styles.overdueText}>Overdue</Text>
            </View>
            <Text style={styles.daysText}>6 days overdue</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* List Items */}
        <View style={styles.listContainer}>
          <View style={styles.row}>
            <Text style={styles.itemLabel}>White Paint x 5 box</Text>
            <Text style={styles.itemValue}>500.00 ETB</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.itemLabel}>Black Paint x 4 box</Text>
            <Text style={styles.itemValue}>1,249.00 ETB</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.itemLabel}>Red Paint x 6 box</Text>
            <Text style={styles.itemValue}>20.00 ETB</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Footer */}
        <View style={styles.footerRow}>
          <Text style={styles.totalLabel}>Total Credit</Text>
          <Text style={styles.totalValue}>1,769.00 ETB</Text>
        </View>

        <TouchableOpacity style={styles.markPaidButton}>
          <Text style={styles.buttonIcon}>✔️</Text>
          <Text style={styles.buttonText}>Mark as Paid</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#FFF' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  icon: { fontSize: 24, marginRight: 10 },
  title: { fontSize: 18, fontFamily: Fonts.bold, fontWeight: 'bold', color: '#000' },
  phone: { fontSize: 14, color: '#888', marginTop: 4 },
  headerRight: { alignItems: 'flex-end' },
  overdueBadge: { backgroundColor: '#000', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginBottom: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF', marginRight: 5 },
  overdueText: { color: '#FFF', fontSize: 10, fontFamily: Fonts.bold, fontWeight: 'bold' },
  daysText: { fontSize: 12, color: '#000' },
  divider: { height: 1, backgroundColor: '#EEE', marginVertical: 20 },
  listContainer: { marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  itemLabel: { fontSize: 15, color: '#444' },
  itemValue: { fontSize: 15, fontFamily: Fonts.semibold, fontWeight: '600', color: '#000' },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  totalLabel: { fontSize: 16, color: '#444' },
  totalValue: { fontSize: 16, fontFamily: Fonts.bold, fontWeight: 'bold', color: '#000' },
  markPaidButton: { backgroundColor: '#000', flexDirection: 'row', alignSelf: 'center', paddingVertical: 14, paddingHorizontal: 25, borderRadius: 10, alignItems: 'center' },
  buttonIcon: { color: '#FFF', marginRight: 8 },
  buttonText: { color: '#FFF', fontFamily: Fonts.bold, fontWeight: 'bold', fontSize: 15 },
});

export default NefasSilkScreen;