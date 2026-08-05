import { DraftSection } from '@/components/DraftSection';
import { NotificationBell } from '@/components/NotificationBell';
import { AppNumber, AppText } from "@/components/ui";
import { Fonts } from "@/constants/theme";
import { useDialog } from "@/context/DialogContext";
import { PROFILE_IMAGES, useSettings } from "@/context/SettingsContext";
import { useSidebar } from "@/context/SidebarContext";
import {
  archiveBudget,
  deleteBudget,
  getBudgetAlerts,
  getBudgetDashboard,
  getBudgetFinalStats,
  getBudgetLifecycle,
  getBudgets,
  getBudgetWithCategoryProgress,
  getBudgetOverageStats,
  getBudgetOverageHistory,
  getAllBudgetsSummary,
  getNextBudgetPeriod,
  insertBudget,
  renewBudget,
} from "@/database/db";
import { useFormDrafts } from '@/hooks/useFormDrafts';
import { useNotifications } from "@/hooks/useNotifications";
import { useAutoHideScroll } from "@/hooks/useAutoHideScroll";
import { notifyBudgetCreated } from '@/services/notificationService';
import { playNice } from '@/services/soundService';
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { AlertTriangle, DollarSign, Plus, X } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { getBudgetGlass } from './glass-budget';
import { useTutorial, useTutorialExample, TutorialTarget, TutorialButton, TutorialScrollView } from '@/tutorials';
import { budgetTutorial, createBudgetTutorial } from '@/tutorials/definitions';
import { formatDate, getEthiopianMonthNames, toEthiopianDate } from '@/utils/date-utils';

const formatBudgetPeriod = (budget: any, calendarType: 'ethiopian' | 'gregorian', language: string) => {
  if (!budget?.year) return '';
  if (calendarType === 'ethiopian') {
    const et = toEthiopianDate(new Date(budget.year, (budget.month || 1) - 1, 15));
    const monthName = getEthiopianMonthNames(language)[et.month - 1];
    return budget.month ? `${monthName} ${et.year}` : String(et.year);
  }
  return budget.month ? `${budget.year}/${String(budget.month).padStart(2, '0')}` : String(budget.year);
};

const StatusBadge = ({ status }: { status: string }) => {
  const { colors, t } = useSettings();
  const statusMap: Record<string, { color: string; labelKey: string }> = {
    exceeded: { color: colors.error, labelKey: "budget.over_budget" },
    over: { color: colors.error, labelKey: "budget.over_budget" },
    critical: { color: colors.warning, labelKey: "budget.near_limit" },
    warning: { color: colors.warning, labelKey: "budget.near_limit" },
    near: { color: colors.warning, labelKey: "budget.near_limit" },
    ok: { color: colors.success, labelKey: "budget.on_track" },
    within: { color: colors.success, labelKey: "budget.on_track" },
    on_track: { color: colors.success, labelKey: "budget.on_track" },
    no_budget: { color: colors.textSecondary, labelKey: "budget.no_budget_label" },
  };
  const c = statusMap[status] || statusMap.ok;
  return (
    <View style={[s.badge, { backgroundColor: c.color + "18" }]}>
      <View style={[s.badgeDot, { backgroundColor: c.color }]} />
      <AppText variant="micro" weight="bold" style={{ color: c.color }}>{t(c.labelKey)}</AppText>
    </View>
  );
};

const ProgressRing = ({ progress, size = 88 }: { progress: number; size?: number }) => {
  const { colors } = useSettings();
  const G = getBudgetGlass(colors);
  const strokeWidth = 7;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, Number(progress) || 0));
  const offset = circumference - (pct / 100) * circumference;
  const color = pct >= 100 ? colors.error : pct >= 80 ? colors.warning : colors.success;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={G.border} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={color} strokeWidth={strokeWidth} fill="none"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { justifyContent: "center", alignItems: "center" }]}>
        <AppNumber value={pct} size="heading" suffix="%" color={color} />
      </View>
    </View>
  );
};

const BudgetOverview = () => {
  const { openSidebar } = useSidebar();
  const { userProfile, colors, t, calendarType, language } = useSettings();
  const G = getBudgetGlass(colors);
  const hideFABStyle = useAutoHideScroll();
  const { notifCount } = useNotifications();
  const router = useRouter();
  const dialog = useDialog();
  const tutorial = useTutorial({ tutorial: budgetTutorial });

  const [dashboard, setDashboard] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [monthSummary, setMonthSummary] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<any>(null);


  const [allBudgets, setAllBudgets] = useState<any[]>([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState<number | null>(null);
  const [lifecycle, setLifecycle] = useState<any>({ active: [], expiringSoon: [], expired: [], archived: [] });

  const loadData = useCallback(() => {
    setAllBudgets(getBudgets());
    setLifecycle(getBudgetLifecycle());
    if (selectedBudgetId) {
      const budgetData = getBudgetWithCategoryProgress(selectedBudgetId);
      setDashboard(budgetData ? { activeBudgets: [budgetData], totalBudget: budgetData.totalPlanned, totalSpent: budgetData.totalSpent, remaining: budgetData.remaining, healthScore: budgetData.percentUsed ? 100 - budgetData.percentUsed : 100 } : getBudgetDashboard());
      setMonthSummary({
        hasBudget: true,
        budgetId: selectedBudgetId,
        budgetName: budgetData?.name || '',
        totalPlanned: budgetData?.totalPlanned || 0,
        totalSpent: budgetData?.totalSpent || 0,
        remaining: budgetData?.remaining || 0,
        percentUsed: budgetData?.percentUsed || 0,
        byCategory: (budgetData?.categories || []).map((c: any) => ({
          name: c.category,
          spent: c.spent || 0,
          planned: c.plannedAmount || 0,
          percentUsed: c.percentUsed || 0,
          remaining: c.remaining || 0,
          status: c.status || 'ok',
        })),
      });
    } else {
      setDashboard(getBudgetDashboard());
      setMonthSummary(getAllBudgetsSummary());
    }
    setAlerts(getBudgetAlerts(80));
  }, [selectedBudgetId]);

  const handleSwitchBudget = useCallback((budgetId: number | null) => {
    setSelectedBudgetId(budgetId);
    setShowDetailModal(false);
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleCategoryPress = (category: string) => {
    router.push(`/(tabs)/expense?filterCategory=${encodeURIComponent(category)}`);
  };

  const handleBudgetPress = (budgetId: number) => {
    const full = getBudgetWithCategoryProgress(budgetId);
    if (!full) return;
    const isHistoric = full.status === 'expired' || full.status === 'archived' || full.status === 'closed';
    const overageStats = getBudgetOverageStats();
    const overage = {
      stats: overageStats?.byBudget?.find((s: any) => s.budgetId === budgetId) || null,
      history: getBudgetOverageHistory(budgetId, 10),
    };
    const detail = { ...full, finalStats: isHistoric ? getBudgetFinalStats(budgetId) : null, overage };
    setSelectedBudget(detail);
    setShowDetailModal(true);
  };

  const handleDeleteBudget = async (id: number) => {
    const confirmed = await dialog.confirm({
      title: t('budget.delete_confirm_title'),
      message: t('budget.delete_confirm_msg'),
      confirmText: t('common.delete') || 'Delete',
      cancelText: t('common.cancel'),
      destructive: true,
    });
    if (confirmed) { deleteBudget(id); playNice(); loadData(); setShowDetailModal(false); }
  };

  const handleRenewBudget = async (budget: any) => {
    const confirmed = await dialog.confirm({
      title: t('budget.renew') || 'Renew Budget',
      message: t('budget.renew_confirm_msg') || 'Renew this budget for the next period? The previous period stays saved for history.',
      confirmText: t('budget.renew') || 'Renew',
      cancelText: t('common.cancel'),
    });
    if (!confirmed) return;
    const next = getNextBudgetPeriod(budget);
    const newId = renewBudget(budget.id, { name: budget.name, period: budget.period, year: next.year, month: next.month });
    if (!newId) {
      await dialog.alert({ title: t('common.error'), message: t('budget.renew_failed') || 'Could not renew the budget.', iconType: 'danger' });
      return;
    }
    notifyBudgetCreated({
      id: newId as number,
      name: budget.name,
      period: budget.period,
      year: next.year,
      month: next.month,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playNice();
    setSelectedBudgetId(newId as number);
    loadData();
    setShowDetailModal(false);
  };

  const handleArchiveBudget = async (budget: any) => {
    const confirmed = await dialog.confirm({
      title: t('budget.archive') || 'Archive Budget',
      message: t('budget.archive_confirm_msg') || 'Archive this budget? Its expenses stay saved and reports still include it.',
      confirmText: t('budget.archive') || 'Archive',
      cancelText: t('common.cancel'),
    });
    if (!confirmed) return;
    archiveBudget(budget.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playNice();
    if (selectedBudgetId === budget.id) setSelectedBudgetId(null);
    loadData();
    setShowDetailModal(false);
  };

  const lifecycleSections = [
    { key: 'active', label: t('budget.status_active'), items: lifecycle.active || [], empty: t('budget.no_budgets') },
    { key: 'expiring', label: t('budget.expiring_soon'), items: lifecycle.expiringSoon || [], empty: t('budget.no_expiring') },
    { key: 'expired', label: t('budget.status_expired'), items: lifecycle.expired || [], empty: t('budget.no_expired') },
    { key: 'archived', label: t('budget.status_archived'), items: lifecycle.archived || [], empty: t('budget.no_archived') },
  ];

  const renderBudgetCard = (budget: any) => {
    const pct = budget.totalPlanned > 0 ? Math.round((budget.totalActual / budget.totalPlanned) * 100) : 0;
    const expired = budget.status === 'expired' || budget.status === 'archived' || budget.status === 'closed' || budget.hasExpired;
    const barColor = expired ? G.fgSecondary : pct >= 100 ? colors.error : pct >= 80 ? colors.warning : colors.success;
    return (
      <TouchableOpacity key={budget.id} style={[s.budgetCard, { backgroundColor: G.bgCard, borderColor: expired ? colors.warning + '40' : G.border }]}
        onPress={() => handleBudgetPress(budget.id)}>
        <View style={s.budgetCardHeader}>
          <View style={{ flex: 1 }}>
            <AppText variant="body" weight="bold" style={{ color: G.fg }} numberOfLines={1}>{budget.name}</AppText>
            <AppText variant="caption" style={{ color: G.fgSecondary, marginTop: 2 }}>
              {budget.type} · {budget.period} · {formatBudgetPeriod(budget, calendarType, language)}
              {budget.endDate ? ` · ${t('budget.ends_on')} ${formatDate(new Date(budget.endDate), calendarType, language)}` : ""}
            </AppText>
          </View>
          {expired ? (
            <StatusBadge status="over" />
          ) : (
            <StatusBadge status={pct >= 100 ? "exceeded" : pct >= 80 ? "near" : "within"} />
          )}
        </View>
        <View style={[s.catBar, { backgroundColor: G.border, marginTop: 12 }]}>
          <View style={[s.catBarFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }]} />
        </View>
        <View style={s.budgetCardFooter}>
          <AppNumber value={budget.totalActual} size="body" prefix={`${t('common.etb')} `} />
          <AppNumber value={budget.totalPlanned} size="body" prefix={`${t('common.etb')} `} />
        </View>
      </TouchableOpacity>
    );
  };

  const summary = dashboard || {};
  const activeBudgets = summary.activeBudgets || [];
  const selectedBudgetFromDashboard = selectedBudgetId && activeBudgets.length === 1 ? activeBudgets[0] : null;
  const totalBudget = summary.totalBudget || 0;
  const totalSpent = summary.totalSpent || 0;
  const remaining = totalBudget - totalSpent;
  const progressPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  return (
    <View style={[s.screen, { backgroundColor: G.bg }]}>
      {/* Ambient glow washes */}
      <View style={{ position: 'absolute', top: -120, left: -100, width: 320, height: 320, borderRadius: 160, backgroundColor: 'rgba(255,255,255,0.03)' }} />
      <View style={{ position: 'absolute', top: 180, right: -80, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(255,255,255,0.02)' }} />
      <View style={{ position: 'absolute', bottom: 160, left: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.025)' }} />
      <TutorialScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <TutorialTarget id="bud-header">
        <View style={s.topBar}>
          <TouchableOpacity onPress={openSidebar} activeOpacity={0.7} style={[s.avatarBox, { borderColor: G.border }]}>
            <Image source={userProfile.avatarUri ? { uri: userProfile.avatarUri } : PROFILE_IMAGES[userProfile.avatarIndex >= 0 ? userProfile.avatarIndex : 0]} style={s.avatar} />
            <View style={[s.onlineIndicator, { backgroundColor: G.fg, borderColor: G.bg }]} />
          </TouchableOpacity>
          <AppText variant="heading" weight="bold">{t("budget.title")}</AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TutorialButton tutorialId="budget" screenName={t('screen.budget')} />
            <NotificationBell size={22} count={notifCount} />
          </View>
        </View>
        </TutorialTarget>

        {/* Budget Switcher */}
        <Animated.View entering={FadeInDown.duration(500)} style={s.budgetSwitcher}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 24, paddingBottom: 12 }}>
            <TouchableOpacity
              style={[s.switcherChip, { backgroundColor: selectedBudgetId === null ? G.fg : G.bgCard, borderColor: G.border }]}
              onPress={() => handleSwitchBudget(null)}
            >
              <AppText variant="body-sm" weight="bold" style={[s.switcherChipText, { color: selectedBudgetId === null ? G.bg : G.fg }]} numberOfLines={1}>
                {t('budget.all_budgets')}
              </AppText>
            </TouchableOpacity>
            {allBudgets.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={[s.switcherChip, {
                  backgroundColor: selectedBudgetId === b.id ? G.fg : G.bgCard,
                  borderColor: selectedBudgetId === b.id ? G.fg : G.border,
                }]}
                onPress={() => handleSwitchBudget(b.id)}
              >
                <AppText variant="body-sm" weight="bold" style={[s.switcherChipText, { color: selectedBudgetId === b.id ? G.bg : G.fg }]} numberOfLines={1}>
                  {b.name}
                </AppText>
                <AppText variant="micro" style={{ color: selectedBudgetId === b.id ? G.bg + 'CC' : G.fgSecondary, marginLeft: 4 }} numberOfLines={1}>
                  {b.type}
                </AppText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>

        {/* Budget Summary Card */}
        <TutorialTarget id="bud-overview">
        <Animated.View entering={FadeInDown.duration(600)} style={[s.summaryCard, { backgroundColor: G.bgCard, borderColor: G.border }]}>
          <View style={s.summaryTop}>
            <View style={{ flex: 1, marginRight: 16 }}>
              <AppText variant="caption" weight="bold" transform="uppercase" style={[s.summaryLabel, { color: G.fgSecondary }]}>
                {selectedBudgetId ? t("budget.budget_summary") : t("budget.all_budgets")}
              </AppText>
              <AppText variant="title" weight="bold" style={[s.summaryTitle, { color: G.fg }]} numberOfLines={1}>
                {selectedBudgetFromDashboard?.name || monthSummary?.budgetName || (selectedBudgetId ? t("budget.title") : t("budget.all_budgets"))}
              </AppText>
            </View>
            <ProgressRing progress={progressPct} />
          </View>

          <View style={[s.statsRow, { borderTopColor: G.border }]}>
            <View style={[s.stat, { borderRightWidth: 1, borderRightColor: G.border }]}>
              <AppNumber value={totalBudget} size="heading-lg" prefix={`${t('common.etb')} `} />
              <AppText variant="micro" style={{ color: G.fgSecondary, marginTop: 2 }}>{t("budget.total_budget")}</AppText>
            </View>
            <View style={[s.stat, { borderRightWidth: 1, borderRightColor: G.border }]}>
              <AppNumber value={totalSpent} size="heading-lg" prefix={`${t('common.etb')} `} />
              <AppText variant="micro" style={{ color: G.fgSecondary, marginTop: 2 }}>{t("budget.total_spent")}</AppText>
            </View>
            <View style={s.stat}>
              <AppNumber value={remaining} size="heading-lg" prefix={`${t('common.etb')} `} />
              <AppText variant="micro" style={{ color: G.fgSecondary, marginTop: 2 }}>{t("budget.remaining")}</AppText>
            </View>
          </View>

          <View style={[s.progressBar, { backgroundColor: G.border, marginTop: 16 }]}>
            <View style={[s.progressFill, {
              width: `${Math.min(progressPct, 100)}%`,
              backgroundColor: progressPct >= 100 ? colors.error : progressPct >= 80 ? colors.warning : colors.success
            }]} />
          </View>
        </Animated.View>
        </TutorialTarget>

        {/* Budget Alerts */}
        {alerts.length > 0 && (
          <Animated.View entering={FadeInDown.duration(600).delay(100)} style={s.alertsSection}>
            <AppText variant="caption" weight="bold" transform="uppercase" style={[s.sectionTitle, { color: G.fgSecondary }]}>
              {t("budget.alerts")}
            </AppText>
            {(selectedBudgetId ? alerts.filter((a: any) => a.budgetId === selectedBudgetId) : alerts).slice(0, 5).map((alert: any) => (
              <TouchableOpacity
                key={alert.id}
                style={[s.alertItem, { backgroundColor: G.bgCard, borderColor: alert.isExceeded ? colors.error + "30" : colors.warning + "30" }]}
                onPress={() => handleCategoryPress(alert.category)}
              >
                <AlertTriangle size={16} color={alert.isExceeded ? colors.error : colors.warning} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <AppText variant="body-sm" weight="bold" style={{ color: G.fg }}>{alert.category}</AppText>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
                    <AppNumber value={alert.percentUsed} size="caption" suffix="%" />
                    <AppText variant="caption" style={{ color: G.fgSecondary }}>{t('budget.used_separator')}</AppText>
                    <AppNumber value={alert.spent} size="body-sm" prefix={`${t('common.etb')} `} />
                    <AppText variant="caption" style={{ color: G.fgSecondary }}>{' / '}</AppText>
                    <AppNumber value={alert.plannedAmount} size="body" prefix={`${t('common.etb')} `} />
                  </View>
                </View>
                <View style={[s.alertBadge, { backgroundColor: (alert.isExceeded ? colors.error : colors.warning) + "20" }]}>
                  {alert.isExceeded ? (
                    <AppText variant="micro" weight="bold" style={{ color: alert.isExceeded ? colors.error : colors.warning }}>{t('budget.exceeded_label')}</AppText>
                  ) : (
                    <AppNumber value={alert.percentUsed} size="body-sm" suffix="%" color={colors.warning} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </Animated.View>
        )}

        {/* Monthly Categories */}
        <TutorialTarget id="bud-categories">
        <Animated.View entering={FadeInDown.duration(600).delay(200)} style={s.categoriesSection}>
          <AppText variant="caption" weight="bold" transform="uppercase" style={[s.sectionTitle, { color: G.fgSecondary }]}>
            {t("budget.categories")}
          </AppText>

          {monthSummary?.byCategory?.length > 0 ? (
            monthSummary.byCategory.map((cat: any, i: number) => {
              const planned = cat.planned || 0;
              const spent = cat.spent || 0;
              const hasAllocation = planned > 0;
              const pct = hasAllocation ? Math.min(100, Math.round((spent / planned) * 100)) : 0;
              const status = !hasAllocation
                ? (spent > 0 ? "no_budget" : "ok")
                : pct >= 100 ? "exceeded" : pct >= 80 ? "warning" : "ok";
              return (
                <TouchableOpacity key={cat.name + i} style={[s.catCard, { backgroundColor: G.bgCard, borderColor: G.border }]}
                  onPress={() => handleCategoryPress(cat.name)}>
                  <View style={s.catRow}>
                    <AppText variant="body" weight="bold" style={{ color: G.fg, flex: 1 }} numberOfLines={1}>{cat.name}</AppText>
                    <StatusBadge status={status} />
                  </View>
                  <View style={[s.catBar, { backgroundColor: G.border }]}>
                    <View style={[s.catBarFill, {
                      width: `${Math.min(pct, 100)}%`,
                      backgroundColor: status === "exceeded" ? colors.error : status === "warning" || status === "no_budget" ? colors.warning : colors.success
                    }]} />
                  </View>
                  <View style={s.catFooter}>
                    <View style={s.catSpendRow}>
                      <AppText variant="caption" weight="bold" style={{ color: G.fgSecondary, marginRight: 4 }}>{t('budget.spent_of')}:</AppText>
                      <AppNumber value={spent} size="body" prefix={`${t('common.etb')} `} />
                      {hasAllocation ? (
                        <>
                          <AppText variant="caption" style={{ color: G.fgSecondary, marginHorizontal: 4 }}>{t('budget.of_label')}</AppText>
                          <AppNumber value={planned} size="body" prefix={`${t('common.etb')} `} />
                        </>
                      ) : null}
                    </View>
                    {hasAllocation ? <AppNumber value={pct} size="caption" suffix="%" /> : null}
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={s.emptyState}>
              <DollarSign size={48} color={G.border} />
              <AppText variant="body" weight="bold" style={{ color: G.fgSecondary, marginTop: 12, textAlign: "center" }}>
                {totalBudget > 0 ? t('budget.no_expenses_linked') : t('budget.no_budget_set')}
              </AppText>
              <TouchableOpacity style={[s.createBtn, { backgroundColor: G.fg, marginTop: 16 }]} onPress={() => setShowCreateModal(true)}>
                <Plus size={20} color={G.bg} />
                <AppText variant="body" weight="bold" style={{ color: G.bg, marginLeft: 8 }}>{t('budget.create')}</AppText>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
        </TutorialTarget>

        {/* Budget Lifecycle Sections */}
        <TutorialTarget id="bud-trends">
        <Animated.View entering={FadeInDown.duration(600).delay(300)} style={s.budgetsSection}>
          {lifecycleSections.map((section) =>
            section.items.length > 0 ? (
              <View key={section.key} style={{ marginBottom: 20 }}>
                <View style={s.sectionHeaderRow}>
                  <AppText variant="caption" weight="bold" transform="uppercase" style={[s.sectionTitle, { color: G.fgSecondary }]}>
                    {section.label}
                  </AppText>
                  <AppText variant="micro" style={{ color: G.fgSecondary }}>({section.items.length})</AppText>
                </View>
                {section.items.map((b: any) => renderBudgetCard(b))}
              </View>
            ) : null
          )}
          {lifecycle.active.length === 0 && lifecycle.expiringSoon.length === 0 && lifecycle.expired.length === 0 && lifecycle.archived.length === 0 && (
            <View style={s.emptyState}>
              <DollarSign size={48} color={G.border} />
              <AppText variant="body" weight="bold" style={{ color: G.fgSecondary, marginTop: 12, textAlign: "center" }}>
                {t('budget.no_budgets')}
              </AppText>
            </View>
          )}
        </Animated.View>
        </TutorialTarget>



        <View style={{ height: 120 }} />
      </TutorialScrollView>

      {/* FAB */}
      <TutorialTarget id="bud-create-btn">
      <Animated.View style={[s.fabRow, hideFABStyle]}>
        <TouchableOpacity style={[s.fab, { backgroundColor: G.fg, shadowColor: G.fg }]} onPress={() => setShowCreateModal(true)} activeOpacity={0.8}>
          <Plus size={28} color={G.bg} />
        </TouchableOpacity>
      </Animated.View>
      </TutorialTarget>

      {/* Create Budget Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide" onRequestClose={() => setShowCreateModal(false)}>
        <View style={s.modalOverlay}>
          <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setShowCreateModal(false)} />
          <CreateBudgetModal
            colors={colors}
            t={t}
            onClose={() => setShowCreateModal(false)}
            onSaved={() => { setShowCreateModal(false); loadData(); }}
          />
        </View>
      </Modal>

      {/* Budget Detail Modal */}
      <Modal visible={showDetailModal} transparent animationType="slide" onRequestClose={() => setShowDetailModal(false)}>
        <View style={s.modalOverlay}>
          <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setShowDetailModal(false)} />
          <View style={[s.detailSheet, { backgroundColor: G.bg }]}>
            <View style={s.modalHeader}>
              <View style={[s.modalHandle, { backgroundColor: G.border }]} />
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }} style={{ flex: 1, paddingHorizontal: 24 }}>
              {selectedBudget && (
                <>
                  <View style={s.detailHeader}>
                    <AppText variant="title" weight="bold" style={{ color: G.fg, flex: 1 }} numberOfLines={1}>{selectedBudget.name}</AppText>
                    {!(selectedBudget.status === 'expired' || selectedBudget.status === 'archived' || selectedBudget.status === 'closed') ? (
                      <TouchableOpacity onPress={() => handleDeleteBudget(selectedBudget.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <X size={24} color={G.fgSecondary} />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <View style={[s.statsRow, { marginVertical: 20 }]}>
                    <View style={[s.stat, { borderRightWidth: 1, borderRightColor: G.border }]}>
                      <AppNumber value={selectedBudget.totalSpent} size="heading-lg" prefix={`${t('common.etb')} `} />
                      <AppText variant="micro" style={{ color: G.fgSecondary, marginTop: 2 }}>{t('budget.total_spent')}</AppText>
                    </View>
                    <View style={[s.stat, { borderRightWidth: 1, borderRightColor: G.border }]}>
                      <AppNumber value={selectedBudget.totalPlanned} size="heading-lg" prefix={`${t('common.etb')} `} />
                      <AppText variant="micro" style={{ color: G.fgSecondary, marginTop: 2 }}>{t('budget.planned')}</AppText>
                    </View>
                    <View style={s.stat}>
                      <AppNumber value={selectedBudget.remaining} size="heading-lg" prefix={`${t('common.etb')} `} />
                      <AppText variant="micro" style={{ color: G.fgSecondary, marginTop: 2 }}>{t('budget.remaining')}</AppText>
                    </View>
                  </View>

                  <View style={[s.progressBar, { backgroundColor: G.border }]}>
                    <View style={[s.progressFill, {
                      width: `${Math.min(selectedBudget.percentUsed || 0, 100)}%`,
                      backgroundColor: (selectedBudget.percentUsed || 0) >= 100 ? colors.error : (selectedBudget.percentUsed || 0) >= 80 ? colors.warning : colors.success
                    }]} />
                  </View>

                  <AppText variant="caption" weight="bold" transform="uppercase" style={[s.sectionTitle, { color: G.fgSecondary, marginTop: 24 }]}>
                    {t('budget.categories')}
                  </AppText>
                  {selectedBudget.categories?.map((cat: any, i: number) => {
                    const planned = cat.plannedAmount || 0;
                    const spent = cat.spent || 0;
                    const hasAllocation = planned > 0;
                    const pct = hasAllocation ? Math.min(100, Math.round((spent / planned) * 100)) : 0;
                    const catRemaining = planned - spent;
                    const catStatus = !hasAllocation
                      ? (spent > 0 ? "no_budget" : "ok")
                      : pct >= 100 ? "exceeded" : pct >= 80 ? "warning" : "ok";
                    return (
                      <TouchableOpacity key={cat.id || i} style={[s.catCard, { backgroundColor: G.bgCard, borderColor: G.border }]}
                        onPress={() => handleCategoryPress(cat.category)}>
                        <View style={s.catRow}>
                          <AppText variant="body" weight="bold" style={{ color: G.fg, flex: 1 }} numberOfLines={1}>{cat.category}</AppText>
                          <StatusBadge status={catStatus} />
                        </View>
                        <View style={[s.catBar, { backgroundColor: G.border }]}>
                          <View style={[s.catBarFill, {
                            width: `${Math.min(pct, 100)}%`,
                            backgroundColor: catStatus === "exceeded" ? colors.error : catStatus === "warning" || catStatus === "no_budget" ? colors.warning : colors.success
                          }]} />
                        </View>
                        <View style={s.catFooter}>
                          <View style={s.catSpendRow}>
                            <AppText variant="caption" weight="bold" style={{ color: G.fgSecondary, marginRight: 4 }}>{t('budget.spent_of')}:</AppText>
                            <AppNumber value={spent} size="body" prefix={`${t('common.etb')} `} />
                            {hasAllocation ? (
                              <>
                                <AppText variant="caption" style={{ color: G.fgSecondary, marginHorizontal: 4 }}>{t('budget.of_label')}</AppText>
                                <AppNumber value={planned} size="body" prefix={`${t('common.etb')} `} />
                              </>
                            ) : null}
                          </View>
                          {hasAllocation ? (
                            catRemaining >= 0 ? (
                              <AppNumber value={catRemaining} size="body" suffix={` ${t('budget.left_label')}`} />
                            ) : (
                              <AppNumber value={Math.abs(catRemaining)} size="body" suffix={` ${t('budget.over_label')}`} negative />
                            )
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })}

                  {(() => {
                    const isHistoric = selectedBudget.status === 'expired' || selectedBudget.status === 'archived' || selectedBudget.status === 'closed';
                    if (!isHistoric) return null;
                    return (
                      <View style={[s.historicBanner, { backgroundColor: colors.warning + '18', borderColor: colors.warning + '40' }]}>
                        <AlertTriangle size={18} color={colors.warning} />
                        <AppText variant="body-sm" weight="bold" style={{ color: G.fg, flex: 1, marginLeft: 10 }}>
                          {selectedBudget.status === 'expired'
                            ? (t('budget.expired_review') || 'This budget has expired. Renew it or create a new budget to keep tracking expenses.')
                            : (t('budget.archived_review') || 'This budget has been archived. Its history stays saved.')}
                        </AppText>
                      </View>
                    );
                  })()}

                  {(() => {
                    const isHistoric = selectedBudget.status === 'expired' || selectedBudget.status === 'archived' || selectedBudget.status === 'closed';
                    const stats = isHistoric ? selectedBudget.finalStats : null;
                    if (!stats) return null;
                    return (
                      <View style={[s.finalStatsCard, { backgroundColor: G.bgCard, borderColor: G.border, marginTop: 16 }]}>
                        <AppText variant="caption" weight="bold" transform="uppercase" style={[s.sectionTitle, { color: G.fgSecondary }]}>
                          {t('budget.final_stats') || 'Final Stats'}
                        </AppText>
                        <View style={s.finalStatsRow}>
                          <View style={[s.finalStat, { borderRightWidth: 1, borderRightColor: G.border }]}>
                            <AppText variant="caption" style={{ color: G.fgSecondary }}>{t('budget.total_budget')}</AppText>
                            <AppNumber value={stats.totalPlanned} size="body" prefix={`${t('common.etb')} `} />
                          </View>
                          <View style={[s.finalStat, { borderRightWidth: 1, borderRightColor: G.border }]}>
                            <AppText variant="caption" style={{ color: G.fgSecondary }}>{t('budget.total_spent')}</AppText>
                            <AppNumber value={stats.totalSpent} size="body" prefix={`${t('common.etb')} `} />
                          </View>
                          <View style={s.finalStat}>
                            <AppText variant="caption" style={{ color: G.fgSecondary }}>{t('budget.remaining')}</AppText>
                            <AppNumber value={stats.remaining} size="body" prefix={`${t('common.etb')} `} negative={stats.remaining < 0} />
                          </View>
                        </View>
                        <View style={[s.finalStatsRow, { marginTop: 12 }]}>
                          <View style={[s.finalStat, { borderRightWidth: 1, borderRightColor: G.border }]}>
                            <AppText variant="caption" style={{ color: G.fgSecondary }}>{t('budget.percent_used')}</AppText>
                            <AppNumber value={stats.percentUsed} size="body" suffix="%" />
                          </View>
                          <View style={s.finalStat}>
                            <AppText variant="caption" style={{ color: G.fgSecondary }}>{t('budget.expense_count') || 'Expenses'}</AppText>
                            <AppNumber value={stats.expenseCount} size="body" />
                          </View>
                        </View>
                      </View>
                    );
                  })()}

                                    {(() => {
                    const over = selectedBudget.overage;
                    const isOverNow = selectedBudget.remaining < 0;
                    if (!over || (!over.stats && !over.history?.length && !isOverNow)) return null;
                    return (
                      <View style={[s.overageCard, { backgroundColor: G.bgCard, borderColor: colors.error + '40', marginTop: 16 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                          <AlertTriangle size={16} color={colors.error} />
                          <AppText variant="caption" weight="bold" transform="uppercase" style={[s.sectionTitle, { color: colors.error, marginBottom: 0, marginLeft: 8, flex: 1 }]}>
                            {t('budget.over_budget_analytics')}
                          </AppText>
                        </View>
                        {isOverNow && (
                          <View style={[s.overageBanner, { backgroundColor: colors.error + '15' }]}>
                            <AppText variant="body-sm" weight="bold" style={{ color: colors.error, flex: 1 }}>
                              {t('budget.currently_over', { amount: Math.abs(selectedBudget.remaining).toLocaleString() })}
                            </AppText>
                          </View>
                        )}
                        <View style={s.overageStatsRow}>
                          <View style={[s.overageStat, { borderRightWidth: 1, borderRightColor: G.border }]}>
                            <AppNumber value={over.stats?.overageCount || 0} size="heading" color={colors.error} />
                            <AppText variant="micro" style={{ color: G.fgSecondary, marginTop: 2, textAlign: 'center' }}>{t('budget.times_exceeded')}</AppText>
                          </View>
                          <View style={[s.overageStat, { borderRightWidth: 1, borderRightColor: G.border }]}>
                            <AppNumber value={over.stats?.totalOverAmount || 0} size="heading" prefix={`${t('common.etb')} `} color={colors.error} />
                            <AppText variant="micro" style={{ color: G.fgSecondary, marginTop: 2, textAlign: 'center' }}>{t('budget.total_over')}</AppText>
                          </View>
                          <View style={s.overageStat}>
                            <AppNumber value={over.stats?.percentOver || 0} size="heading" suffix="%" color={colors.error} />
                            <AppText variant="micro" style={{ color: G.fgSecondary, marginTop: 2, textAlign: 'center' }}>{t('budget.percent_over')}</AppText>
                          </View>
                        </View>
                        {over.history?.length > 0 && (
                          <>
                            <AppText variant="caption" weight="bold" transform="uppercase" style={[s.sectionTitle, { color: G.fgSecondary, marginTop: 16 }]}>
                              {t('budget.over_budget_history')}
                            </AppText>
                            {over.history.map((ev: any, i: number) => (
                              <View key={ev.id || i} style={[s.overageHistoryRow, { borderBottomColor: G.border }]}>
                                <View style={{ flex: 1, marginRight: 10 }}>
                                  <AppText variant="body-sm" weight="bold" style={{ color: G.fg }} numberOfLines={1}>{ev.expenseName || t('expense.transactions')}</AppText>
                                  <AppText variant="micro" style={{ color: G.fgSecondary }}>{formatDate(new Date(ev.createdAt || ''), calendarType, language)}</AppText>
                                </View>
                                <AppNumber value={ev.amount} size="body-sm" prefix={`${t('common.etb')} `} />
                                <View style={{ marginLeft: 12 }}>
                                  <AppNumber value={ev.overAmount} size="body-sm" prefix={`${t('budget.over_label')} ${t('common.etb')} `} negative />
                                </View>
                              </View>
                            ))}
                          </>
                        )}
                      </View>
                    );
                  })()}

                  <View style={s.actionRow}>
                    <TouchableOpacity
                      style={[s.actionBtn, { backgroundColor: G.fg, marginRight: 8 }]}
                      onPress={() => { setShowDetailModal(false); setShowCreateModal(true); }}
                    >
                      <Plus size={16} color={G.bg} />
                      <AppText variant="body-sm" weight="bold" style={{ color: G.bg, marginLeft: 6 }}>{t('budget.create_new') || 'Create New'}</AppText>
                    </TouchableOpacity>
                    {selectedBudget.status !== 'archived' && (
                      <TouchableOpacity
                        style={[s.actionBtn, { backgroundColor: colors.success, marginRight: 8 }]}
                        onPress={() => handleRenewBudget(selectedBudget)}
                      >
                        <AppText variant="body-sm" weight="bold" style={{ color: '#ffffff' }}>{t('budget.renew') || 'Renew'}</AppText>
                      </TouchableOpacity>
                    )}
                    {selectedBudget.status !== 'archived' && (
                      <TouchableOpacity
                        style={[s.actionBtn, { backgroundColor: G.bgCard, borderWidth: 1, borderColor: G.border }]}
                        onPress={() => handleArchiveBudget(selectedBudget)}
                      >
                        <AppText variant="body-sm" weight="bold" style={{ color: G.fgSecondary }}>{t('budget.archive') || 'Archive'}</AppText>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const PERIOD_OPTIONS = ["daily", "weekly", "monthly", "quarterly", "yearly"] as const;

const CreateBudgetModal = ({ colors, t, onClose, onSaved }: { colors: any; t: any; onClose: () => void; onSaved: () => void }) => {
  const G = getBudgetGlass(colors);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState<typeof PERIOD_OPTIONS[number]>("monthly");
  const [showAdvancedPeriod, setShowAdvancedPeriod] = useState(false);
  const dialog = useDialog();
  const cbTutorial = useTutorial({ tutorial: createBudgetTutorial });
  useTutorialExample('cb-name', setName);
  useTutorialExample('cb-amount', setAmount);

  const defaultPeriods = ["monthly"] as const;
  const advancedPeriods = ["weekly", "quarterly", "yearly"] as const;

  const draftFormKey = 'budget';
  const draftFormData = useFormDrafts({
    screen: 'budget',
    formKey: draftFormKey,
    getPayload: useCallback(() => ({
      name,
      amount,
      period,
    }), [name, amount, period]),
    getTitle: useCallback(() => (name ? `${t('budget.draft_prefix')} - ${name}` : t('budget.draft_title')), [name, t]),
    getSubtitle: useCallback(() => (amount ? `${t('common.etb')} ${amount}` : t('budget.period') || 'Period'), [amount, t]),
    enabled: true,
  });

  const handleSave = async () => {
    if (!name.trim()) {
      await dialog.alert({ title: t('common.error'), message: t('budget.enter_name'), iconType: "warning" });
      return;
    }
    const amountNum = parseFloat(amount.replace(/,/g, ''));
    if (!amountNum || amountNum <= 0) {
      await dialog.alert({ title: t('common.error'), message: t('budget.enter_amount') || 'Please enter a valid budget amount', iconType: "warning" });
      return;
    }
    const now = new Date();
    const budgetId = insertBudget({
      name: name.trim(),
      type: 'business',
      period,
      year: now.getFullYear(),
      month: period === "monthly" || period === "quarterly" ? now.getMonth() + 1 : undefined,
      plannedAmount: amountNum,
    });
    if (!budgetId) { await dialog.alert({ title: t('common.error'), message: t('budget.create_failed'), iconType: "danger" }); return; }

    notifyBudgetCreated({
      id: budgetId as number,
      name: name.trim(),
      period,
      year: now.getFullYear(),
      month: period === "monthly" || period === "quarterly" ? now.getMonth() + 1 : undefined,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playNice();
    await draftFormData.clearCurrent();
    onSaved();
  };

  return (
    <View style={[s.createSheet, { backgroundColor: G.bg }]}>
      <View style={s.modalHeader}>
        <View style={[s.modalHandle, { backgroundColor: G.border }]} />
        <TouchableOpacity onPress={onClose} style={{ position: "absolute", right: 24, top: 10 }}>
          <X size={24} color={G.fgSecondary} />
        </TouchableOpacity>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, paddingHorizontal: 24 }}>
        {draftFormData.showDrafts && (
          <DraftSection
            drafts={draftFormData.drafts}
            onRestore={async (draft) => {
              const d = draft.data;
              setName(d.name || '');
              setAmount(d.amount || '');
              setPeriod(d.period || 'monthly');
              await draftFormData.remove(draft.id);
            }}
            onDelete={async (id) => {
              await draftFormData.remove(id);
            }}
          />
        )}
        <TutorialTarget id="cb-header">
          <AppText variant="title" weight="bold" style={{ color: G.fg, marginBottom: 4 }}>{t('budget.create')}</AppText>
          <AppText variant="body-sm" style={{ color: G.fgSecondary, marginBottom: 24 }}>{t('budget.set_spending_plan')}</AppText>
        </TutorialTarget>

        <TutorialTarget id="cb-name">
          <TextInput
            style={[s.input, { color: G.fg, borderColor: G.border, backgroundColor: G.bgCard }]}
            placeholder={t('budget.name_placeholder')}
            placeholderTextColor={G.fgSecondary}
            value={name}
            onChangeText={setName}
          />
        </TutorialTarget>

        <TutorialTarget id="cb-amount">
          <AppText variant="caption" weight="bold" transform="uppercase" style={[s.sectionTitle, { color: G.fgSecondary, marginTop: 20, marginBottom: 10 }]}>
            {t('budget.total_amount')} ({t('common.etb')})
          </AppText>
          <TextInput
            style={[s.input, { color: G.fg, borderColor: G.border, backgroundColor: G.bgCard }]}
            placeholder="e.g. 50,000"
            placeholderTextColor={G.fgSecondary}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
          />
        </TutorialTarget>

        <TutorialTarget id="cb-period">
          <AppText variant="caption" weight="bold" transform="uppercase" style={[s.sectionTitle, { color: G.fgSecondary, marginTop: 20, marginBottom: 10 }]}>{t('budget.period_label')}</AppText>
          <View style={s.chipRow}>
            {defaultPeriods.map(p => (
              <TouchableOpacity key={p}
                style={[s.chip, { backgroundColor: G.bgCard, borderColor: G.border }, period === p && { backgroundColor: G.fg }]}
                onPress={() => { setPeriod(p); Haptics.selectionAsync(); }}
              >
                <AppText variant="body-sm" weight="bold" style={{ color: period === p ? G.bg : G.fg, textTransform: "capitalize" }}>{t(`budget.${p}`)}</AppText>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}
            onPress={() => { setShowAdvancedPeriod(!showAdvancedPeriod); Haptics.selectionAsync(); }}
          >
            <AppText variant="caption" weight="bold" style={{ color: G.fgSecondary }}>
              {showAdvancedPeriod ? t('common.hide') || 'Hide' : t('common.advanced') || 'Advanced'}
            </AppText>
          </TouchableOpacity>
          {showAdvancedPeriod && (
            <View style={[s.chipRow, { marginTop: 8 }]}>
              {advancedPeriods.map(p => (
                <TouchableOpacity key={p}
                  style={[s.chip, { backgroundColor: G.bgCard, borderColor: G.border }, period === p && { backgroundColor: G.fg }]}
                  onPress={() => { setPeriod(p); Haptics.selectionAsync(); }}
                >
                  <AppText variant="body-sm" weight="bold" style={{ color: period === p ? G.bg : G.fg, textTransform: "capitalize" }}>{t(`budget.${p}`)}</AppText>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </TutorialTarget>

        <TutorialTarget id="cb-commit-btn">
          <TouchableOpacity style={[s.saveBtn, { backgroundColor: G.fg, marginTop: 24, marginBottom: 40 }]} onPress={handleSave}>
            <AppText variant="body" weight="bold" style={{ color: G.bg }}>{t('budget.create')}</AppText>
          </TouchableOpacity>
        </TutorialTarget>
        <TutorialButton tutorialId="create-budget" screenName={t('screen.create_budget')} />
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { paddingBottom: 160, paddingTop: 10 },
  topBar: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  avatarBox: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, padding: 2, justifyContent: "center", alignItems: "center", position: "relative" },
  avatar: { width: "100%", height: "100%", borderRadius: 18 },
  onlineIndicator: { position: "absolute", bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  summaryCard: { marginHorizontal: 24, marginTop: 15, borderRadius: 28, padding: 24, borderWidth: 1, overflow: "hidden" },
  summaryTop: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  summaryLabel: { fontSize: 11, letterSpacing: 1.5, marginBottom: 4 },
  summaryTitle: { fontSize: 24, fontFamily: Fonts.bold, letterSpacing: -0.5 },
  statsRow: { flexDirection: "row", flexWrap: "wrap", paddingTop: 16, borderTopWidth: 1 },
  stat: { minWidth: 120, alignItems: "center", paddingVertical: 8 },
  progressBar: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  alertsSection: { marginHorizontal: 24, marginTop: 24 },
  sectionTitle: { fontSize: 11, letterSpacing: 1.5, marginBottom: 12 },
  alertItem: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 8, overflow: "hidden" },
  alertBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  categoriesSection: { marginHorizontal: 24, marginTop: 24 },
  catCard: { borderRadius: 18, padding: 18, borderWidth: 1, marginBottom: 10, overflow: "hidden" },
  catRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  catBar: { height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 8 },
  catBarFill: { height: "100%", borderRadius: 3 },
  catFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  catSpendRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  budgetsSection: { marginHorizontal: 24, marginTop: 24 },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  budgetCard: { borderRadius: 18, padding: 18, borderWidth: 1, marginBottom: 10, overflow: "hidden" },
  budgetCardHeader: { flexDirection: "row", alignItems: "flex-start" },
  budgetCardFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  historicBanner: { flexDirection: "row", alignItems: "center", borderRadius: 16, borderWidth: 1, padding: 16, marginTop: 16 },
  finalStatsCard: { borderRadius: 18, padding: 18, borderWidth: 1 },
  finalStatsRow: { flexDirection: "row", flexWrap: "wrap" },
  finalStat: { minWidth: 110, paddingVertical: 6, paddingRight: 12 },
  overageCard: { borderRadius: 18, padding: 18, borderWidth: 1 },
  overageBanner: { flexDirection: "row", alignItems: "center", borderRadius: 12, padding: 12, marginBottom: 14 },
  overageStatsRow: { flexDirection: "row", flexWrap: "wrap" },
  overageStat: { minWidth: 100, flex: 1, paddingVertical: 6, paddingRight: 12 },
  overageHistoryRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 20 },
  actionBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14 },
  badge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, gap: 4 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  emptyState: { alignItems: "center", paddingVertical: 60 },
  createBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16 },
  fabRow: { position: "absolute", bottom: 100, alignSelf: "center" },
  fab: { width: 60, height: 60, borderRadius: 30, justifyContent: "center", alignItems: "center", elevation: 2, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.4)" },
  detailSheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, height: Dimensions.get("window").height * 0.90, paddingBottom: 40 },
  createSheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, height: Dimensions.get("window").height * 0.92, paddingBottom: 40 },
  modalHeader: { alignItems: "center", paddingTop: 15, paddingBottom: 10 },
  modalHandle: { width: 40, height: 4, borderRadius: 2 },
  detailHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, marginBottom: 4 },
  budgetSwitcher: { marginTop: 8 },
  switcherChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  switcherChipText: { fontSize: 13, fontFamily: Fonts.bold },
  input: { height: 52, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, fontFamily: Fonts.bold, fontSize: 16, marginBottom: 16 },
  chipRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  saveBtn: { height: 56, borderRadius: 16, justifyContent: "center", alignItems: "center" },
});

export default BudgetOverview;