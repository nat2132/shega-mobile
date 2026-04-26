import React, { useState } from 'react';
import { Fonts } from '@/constants/theme';
import { ArrowLeft, User, Phone, ChevronLeft, Check, Pencil } from 'lucide-react-native';
import { router } from 'expo-router';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
} from 'react-native';

const DebtManagementFlow = () => {
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [paymentType, setPaymentType] = useState('full'); // 'full' or 'partial'

  if (showPaymentOptions) {
    // SCREEN 3: Choose Amount Paid
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.screenHeader}>
          <TouchableOpacity onPress={() => setShowPaymentOptions(false)} style={styles.backButton}>
            <ChevronLeft size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.screenTitle}>Payment</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.paymentCard}>
          <Text style={styles.sectionTitle}>Choose Amount Paid</Text>

          {/* Full Payment Option */}
          <TouchableOpacity 
            style={[styles.optionRow, paymentType === 'full' && styles.selectedOption]} 
            onPress={() => setPaymentType('full')}
          >
            <View style={styles.radioCircle}>
              {paymentType === 'full' && <View style={styles.radioInner} />}
            </View>
            <Text style={styles.optionText}>Paid Full Payment</Text>
            <Text style={styles.optionAmount}>$1,769.00 ETB</Text>
          </TouchableOpacity>

          {/* Partial Payment Option */}
          <TouchableOpacity 
            style={[styles.optionRow, paymentType === 'partial' && styles.selectedOption]} 
            onPress={() => setPaymentType('partial')}
          >
            <View style={styles.radioCircle}>
              {paymentType === 'partial' && <View style={styles.radioInner} />}
            </View>
            <Text style={styles.optionText}>Partial Payment</Text>
            <Text style={styles.editIcon}>✏️</Text>
          </TouchableOpacity>

          {paymentType === 'partial' && (
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Enter Amount</Text>
              <View style={styles.textInputContainer}>
                <Text style={styles.currencyPrefix}>$</Text>
                <TextInput style={styles.textInput} keyboardType="numeric" placeholder="0.00" />
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.fullWidthButton}>
            <Check size={18} color="#FFF" />
            <Text style={styles.buttonText}>Mark as Paid</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // SCREEN 2: Abebe Kebede Debt Details
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screenHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Debt Details</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <User size={24} color="#000" />
            <View>
              <Text style={styles.title}>Abebe Kebede</Text>
              <Text style={styles.phone}>+(251) 9-123-456</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.overdueBadge}><View style={styles.dot} /><Text style={styles.overdueText}>Overdue</Text></View>
            <Text style={styles.daysText}>6 days overdue</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.itemsContainer}>
          <View style={styles.row}><Text style={styles.itemLabel}>Nails x 2kg</Text><Text style={styles.itemValue}>500.00 ETB</Text></View>
          <View style={styles.row}><Text style={styles.itemLabel}>Paint x 2 cans</Text><Text style={styles.itemValue}>1,249.00 ETB</Text></View>
          <View style={styles.row}><Text style={styles.itemLabel}>Screw x 2 pieces</Text><Text style={styles.itemValue}>20.00 ETB</Text></View>
        </View>

        <View style={styles.divider} />

        <View style={styles.footerRow}>
          <Text style={styles.totalLabel}>Total Debt</Text>
          <Text style={styles.totalValue}>1,769.00 ETB</Text>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity 
            style={styles.markPaidButton} 
            onPress={() => setShowPaymentOptions(true)}
          >
            <Check size={18} color="#FFF" />
            <Text style={styles.buttonText}>Mark as Paid</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.lossButton}>
            <Text style={styles.buttonText}>Mark as a loss</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  screenHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  backButton: { padding: 4 },
  screenTitle: { fontSize: 18, fontFamily: Fonts.bold, fontWeight: 'bold' },
  card: { flex: 1, padding: 20 },
  itemsContainer: { marginVertical: 15 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 18, fontFamily: Fonts.bold, fontWeight: 'bold' },
  phone: { fontSize: 14, color: '#888' },
  headerRight: { alignItems: 'flex-end' },
  overdueBadge: { backgroundColor: '#000', flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF', marginRight: 5, marginTop: 4 },
  overdueText: { color: '#FFF', fontSize: 10, fontFamily: Fonts.bold, fontWeight: 'bold' },
  daysText: { fontSize: 12, marginTop: 5 },
  divider: { height: 1, backgroundColor: '#EEE', marginVertical: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  itemLabel: { fontSize: 15, color: '#888' },
  itemValue: { fontSize: 15, fontFamily: Fonts.semibold, fontWeight: '600' },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  totalLabel: { fontSize: 16, color: '#444' },
  totalValue: { fontSize: 16, fontFamily: Fonts.bold, fontWeight: 'bold' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  markPaidButton: { backgroundColor: '#000', flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 10, flex: 1, marginRight: 10, justifyContent: 'center' },
  lossButton: { backgroundColor: '#000', flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 10, flex: 1, justifyContent: 'center' },
  buttonIcon: { color: '#FFF', marginRight: 8 },
  buttonText: { color: '#FFF', fontFamily: Fonts.bold, fontWeight: 'bold' },

  // Payment Screen Styles
  paymentCard: { flex: 1, paddingTop: 50 },
  sectionTitle: { fontSize: 18, fontFamily: Fonts.bold, fontWeight: 'bold', marginBottom: 20 },
  optionRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#DDD', borderRadius: 15, padding: 18, marginBottom: 15 },
  selectedOption: { borderColor: '#000', borderWidth: 2 },
  radioCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#000', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#000' },
  optionText: { flex: 1, fontSize: 16, fontFamily: Fonts.medium, fontWeight: '500' },
  optionAmount: { fontSize: 16, fontFamily: Fonts.bold, fontWeight: 'bold' },
  editIcon: { fontSize: 18 },
  inputWrapper: { marginTop: 20 },
  inputLabel: { fontSize: 16, marginBottom: 10 },
  textInputContainer: { borderWidth: 1, borderColor: '#DDD', borderRadius: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, height: 55 },
  currencyPrefix: { fontSize: 18, marginRight: 5 },
  textInput: { flex: 1, fontSize: 18 },
  fullWidthButton: { backgroundColor: '#000', flexDirection: 'row', paddingVertical: 16, borderRadius: 10, justifyContent: 'center', marginTop: 'auto', marginBottom: 20 }
});

export default DebtManagementFlow;