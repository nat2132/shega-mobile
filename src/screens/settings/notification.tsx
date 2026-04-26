import React from 'react';
import { View, Text, StyleSheet, Switch, ScrollView } from 'react-native';
import { Package, LineChart, Wallet } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';

const NotificationSettings = () => {
  const { notifications, setNotifications, colors, t } = useSettings();

  const toggle = (key: keyof typeof notifications) => {
    setNotifications({ ...notifications, [key]: !notifications[key] });
  };

  const AlertCard = ({ title, subtitle, value, onValueChange }: any) => {
    const { colors } = useSettings();
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardText}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
        </View>
        <Switch 
          value={value} 
          onValueChange={onValueChange} 
          trackColor={{ false: "#E5E5EA", true: colors.text }}
          thumbColor="#FFF"
        />
      </View>
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.headerLabel, { color: colors.textSecondary }]}>{t('settings.notification_settings')}</Text>
      <Text style={[styles.mainTitle, { color: colors.text }]}>{t('settings.notifications')}</Text>

      <View style={styles.sectionHeader}>
        <Package size={20} color={colors.text} />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.inventory_alerts')}</Text>
      </View>
      <AlertCard 
        title={t('settings.stock_shortage')} 
        subtitle={t('settings.stock_shortage_desc')} 
        value={notifications.stock} 
        onValueChange={() => toggle('stock')} 
      />
      <AlertCard 
        title={t('settings.expiration_status')} 
        subtitle={t('settings.expiration_status_desc')} 
        value={notifications.expiration} 
        onValueChange={() => toggle('expiration')} 
      />

      <View style={styles.sectionHeader}>
        <LineChart size={20} color={colors.text} />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.sales_alerts')}</Text>
      </View>
      <AlertCard 
        title={t('settings.daily_summary')} 
        subtitle={t('settings.daily_summary_desc')} 
        value={notifications.daily} 
        onValueChange={() => toggle('daily')} 
      />

      <View style={styles.sectionHeader}>
        <Wallet size={20} color={colors.text} />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.credit_debt')}</Text>
      </View>
      <AlertCard 
        title={t('settings.credit_status')} 
        subtitle={t('settings.credit_status_desc')} 
        value={notifications.credit} 
        onValueChange={() => toggle('credit')} 
      />
      <AlertCard 
        title={t('settings.debt_status')} 
        subtitle={t('settings.debt_status_desc')} 
        value={notifications.debt} 
        onValueChange={() => toggle('debt')} 
      />

      <Text style={[styles.persistNote, { color: colors.textSecondary }]}>{t('settings.auto_save')}</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF', padding: 25 },
  headerLabel: { fontSize: 12, fontFamily: Fonts.bold, fontWeight: '700', letterSpacing: 1.5, marginTop: 20, color: '#888' },
  mainTitle: { fontSize: 26, fontFamily: Fonts.bold, fontWeight: '700', marginTop: 8, marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 25, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: Fonts.bold, fontWeight: '700', marginLeft: 10 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FAFAFA', padding: 18, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F2F2F7' },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 15, fontFamily: Fonts.bold, fontWeight: '700', marginBottom: 3 },
  cardSubtitle: { fontSize: 12, color: '#8E8E93', fontFamily: Fonts.medium },
  persistNote: { textAlign: 'center', color: '#C0C0C0', fontSize: 11, fontFamily: Fonts.medium, marginTop: 20, marginBottom: 40 },
});

export default NotificationSettings;