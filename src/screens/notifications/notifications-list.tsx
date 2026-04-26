import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text as RNText, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  RefreshControl,
  Dimensions
} from 'react-native';
import { 
  Bell, 
  Package, 
  Handshake, 
  AlertTriangle, 
  CircleAlert,
  ChevronRight,
  Zap,
  ArrowUpRight,
  Trash2,
  ChevronLeft
} from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import { Fonts } from '@/constants/theme';
import { getLowStockItems, getDebtCustomers } from '@/database/db';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown, Layout } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const NotificationsListScreen = () => {
  const { colors, t, theme } = useSettings();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isCleared, setIsCleared] = useState(false);
  const router = useRouter();

  const loadNotifications = async () => {
    if (isCleared) {
      setNotifications([]);
      return;
    }
    
    try {
      const lowStock = await getLowStockItems();
      const debts = await getDebtCustomers();
      
      const combined: any[] = [];

      // Add low stock notifications
      lowStock.forEach((item: any) => {
        combined.push({
          id: `low-stock-${item.id}`,
          type: 'low_stock',
          title: 'Deficit Alert',
          message: `${item.name} capacity dropping (${item.totalBaseQuantity} units remaining)`,
          time: 'Critical',
          icon: <Package size={20} color={colors.primary} />,
          iconBg: colors.primary + '15',
          data: item
        });
      });

      // Add debt notifications
      debts.forEach((debt: any) => {
        combined.push({
          id: `debt-${debt.customerName}`,
          type: 'debt',
          title: 'Exposure Warning',
          message: `${debt.customerName} settlement outstanding (${debt.oweAmount.toLocaleString()} ETB)`,
          time: 'Active',
          icon: <Handshake size={20} color="#FF9500" />,
          iconBg: '#FF950015',
          data: debt
        });
      });

      setNotifications(combined);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [isCleared]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  }, [isCleared]);

  const renderItem = ({ item, index }: { item: any, index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(500)}>
      <TouchableOpacity 
        style={[styles.notificationNode, { backgroundColor: colors.card, borderColor: colors.border }]}
        activeOpacity={0.8}
      >
        <View style={[styles.iconBox, { backgroundColor: item.iconBg }]}>
          {item.icon}
        </View>
        <View style={styles.infoArea}>
          <View style={styles.topRow}>
            <RNText style={[styles.nodeTitle, { color: colors.text }]}>{item.title}</RNText>
            <RNText style={[styles.timeLabel, { color: item.type === 'low_stock' ? colors.primary : '#FF9500' }]}>{item.time}</RNText>
          </View>
          <RNText style={[styles.nodeMessage, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.message}
          </RNText>
          <View style={styles.nodeFooter}>
             <ArrowUpRight size={14} color={colors.border} />
             <RNText style={[styles.footerText, { color: colors.textSecondary }]}>{t('notif.view_orch')}</RNText>
          </View>
        </View>
        <ChevronRight size={18} color={colors.border} />
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View entering={FadeIn.duration(600)} style={{ flex: 1 }}>
        <View style={styles.headerNode}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
             <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15, padding: 4 }}>
               <ChevronLeft size={28} color={colors.text} />
             </TouchableOpacity>
             <View>
               <RNText style={[styles.headerSub, { color: colors.textSecondary }]}>{t('notif.diagnostics')}</RNText>
               <RNText style={[styles.headerTitle, { color: colors.text }]}>{t('notif.sys_pulse')}</RNText>
             </View>
          </View>
          
          {notifications.length > 0 && (
            <TouchableOpacity 
              style={[styles.clearBtn, { backgroundColor: colors.surface }]}
              onPress={() => setIsCleared(true)}
            >
              <Trash2 size={16} color={colors.textSecondary} />
              <RNText style={[styles.clearText, { color: colors.textSecondary }]}>Clear All</RNText>
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          itemLayoutAnimation={Layout.springify()}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.success + '10' }]}>
                 <Activity size={48} color={colors.success} strokeWidth={1} />
              </View>
              <RNText style={[styles.emptyTitle, { color: colors.text }]}>{t('notif.pulse_nominal')}</RNText>
              <RNText style={[styles.emptySub, { color: colors.textSecondary }]}>No system warnings detected. All operational parameters are within standard thresholds.</RNText>
            </View>
          }
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: 25, paddingBottom: 40 },
  headerNode: {
    paddingHorizontal: 25,
    paddingTop: 60,
    paddingBottom: 25,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerSub: {
    fontSize: 11,
    fontFamily: Fonts.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: Fonts.bold,
  },
  notificationNode: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  infoArea: {
    flex: 1,
    marginRight: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nodeTitle: {
    fontFamily: Fonts.bold,
    fontSize: 16,
  },
  timeLabel: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
  },
  nodeMessage: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    lineHeight: 18,
    marginBottom: 8,
  },
  nodeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    fontSize: 11,
    fontFamily: Fonts.semibold,
    opacity: 0.6,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    marginTop: 20,
  },
  emptySub: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    textAlign: 'center',
    marginTop: 8,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  clearText: {
    fontSize: 12,
    fontFamily: Fonts.semibold,
  },
});

export default NotificationsListScreen;
