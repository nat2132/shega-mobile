import { AddOrderItemModal } from '@/components/AddOrderItemModal';
import { CustomDatePicker } from '@/components/CustomDatePicker';
import { PDFLanguageModal } from '@/components/PDFLanguageModal';
import { Fonts } from '@/constants/theme';
import { PROFILE_IMAGES, useSettings } from '@/context/SettingsContext';
import { useSidebar } from '@/context/SidebarContext';
import { getActiveBusiness, getDB, getLowStockItems } from '@/database/db';
import { useNotifications } from '@/hooks/useNotifications';
import { toEthiopianDate, getEthiopianMonthNames } from '@/utils/date-utils';
import { formatNumber } from '@/utils/formatNumber';
import {
  exportExpenseReportCSV,
  exportPLReportCSV,
  exportProductCatalogCSV,
  exportSalesReportCSV,
  exportStockReportCSV,
  generateExpenseReportPDF,
  generateLowStockOrderPDF,
  generateProductListPDF,
  generateProfitAndLossReportPDF,
  generateSalesReportPDF,
  generateStockReportPDF,
} from '@/utils/pdf-utils';
import * as Haptics from 'expo-haptics';
import { useToast } from '@/context/ToastContext';
import PremiumFeatureGate from '@/components/PremiumFeatureGate';
import { useRouter } from 'expo-router';
import {
    Bell,
    Calendar,
    ChevronLeft,
    ClipboardList,
    Download,
    FileSpreadsheet,
    Minus,
    Package,
    Plus,
    Scale,
    ShoppingCart,
    Trash2,
    TrendingUp,
    Wallet
} from 'lucide-react-native';
import React, { useEffect, useState, useMemo } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getReportsGlass } from '@/screens/reports/glass-reports';


type Period = 'D' | 'W' | 'M' | 'Y' | 'C';


const ReportsHubScreenContent = () => {
  const { colors, t, userProfile, calendarType, language } = useSettings();
  const REP_GLASS = useMemo(() => getReportsGlass(colors), [colors]);
  const { openSidebar } = useSidebar();
  const { notifCount } = useNotifications();
  const { showToast } = useToast();
  const router = useRouter();

  const [selectedPeriod, setSelectedPeriod] = useState<Period>('M');
  const [showLangModal, setShowLangModal] = useState(false);
  const [activeReportType, setActiveReportType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Low Stock Order state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showOrderSheet, setShowOrderSheet] = useState(false);
  const [orderExporting, setOrderExporting] = useState(false);
  const [dbLowStockItems, setDbLowStockItems] = useState<any[]>([]);
  const [customOrderItems, setCustomOrderItems] = useState<any[]>([]);

  const allOrderItems = React.useMemo(() => {
    const dbItems = dbLowStockItems.map(item => {
      const override = customOrderItems.find(c => c.id === item.id && !c.isCustom);
      return { ...item, orderQty: override?.orderQty ?? 10, isCustom: false };
    });
    return [...dbItems, ...customOrderItems.filter(c => c.isCustom)];
  }, [dbLowStockItems, customOrderItems]);

  const updateOrderQty = (id: number, isCustom: boolean, delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isCustom) {
      setCustomOrderItems(prev => prev.map(item => item.id === id ? { ...item, orderQty: Math.max(1, item.orderQty + delta) } : item));
    } else {
      setCustomOrderItems(prev => {
        const filtered = prev.filter(c => c.id !== id || c.isCustom);
        const dbItem = dbLowStockItems.find(d => d.id === id);
        if (!dbItem) return prev;
        const existing = prev.find(c => c.id === id && !c.isCustom);
        const newQty = Math.max(1, (existing?.orderQty ?? 10) + delta);
        return [...filtered, { ...dbItem, orderQty: newQty, isCustom: false }];
      });
    }
  };

  const removeCustomOrderItem = (id: number) => {
    setCustomOrderItems(prev => prev.filter(item => item.id !== id || !item.isCustom));
  };

  const addCustomOrderItem = (name: string, companyName: string, orderQty: number) => {
    if (!name?.trim() || !companyName?.trim() || orderQty <= 0) return;
    setCustomOrderItems(prev => [...prev, {
      id: Date.now(), name: name.trim(), companyName: companyName.trim(),
      orderQty: Math.max(1, orderQty), isCustom: true,
      baseUnit: 'pcs', totalBaseQuantity: 0,
    }]);
  };

  const getOrderQty = (item: any) => {
    if (item.isCustom) return item.orderQty;
    return customOrderItems.find(c => c.id === item.id && !c.isCustom)?.orderQty ?? 10;
  };

  const [stats, setStats] = useState({
    salesCount: 0, salesValue: 0,
    itemsCount: 0, itemsValue: 0,
    expensesCount: 0, expensesValue: 0,
  });

  const formatDisplayDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    if (calendarType === 'ethiopian') {
      const e = toEthiopianDate(d);
      const monthNames = getEthiopianMonthNames(language);
      return `${monthNames[e.month - 1]} ${e.day}, ${e.year}`;
    }
    const localeMap: Record<string, string> = { en: 'en-US', am: 'am-ET', om: 'en-US', ti: 'en-US' };
    return d.toLocaleDateString(localeMap[language] || 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getDateRange = (): { start: string; end: string; label: string } => {
    const today = new Date();
    let start = new Date();
    let label = '';

    if (calendarType === 'ethiopian') {
      const ethNow = toEthiopianDate(today);
      switch (selectedPeriod) {
        case 'D':
          start = new Date(today);
          label = `${getEthiopianMonthNames(language)[ethNow.month - 1]} ${ethNow.day}, ${ethNow.year}`;
          break;
        case 'W': {
          const day = today.getDay();
          const diff = today.getDate() - day + (day === 0 ? -6 : 1);
          start = new Date(today.getFullYear(), today.getMonth(), diff);
          const ethStart = toEthiopianDate(start);
          const ethEnd = toEthiopianDate(today);
          const mNames = getEthiopianMonthNames(language);
          label = `${mNames[ethStart.month - 1].substring(0, 3)} ${ethStart.day} – ${ethEnd.day}, ${ethEnd.year}`;
          break;
        }
        case 'M':
          start = new Date(today.getFullYear(), today.getMonth(), 1);
          label = `${getEthiopianMonthNames(language)[ethNow.month - 1]} ${ethNow.year}`;
          break;
        case 'Y':
          start = new Date(today.getFullYear(), 0, 1);
          label = String(ethNow.year);
          break;
        case 'C':
          return { start: startDate, end: endDate, label: `${formatDisplayDate(startDate)} – ${formatDisplayDate(endDate)}` };
      }
    } else {
      const localeMap: Record<string, string> = { en: 'en-US', am: 'am-ET', om: 'en-US', ti: 'en-US' };
      const locale = localeMap[language] || 'en-US';
      switch (selectedPeriod) {
        case 'D':
          start = new Date(today.setHours(0, 0, 0, 0));
          label = today.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
          break;
        case 'W': {
          const day = today.getDay();
          const diff = today.getDate() - day + (day === 0 ? -6 : 1);
          start = new Date(today.setDate(diff));
          const weekEnd = new Date(start);
          weekEnd.setDate(start.getDate() + 6);
          label = `${start.toLocaleDateString(locale, { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })}`;
          break;
        }
        case 'M':
          start = new Date(today.getFullYear(), today.getMonth(), 1);
          label = today.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
          break;
        case 'Y':
          start = new Date(today.getFullYear(), 0, 1);
          label = String(today.getFullYear());
          break;
        case 'C':
          return { start: startDate, end: endDate, label: `${formatDisplayDate(startDate)} – ${formatDisplayDate(endDate)}` };
      }
    }

    return { start: start.toISOString().split('T')[0], end: new Date().toISOString().split('T')[0], label };
  };

  const loadStats = () => {
    try {
      const db = getDB();
      const { start, end } = getDateRange();

      const salesResult = db.getFirstSync<{ count: number; total: number }>(`
        SELECT COUNT(*) as count, SUM(totalPrice) as total FROM sales 
        WHERE date(createdAt) >= ? AND date(createdAt) <= ?
      `, [start, end]);

      const itemsResult = db.getFirstSync<{ count: number; total: number }>(`
        SELECT COUNT(*) as count, SUM(totalBaseQuantity * basePurchasePrice) as total FROM items
      `);

      const expensesResult = db.getFirstSync<{ count: number; total: number }>(`
        SELECT COUNT(*) as count, SUM(amount) as total FROM expenses
        WHERE date(date) >= ? AND date(date) <= ?
      `, [start, end]);

      setStats({
        salesCount: salesResult?.count || 0,
        salesValue: salesResult?.total || 0,
        itemsCount: itemsResult?.count || 0,
        itemsValue: itemsResult?.total || 0,
        expensesCount: expensesResult?.count || 0,
        expensesValue: expensesResult?.total || 0,
      });
    } catch (e) {
      console.error('Failed to load statistics:', e);
    }
  };

  useEffect(() => { loadStats(); }, [selectedPeriod, startDate, endDate]);

  useEffect(() => {
    const items = getLowStockItems();
    setDbLowStockItems(items);
  }, []);

  const handleExportTrigger = (reportType: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActiveReportType(reportType);
    setShowLangModal(true);
  };

  const handleCSVExport = async (reportType: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const db = getDB();
    const { start, end } = getDateRange();
    try {
      if (reportType === 'sales') {
        const sales = db.getAllSync(`
          SELECT s.*, i.name as itemName FROM sales s
          LEFT JOIN items i ON s.itemId = i.id
          WHERE date(s.createdAt) >= ? AND date(s.createdAt) <= ?
          ORDER BY s.createdAt DESC
        `, [start, end]);
        await exportSalesReportCSV(sales as any[]);
      } else if (reportType === 'stock') {
        const items = db.getAllSync(`
          SELECT items.*, categories.name as categoryName FROM items
          LEFT JOIN categories ON items.categoryId = categories.id
          ORDER BY items.name ASC
        `);
        await exportStockReportCSV(items as any[]);
      } else if (reportType === 'expenses') {
        const expenses = db.getAllSync(`
          SELECT * FROM expenses WHERE date(date) >= ? AND date(date) <= ?
          ORDER BY date DESC
        `, [start, end]);
        await exportExpenseReportCSV(expenses as any[]);
      } else if (reportType === 'pl') {
        const revRes = db.getFirstSync<{ total: number }>(`
          SELECT SUM(totalPrice) as total FROM sales WHERE date(createdAt) >= ? AND date(createdAt) <= ?
        `, [start, end]);
        const cogsRes = db.getFirstSync<{ total: number }>(`
          SELECT SUM(s.quantity * (CASE WHEN s.unitType = 'pack' THEN i.packPurchasePrice ELSE i.basePurchasePrice END)) as total
          FROM sales s JOIN items i ON s.itemId = i.id
          WHERE date(s.createdAt) >= ? AND date(s.createdAt) <= ?
        `, [start, end]);
        const expRes = db.getFirstSync<{ total: number }>(`
          SELECT SUM(amount) as total FROM expenses WHERE date(date) >= ? AND date(date) <= ?
        `, [start, end]);
        await exportPLReportCSV({
          revenue: revRes?.total || 0,
          cogs: cogsRes?.total || 0,
          expenses: expRes?.total || 0,
        });
      } else if (reportType === 'products') {
        const items = db.getAllSync(`
          SELECT items.*, categories.name as categoryName FROM items
          LEFT JOIN categories ON items.categoryId = categories.id
          ORDER BY items.name ASC
        `);
        await exportProductCatalogCSV(items as any[]);
      }
      const type = reportType.charAt(0).toUpperCase() + reportType.slice(1);
      showToast({ title: t('toast.report_csv_exported', { type }), message: t('toast.report_csv_desc'), type: 'success' });
    } catch (e) {
      console.error('CSV export error:', e);
      showToast('CSV export failed', 'error');
    }
  };

  const handleOrderExport = () => {
    if (allOrderItems.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActiveReportType('order');
    setShowLangModal(true);
  };

  const handleLanguageSelected = async (langCode: 'en' | 'am' | 'om' | 'ti', calendar: 'gregorian' | 'ethiopian', action: 'share' | 'save') => {
    if (activeReportType === 'order') {
      setOrderExporting(true);
      try {
        const activeBusiness = getActiveBusiness();
        const ts = calendar === 'ethiopian' ? 'ethiopian' : 'device';
        await generateLowStockOrderPDF(allOrderItems, activeBusiness, langCode, action, ts);
        showToast({ title: t('toast.report_order_exported'), message: t('toast.report_order_desc'), type: 'success' });
      } catch (e) { console.error(e); showToast('Failed to generate order PDF', 'error'); }
      finally { setOrderExporting(false); setActiveReportType(null); }
      return;
    }
    setLoading(true);
    const db = getDB();
    const activeBusiness = getActiveBusiness();
    const { start, end, label } = getDateRange();

    try {
      const ts = calendar === 'ethiopian' ? 'ethiopian' : 'device';
      if (activeReportType === 'sales') {
        const sales = db.getAllSync(`
          SELECT s.*, i.name as itemName FROM sales s
          LEFT JOIN items i ON s.itemId = i.id
          WHERE date(s.createdAt) >= ? AND date(s.createdAt) <= ?
          ORDER BY s.createdAt DESC
        `, [start, end]);
        await generateSalesReportPDF(sales, label, `${start} ~ ${end}`, activeBusiness, langCode, action, ts);
      } else if (activeReportType === 'stock') {
        const items = db.getAllSync(`
          SELECT items.*, categories.name as categoryName FROM items
          LEFT JOIN categories ON items.categoryId = categories.id
          ORDER BY items.name ASC
        `);
        await generateStockReportPDF(items, label, `${start} ~ ${end}`, activeBusiness, langCode, action, ts);
      } else if (activeReportType === 'products') {
        const items = db.getAllSync(`
          SELECT items.*, categories.name as categoryName FROM items
          LEFT JOIN categories ON items.categoryId = categories.id
          ORDER BY items.name ASC
        `);
        await generateProductListPDF(items, activeBusiness, langCode, action, ts);
      } else if (activeReportType === 'expenses') {
        const expenses = db.getAllSync(`
          SELECT * FROM expenses WHERE date(date) >= ? AND date(date) <= ?
          ORDER BY date DESC
        `, [start, end]);
        await generateExpenseReportPDF(expenses, label, `${start} ~ ${end}`, activeBusiness, langCode, action, ts);
      } else if (activeReportType === 'pl') {
        const revRes = db.getFirstSync<{ total: number }>(`
          SELECT SUM(totalPrice) as total FROM sales WHERE date(createdAt) >= ? AND date(createdAt) <= ?
        `, [start, end]);
        const cogsRes = db.getFirstSync<{ total: number }>(`
          SELECT SUM(s.quantity * (CASE WHEN s.unitType = 'pack' THEN i.packPurchasePrice ELSE i.basePurchasePrice END)) as total
          FROM sales s JOIN items i ON s.itemId = i.id
          WHERE date(s.createdAt) >= ? AND date(s.createdAt) <= ?
        `, [start, end]);
        const expRes = db.getFirstSync<{ total: number }>(`
          SELECT SUM(amount) as total FROM expenses WHERE date(date) >= ? AND date(date) <= ?
        `, [start, end]);
        await generateProfitAndLossReportPDF(
          { revenue: revRes?.total || 0, cogs: cogsRes?.total || 0, expenses: expRes?.total || 0 },
          label, `${start} ~ ${end}`, activeBusiness, langCode, action, ts
        );
      }
      const label = activeReportType ? activeReportType.charAt(0).toUpperCase() + activeReportType.slice(1) : 'Report';
      showToast({ title: t('toast.report_pdf_ready', { label }), message: t('toast.report_pdf_desc'), type: 'success' });
    } catch (e) {
      console.error('Failed to generate PDF:', e);
      showToast('PDF generation failed', 'error');
    } finally {
      setLoading(false);
      setActiveReportType(null);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: REP_GLASS.bg }]} edges={['top', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Ambient glow */}
        <View style={StyleSheet.absoluteFill}>
          <View style={[styles.bgWash, { top: -50, right: -50, backgroundColor: '#FFFFFF', opacity: 0.03 }]} />
          <View style={[styles.bgWash, { top: 300, left: -80, backgroundColor: '#FFFFFF', opacity: 0.02 }]} />
          <View style={[styles.bgWash, { top: 700, right: -60, backgroundColor: '#FFFFFF', opacity: 0.015 }]} />
        </View>

        {/* →→ Dashboard-style Header →→ */}
        <View style={styles.integratedHeader}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { borderColor: REP_GLASS.border, backgroundColor: REP_GLASS.bgCard }]}>
            <ChevronLeft size={24} color={REP_GLASS.fgSecondary} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 15 }}>
            <Text style={[styles.headerSub, { color: REP_GLASS.muted }]}>{t('reports.financial_orch')}</Text>
            <Text style={[styles.headerTitle, { color: REP_GLASS.fg }]}>{t('reports.hub_title')}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => router.push('/notifications')}
              style={[styles.headerIconBtn, { borderColor: REP_GLASS.border, backgroundColor: REP_GLASS.bgCard }]}
            >
              <Bell size={24} color={REP_GLASS.fgSecondary} strokeWidth={2} />
              {notifCount > 0 && (
                <View style={[styles.notifBadge, { backgroundColor: '#FFFFFF', borderColor: REP_GLASS.bg }]}>
                  <Text style={[styles.notifBadgeText, { color: REP_GLASS.bg }]}>{notifCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={openSidebar}
              activeOpacity={0.7}
              style={[styles.headerAvatarWrap, { borderColor: REP_GLASS.borderLight, backgroundColor: REP_GLASS.bgCard }]}
            >
              <Image source={userProfile.avatarUri ? { uri: userProfile.avatarUri } : PROFILE_IMAGES[userProfile.avatarIndex >= 0 ? userProfile.avatarIndex : 0]} style={styles.headerAvatar} />
              <View style={[styles.onlineIndicator, { backgroundColor: '#30D158', borderColor: REP_GLASS.bg }]} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Period Selector */}
        <View style={[styles.tabBar, { backgroundColor: REP_GLASS.bgCard, borderColor: REP_GLASS.border }]}>
          {(['D', 'W', 'M', 'Y', 'C'] as const).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.tabItem, selectedPeriod === p && { backgroundColor: REP_GLASS.fg }]}
              onPress={() => { Haptics.selectionAsync(); setSelectedPeriod(p); }}
            >
              <Text style={[styles.tabText, { color: selectedPeriod === p ? REP_GLASS.bg : REP_GLASS.muted }]}>
                {p === 'D' ? t('reports.day') : p === 'W' ? t('reports.week') : p === 'M' ? t('reports.month') : p === 'Y' ? t('reports.year') : t('reports.custom')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom Date Inputs */}
        {selectedPeriod === 'C' && (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.customDateRow}>
            <TouchableOpacity
              style={[styles.dateInput, { backgroundColor: REP_GLASS.bgCard, borderColor: REP_GLASS.border }]}
              onPress={() => setShowStartDatePicker(true)}
            >
              <Calendar size={16} color={REP_GLASS.muted} style={{ marginRight: 8 }} />
              <View>
                <Text style={[styles.dateInputLbl, { color: REP_GLASS.muted }]}>{t('reports.start_date')}</Text>
                <Text style={[styles.dateInputVal, { color: REP_GLASS.fg }]}>{formatDisplayDate(startDate)}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dateInput, { backgroundColor: REP_GLASS.bgCard, borderColor: REP_GLASS.border }]}
              onPress={() => setShowEndDatePicker(true)}
            >
              <Calendar size={16} color={REP_GLASS.muted} style={{ marginRight: 8 }} />
              <View>
                <Text style={[styles.dateInputLbl, { color: REP_GLASS.muted }]}>{t('reports.end_date')}</Text>
                <Text style={[styles.dateInputVal, { color: REP_GLASS.fg }]}>{formatDisplayDate(endDate)}</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Range label */}
        <View style={styles.rangeLabelRow}>
          <Calendar size={14} color={REP_GLASS.fg} />
          <Text style={[styles.rangeLabelText, { color: REP_GLASS.fgSecondary }]}>
            {t('reports.active_range', { label: getDateRange().label })}
          </Text>
        </View>

        {/* Low Stock Order Section — trigger button only */}
        <View style={styles.orderSection}>
          <TouchableOpacity
            style={[styles.orderTriggerBtn, { backgroundColor: REP_GLASS.bgCard, borderColor: REP_GLASS.border }]}
            onPress={() => setShowOrderSheet(true)}
            activeOpacity={0.75}
          >
            <View style={[styles.orderTriggerIcon, { backgroundColor: REP_GLASS.accentGlass }]}>
              <Package size={20} color={REP_GLASS.fgSecondary} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[styles.orderTriggerTitle, { color: REP_GLASS.fg }]}>{t('reports.product_order')}</Text>
              <Text style={[styles.orderTriggerSub, { color: REP_GLASS.muted }]}>
                {allOrderItems.length > 0
                   ? t('reports.items_in_order', { count: String(allOrderItems.length) })
                  : t('reports.build_restock')}
              </Text>
            </View>
            <ChevronLeft size={18} color={REP_GLASS.muted} style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>
        </View>

        {/* Report Cards */}
        <View style={styles.reportList}>
          <ReportCard title={t('reports.sales_perf_title')} description={t('reports.sales_perf_desc')} icon={TrendingUp} iconColor="#10B981" stats={`${stats.salesCount} Sales • ${formatNumber(stats.salesValue)} ETB`} onExport={() => handleExportTrigger('sales')} onExportCSV={() => handleCSVExport('sales')} colors={colors} t={t} repGlass={REP_GLASS} />
          <ReportCard title={t('reports.stock_val_title')} description={t('reports.stock_val_desc')} icon={Package} iconColor="#3B82F6" stats={`${stats.itemsCount} Products • ${formatNumber(stats.itemsValue)} ETB Valuation`} onExport={() => handleExportTrigger('stock')} onExportCSV={() => handleCSVExport('stock')} colors={colors} t={t} repGlass={REP_GLASS} />
          <ReportCard title={t('reports.expense_title')} description={t('reports.expense_desc')} icon={Wallet} iconColor="#EF4444" stats={`${stats.expensesCount} Expenses • ${formatNumber(stats.expensesValue)} ETB`} onExport={() => handleExportTrigger('expenses')} onExportCSV={() => handleCSVExport('expenses')} colors={colors} t={t} repGlass={REP_GLASS} />
          <ReportCard title={t('reports.pl_title')} description={t('reports.pl_desc')} icon={Scale} iconColor="#8B5CF6" stats={`Net: ${formatNumber(stats.salesValue - stats.expensesValue)} ETB`} onExport={() => handleExportTrigger('pl')} onExportCSV={() => handleCSVExport('pl')} colors={colors} t={t} repGlass={REP_GLASS} />
          <ReportCard title={t('reports.catalog_title')} description={t('reports.catalog_desc')} icon={ClipboardList} iconColor="#F59E0B" stats={`${stats.itemsCount} Total items`} onExport={() => handleExportTrigger('products')} onExportCSV={() => handleCSVExport('products')} colors={colors} t={t} repGlass={REP_GLASS} />
        </View>
      </ScrollView>

      {/* Order Bottom Sheet */}
      <Modal visible={showOrderSheet} transparent animationType="slide" onRequestClose={() => setShowOrderSheet(false)}>
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setShowOrderSheet(false)} />
          <View style={[styles.sheetContainer, { backgroundColor: REP_GLASS.bg, borderTopWidth: 1, borderTopColor: REP_GLASS.border }]}>
            {/* Handle */}
            <View style={styles.sheetHandleRow}>
              <View style={[styles.sheetHandle, { backgroundColor: REP_GLASS.mutedLight }]} />
            </View>

            {/* Sheet Header */}
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.orderSectionSub, { color: REP_GLASS.muted }]}>{t('reports.inventory_health')}</Text>
                <Text style={[styles.orderSectionTitle, { color: REP_GLASS.fg }]}>{t('reports.product_order')}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {allOrderItems.length > 0 && (
                  <TouchableOpacity
                    style={[styles.orderActionBtn, { backgroundColor: REP_GLASS.fg }]}
                    onPress={handleOrderExport}
                    activeOpacity={0.7}
                  >
                    {orderExporting ? (
                      <ActivityIndicator size="small" color={REP_GLASS.bg} />
                    ) : (
                      <>
                        <Download size={13} color={REP_GLASS.bg} />
                        <Text style={[styles.orderActionBtnText, { color: REP_GLASS.bg }]}>{t('reports.order_pdf')}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.orderActionBtn, { backgroundColor: REP_GLASS.bgCard, borderWidth: 1, borderColor: REP_GLASS.border }]}
                  onPress={() => setShowAddModal(true)}
                  activeOpacity={0.7}
                >
                  <Plus size={13} color={REP_GLASS.fgSecondary} />
                  <Text style={[styles.orderActionBtnText, { color: REP_GLASS.fgSecondary }]}>{t('reports.add_item')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Item List */}
            <FlatList
              data={allOrderItems}
              keyExtractor={(item) => item.id + (item.isCustom ? '-c' : '')}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetList}
              renderItem={({ item }) => {
                const qty = getOrderQty(item);
                const isOut = !item.isCustom && item.totalBaseQuantity <= 0;
                return (
                  <View style={[styles.orderItemRow, { backgroundColor: REP_GLASS.bgCard, borderColor: item.isCustom ? REP_GLASS.borderLight : REP_GLASS.border }]}>
                    <View style={[styles.orderItemIcon, { backgroundColor: REP_GLASS.accentGlass }]}>
                      {item.isCustom
                        ? <ShoppingCart size={18} color={REP_GLASS.fgSecondary} />
                        : <Package size={18} color={isOut ? REP_GLASS.fgSecondary : REP_GLASS.muted} />}
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.orderItemName, { color: REP_GLASS.fg }]} numberOfLines={1}>{item.name}</Text>
                      <Text style={[styles.orderItemSub, { color: REP_GLASS.muted }]}>
                        {item.isCustom ? item.companyName : (isOut ? t('common.out_of_stock') : `${item.totalBaseQuantity} ${item.baseUnit || 'pcs'} left`)}
                      </Text>
                    </View>
                    <View style={styles.orderQtyStepper}>
                      <TouchableOpacity style={[styles.orderStepBtn, { borderColor: REP_GLASS.border }]} onPress={() => updateOrderQty(item.id, !!item.isCustom, -1)}>
                        <Minus size={12} color={REP_GLASS.muted} />
                      </TouchableOpacity>
                      <Text style={[styles.orderQtyVal, { color: REP_GLASS.fg }]}>{qty}</Text>
                      <TouchableOpacity style={[styles.orderStepBtn, { borderColor: REP_GLASS.border }]} onPress={() => updateOrderQty(item.id, !!item.isCustom, 1)}>
                        <Plus size={12} color={REP_GLASS.muted} />
                      </TouchableOpacity>
                    </View>
                    {item.isCustom && (
                      <TouchableOpacity style={styles.orderDeleteBtn} onPress={() => removeCustomOrderItem(item.id)}>
                        <Trash2 size={15} color="#FF453A" />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={[styles.orderEmpty, { backgroundColor: REP_GLASS.bgCard, borderColor: REP_GLASS.border }]}>
                  <View style={[styles.orderItemIcon, { backgroundColor: REP_GLASS.accentGlass, width: 48, height: 48, borderRadius: 16 }]}>
                    <Package size={24} color={REP_GLASS.muted} />
                  </View>
                  <Text style={[styles.orderEmptyText, { color: REP_GLASS.muted }]}>{t('reports.optimal_stock')}</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      <PDFLanguageModal visible={showLangModal} onClose={() => setShowLangModal(false)} onSelect={handleLanguageSelected} />
      <CustomDatePicker visible={showStartDatePicker} onClose={() => setShowStartDatePicker(false)} onSelectDate={(date: string) => { if (date) setStartDate(date); setShowStartDatePicker(false); }} initialDate={startDate} />
      <CustomDatePicker visible={showEndDatePicker} onClose={() => setShowEndDatePicker(false)} onSelectDate={(date: string) => { if (date) setEndDate(date); setShowEndDatePicker(false); }} initialDate={endDate} />
      <AddOrderItemModal visible={showAddModal} onClose={() => setShowAddModal(false)} onAdd={addCustomOrderItem} />

      {loading && (
        <View style={styles.loadingOverlay}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.50)' }]} />
          <View style={[styles.loadingBox, { backgroundColor: REP_GLASS.bgCard, borderWidth: 1, borderColor: REP_GLASS.border }]}>
            <ActivityIndicator size="large" color={REP_GLASS.fg} />
            <Text style={[styles.loadingText, { color: REP_GLASS.fg }]}>{t('reports.compiling_pdf')}</Text>
          </View>
        </View>
      )}

    </SafeAreaView>
  );
}

const ReportCard = ({ title, description, icon: Icon, iconColor, stats, onExport, onExportCSV, colors, t, repGlass }: any) => {
  const REP_GLASS = repGlass;
  return (
  <Animated.View entering={FadeInDown.duration(500)} style={[styles.card, { backgroundColor: REP_GLASS.bgCard, borderColor: REP_GLASS.border }]}>
    <View style={styles.cardHeader}>
      <View style={[styles.iconBox, { backgroundColor: iconColor + '20' }]}>
        <Icon size={22} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.cardTitle, { color: REP_GLASS.fg }]}>{title}</Text>
        <Text style={[styles.cardDesc, { color: REP_GLASS.muted }]}>{description}</Text>
      </View>
    </View>
    <View style={[styles.cardFooter, { borderTopColor: REP_GLASS.border }]}>
      <Text style={[styles.cardStats, { color: REP_GLASS.muted }]}>{stats}</Text>
      <View style={styles.cardBtnRow}>
        <TouchableOpacity
          style={[styles.exportBtn, { backgroundColor: '#30D15820', borderWidth: 1, borderColor: '#30D15840' }]}
          onPress={onExportCSV}
          activeOpacity={0.7}
        >
          <FileSpreadsheet size={13} color="#30D158" style={{ marginRight: 5 }} />
          <Text style={[styles.exportBtnText, { color: '#30D158' }]}>{t('reports.excel')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.exportBtn, { backgroundColor: REP_GLASS.fg }]} onPress={onExport} activeOpacity={0.7}>
          <Download size={13} color={REP_GLASS.bg} style={{ marginRight: 5 }} />
          <Text style={[styles.exportBtnText, { color: REP_GLASS.bg }]}>{t('reports.pdf')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 25, paddingBottom: 40 },
  bgWash: { position: 'absolute', width: 300, height: 300, borderRadius: 150 },
  // →→ Dashboard-matching header →→
  integratedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    paddingBottom: 25,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSub: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 2 },
  headerTitle: { fontSize: 24, fontFamily: Fonts.bold },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconBtn: {
    width: 48, height: 48, borderRadius: 24, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center', position: 'relative',
  },
  notifBadge: {
    position: 'absolute', top: -2, right: -2,
    minWidth: 18, height: 18, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 4, borderWidth: 2,
  },
  notifBadgeText: { fontSize: 9, fontFamily: Fonts.bold, marginTop: 1 },
  headerAvatarWrap: {
    width: 50, height: 50, borderRadius: 25, borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center', padding: 2, position: 'relative',
  },
  headerAvatar: { width: '100%', height: '100%', borderRadius: 25 },
  onlineIndicator: {
    width: 14, height: 14, borderRadius: 7, borderWidth: 2,
    position: 'absolute', bottom: 0, right: 0,
  },
  // →→ Period tabs →→
  tabBar: { flexDirection: 'row', borderRadius: 16, borderWidth: 1, padding: 4, marginBottom: 20 },
  tabItem: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  tabText: { fontSize: 12, fontFamily: Fonts.bold },

  customDateRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  dateInput: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16, borderWidth: 1 },
  dateInputLbl: { fontSize: 9, fontFamily: Fonts.medium },
  dateInputVal: { fontSize: 13, fontFamily: Fonts.bold, marginTop: 2 },

  rangeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 25 },
  rangeLabelText: { fontSize: 12, fontFamily: Fonts.bold },

  reportList: { gap: 16 },

  // Low Stock Order section
  orderSection: { marginBottom: 30 },
  orderTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  orderTriggerIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderTriggerTitle: { fontSize: 16, fontFamily: Fonts.bold, marginBottom: 2 },
  orderTriggerSub: { fontSize: 12, fontFamily: Fonts.medium },
  // Sheet
  sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheetContainer: { borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: '85%', overflow: 'hidden' },
  sheetHandleRow: { alignItems: 'center', paddingTop: 14, paddingBottom: 4 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 25, paddingTop: 10, paddingBottom: 16 },
  sheetList: { paddingHorizontal: 25, paddingBottom: 40, gap: 10 },
  // Order items (shared between sheet and old inline)
  orderSectionSub: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 2 },
  orderSectionTitle: { fontSize: 22, fontFamily: Fonts.bold },
  orderActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  orderActionBtnText: { fontSize: 12, fontFamily: Fonts.bold },
  orderEmpty: { borderRadius: 20, borderWidth: 1, padding: 30, alignItems: 'center', gap: 10 },
  orderEmptyText: { fontSize: 13, fontFamily: Fonts.medium },
  orderItemRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1, padding: 14 },
  orderItemIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  orderItemName: { fontSize: 14, fontFamily: Fonts.bold, marginBottom: 2 },
  orderItemSub: { fontSize: 11, fontFamily: Fonts.medium },
  orderQtyStepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderStepBtn: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  orderQtyVal: { fontSize: 14, fontFamily: Fonts.bold, minWidth: 24, textAlign: 'center' },
  orderDeleteBtn: { marginLeft: 8, width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
  card: { borderRadius: 24, borderWidth: 1, padding: 20, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', gap: 15, marginBottom: 16 },
  iconBox: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontFamily: Fonts.bold },
  cardDesc: { fontSize: 12, fontFamily: Fonts.medium, marginTop: 4, lineHeight: 18 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, paddingTop: 15 },
  cardStats: { fontSize: 11, fontFamily: Fonts.bold, flex: 1, marginRight: 8 },
  cardBtnRow: { flexDirection: 'row', gap: 8 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 12 },
  exportBtnText: { fontSize: 11, fontFamily: Fonts.bold },

  loadingOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
  loadingBox: { padding: 30, borderRadius: 24, alignItems: 'center', gap: 15, elevation: 5 },
  loadingText: { fontSize: 14, fontFamily: Fonts.bold },
});

export default function ReportsHubScreen() {
  return (
    <PremiumFeatureGate feature="reports">
      <ReportsHubScreenContent />
    </PremiumFeatureGate>
  );
}