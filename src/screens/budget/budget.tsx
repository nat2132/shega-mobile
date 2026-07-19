import { DraftSection } from '@/components/DraftSection';
import { NotificationBell } from '@/components/NotificationBell';
import { AppNumber, AppText } from "@/components/ui";
import { Fonts } from "@/constants/theme";
import { useDialog } from "@/context/DialogContext";
import { PROFILE_IMAGES, useSettings } from "@/context/SettingsContext";
import { useSidebar } from "@/context/SidebarContext";
import {
  deleteBudget,
  getBudgetAlerts,
  getBudgetDashboard,
  getBudgets,
  getBudgetWithCategoryProgress,
  getMonthlyBudgetSummary,
  insertBudget,
  insertBudgetCategory,
} from "@/database/db";
import { useFormDrafts } from '@/hooks/useFormDrafts';
import { useNotifications } from "@/hooks/useNotifications";
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
  const { userProfile, colors, t } = useSettings();
  const G = getBudgetGlass(colors);
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

  const loadData = useCallback(() => {
    setAllBudgets(getBudgets());
    const now = new Date();
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
      setMonthSummary(getMonthlyBudgetSummary(now.getFullYear(), now.getMonth() + 1));
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
    if (full) { setSelectedBudget(full); setShowDetailModal(true); }
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

        {/* Monthly Summary Card */}
        <TutorialTarget id="bud-overview">
        <Animated.View entering={FadeInDown.duration(600)} style={[s.summaryCard, { backgroundColor: G.bgCard, borderColor: G.border }]}>
          <View style={s.summaryTop}>
            <View style={{ flex: 1, marginRight: 16 }}>
              <AppText variant="caption" weight="bold" transform="uppercase" style={[s.summaryLabel, { color: G.fgSecondary }]}>
                {selectedBudgetId ? t("budget.budget_summary") : t("budget.monthly_summary")}
              </AppText>
              <AppText variant="title" weight="bold" style={[s.summaryTitle, { color: G.fg }]} numberOfLines={1}>
                {selectedBudgetFromDashboard?.name || (monthSummary?.budgetName || t("budget.title"))}
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
              const pct = cat.planned > 0 ? Math.round((cat.spent / cat.planned) * 100) : 0;
              const status = pct >= 100 ? "exceeded" : pct >= 80 ? "warning" : "ok";
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
                      backgroundColor: status === "exceeded" ? colors.error : status === "warning" ? colors.warning : colors.success
                    }]} />
                  </View>
                  <View style={s.catFooter}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
                      <AppNumber value={cat.spent} size="body" prefix={`${t('common.etb')} `} />
                      <AppText variant="caption" style={{ color: G.fgSecondary }}>{' / '}</AppText>
                      <AppNumber value={cat.planned} size="body" prefix={`${t('common.etb')} `} />
                    </View>
                    <AppNumber value={pct} size="caption" suffix="%" />
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

        {/* Active Budgets */}
        {summary.activeBudgets?.length > 0 && (
          <TutorialTarget id="bud-trends">
          <Animated.View entering={FadeInDown.duration(600).delay(300)} style={s.budgetsSection}>
            <AppText variant="caption" weight="bold" transform="uppercase" style={[s.sectionTitle, { color: G.fgSecondary }]}>
              {t("budget.budgets")}
            </AppText>
            {summary.activeBudgets.map((budget: any) => {
              const pct = budget.totalPlanned > 0 ? Math.round((budget.totalActual / budget.totalPlanned) * 100) : 0;
              return (
                <TouchableOpacity key={budget.id} style={[s.budgetCard, { backgroundColor: G.bgCard, borderColor: G.border }]}
                  onPress={() => handleBudgetPress(budget.id)}>
                  <View style={s.budgetCardHeader}>
                    <View style={{ flex: 1 }}>
                      <AppText variant="body" weight="bold" style={{ color: G.fg }}>{budget.name}</AppText>
                      <AppText variant="caption" style={{ color: G.fgSecondary, marginTop: 2 }}>
                        {budget.type} · {budget.period} · {budget.year}{budget.month ? `/${String(budget.month).padStart(2, '0')}` : ""}
                      </AppText>
                    </View>
                    <StatusBadge status={pct >= 100 ? "exceeded" : pct >= 80 ? "near" : "within"} />
                  </View>
                  <View style={[s.catBar, { backgroundColor: G.border, marginTop: 12 }]}>
                    <View style={[s.catBarFill, {
                      width: `${Math.min(pct, 100)}%`,
                      backgroundColor: pct >= 100 ? colors.error : pct >= 80 ? colors.warning : colors.success
                    }]} />
                  </View>
                  <View style={s.budgetCardFooter}>
                    <AppNumber value={budget.totalActual} size="body" prefix={`${t('common.etb')} `} />
                    <AppNumber value={budget.totalPlanned} size="body" prefix={`${t('common.etb')} `} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </Animated.View>
          </TutorialTarget>
        )}



        <View style={{ height: 120 }} />
      </TutorialScrollView>

      {/* FAB */}
      <TutorialTarget id="bud-create-btn">
      <View style={s.fabRow}>
        <TouchableOpacity style={[s.fab, { backgroundColor: G.fg, shadowColor: G.fg }]} onPress={() => setShowCreateModal(true)} activeOpacity={0.8}>
          <Plus size={28} color={G.bg} />
        </TouchableOpacity>
      </View>
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
                    <TouchableOpacity onPress={() => handleDeleteBudget(selectedBudget.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <X size={24} color={G.fgSecondary} />
                    </TouchableOpacity>
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
                    const pct = cat.plannedAmount > 0 ? Math.round(((cat.spent || 0) / cat.plannedAmount) * 100) : 0;
                    const catRemaining = cat.plannedAmount - (cat.spent || 0);
                    const catStatus = pct >= 100 ? "exceeded" : pct >= 80 ? "warning" : "ok";
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
                            backgroundColor: catStatus === "exceeded" ? colors.error : catStatus === "warning" ? colors.warning : colors.success
                          }]} />
                        </View>
                        <View style={s.catFooter}>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
                            <AppNumber value={cat.spent || 0} size="body" prefix={`${t('common.etb')} `} />
                            <AppText variant="caption" style={{ color: G.fgSecondary }}>{' / '}</AppText>
                            <AppNumber value={cat.plannedAmount} size="body" prefix={`${t('common.etb')} `} />
                          </View>
                          {catRemaining >= 0 ? (
                            <AppNumber value={catRemaining} size="body" suffix={` ${t('budget.left_label')}`} />
                          ) : (
                            <AppNumber value={Math.abs(catRemaining)} size="body" suffix={` ${t('budget.over_label')}`} negative />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
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
  const [type, setType] = useState("business");
  const [period, setPeriod] = useState<typeof PERIOD_OPTIONS[number]>("monthly");
  const [categories, setCategories] = useState<{ name: string; amount: string }[]>([]);
  const [customCategoryName, setCustomCategoryName] = useState("");
  const dialog = useDialog();
  const cbTutorial = useTutorial({ tutorial: createBudgetTutorial });
  useTutorialExample('cb-name', setName);

  const draftFormKey = 'budget';
  const draftFormData = useFormDrafts({
    screen: 'budget',
    formKey: draftFormKey,
    getPayload: useCallback(() => ({
      name,
      type,
      period,
      categories,
    }), [name, type, period, categories]),
    getTitle: useCallback(() => (name ? `${t('budget.draft_prefix')} - ${name}` : t('budget.draft_title')), [name, t]),
    getSubtitle: useCallback(() => `${categories.filter(c => c.amount).length} ${t('common.categories')}`, [categories, t]),
    enabled: true,
  });

  useEffect(() => {
    setCategories([]);
  }, []);

  const addCustomCategory = () => {
    const name = customCategoryName.trim();
    if (!name) return;
    if (categories.some(c => c.name === name)) return;
    setCategories([...categories, { name, amount: "" }]);
    setCustomCategoryName("");
  };

  const removeCategory = (index: number) => {
    setCategories(categories.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      await dialog.alert({ title: t('common.error'), message: t('budget.enter_name'), iconType: "warning" });
      return;
    }
    const now = new Date();
    const budgetId = insertBudget({
      name: name.trim(),
      type: type as any,
      period,
      year: now.getFullYear(),
      month: period === "monthly" || period === "quarterly" ? now.getMonth() + 1 : undefined,
    });
    if (!budgetId) { await dialog.alert({ title: t('common.error'), message: t('budget.create_failed'), iconType: "danger" }); return; }

    for (const cat of categories) {
      const amount = parseFloat(cat.amount.replace(/,/g, ""));
      if (amount > 0 || cat.amount.trim()) {
        insertBudgetCategory(budgetId, { category: cat.name, plannedAmount: amount || 0 });
      }
    }
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
              setType(d.type || 'business');
              setPeriod(d.period || 'monthly');
              setCategories(d.categories || []);
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

        <TutorialTarget id="cb-type">
          <AppText variant="caption" weight="bold" transform="uppercase" style={[s.sectionTitle, { color: G.fgSecondary, marginTop: 8, marginBottom: 10 }]}>{t('budget.type_label')}</AppText>
          <View style={s.chipRow}>
            {["business", "department", "project", "branch"].map(v => (
              <TouchableOpacity key={v}
                style={[s.chip, { backgroundColor: G.bgCard, borderColor: G.border }, type === v && { backgroundColor: G.fg }]}
                onPress={() => { setType(v); Haptics.selectionAsync(); }}
              >
                <AppText variant="body-sm" weight="bold" style={{ color: type === v ? G.bg : G.fg, textTransform: "capitalize" }}>{t(`budget.${v}`)}</AppText>
              </TouchableOpacity>
            ))}
          </View>
        </TutorialTarget>

        <TutorialTarget id="cb-period">
          <AppText variant="caption" weight="bold" transform="uppercase" style={[s.sectionTitle, { color: G.fgSecondary, marginTop: 20, marginBottom: 10 }]}>{t('budget.period_label')}</AppText>
          <View style={s.chipRow}>
            {PERIOD_OPTIONS.map(p => (
              <TouchableOpacity key={p}
                style={[s.chip, { backgroundColor: G.bgCard, borderColor: G.border }, period === p && { backgroundColor: G.fg }]}
                onPress={() => { setPeriod(p); Haptics.selectionAsync(); }}
              >
                <AppText variant="body-sm" weight="bold" style={{ color: period === p ? G.bg : G.fg, textTransform: "capitalize" }}>{t(`budget.${p}`)}</AppText>
              </TouchableOpacity>
            ))}
          </View>
        </TutorialTarget>

        <TutorialTarget id="cb-categories">
          <AppText variant="caption" weight="bold" transform="uppercase" style={[s.sectionTitle, { color: G.fgSecondary, marginTop: 20, marginBottom: 12 }]}>
            {t('budget.categories')}
          </AppText>

          {categories.map((cat, i) => (
            <View key={cat.name + i} style={s.catInputRow}>
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
                <AppText variant="body-sm" weight="bold" style={{ color: G.fg }} numberOfLines={1}>
                  {cat.name.replace(/_/g, " ")}
                </AppText>
                <TouchableOpacity onPress={() => removeCategory(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={14} color={colors.error} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={[s.amountInput, { color: G.fg, borderColor: G.border, backgroundColor: G.bgCard }]}
                placeholder="0"
                placeholderTextColor={G.fgSecondary}
                keyboardType="numeric"
                value={cat.amount}
                onChangeText={(v) => {
                  const updated = [...categories];
                  updated[i] = { ...updated[i], amount: v };
                  setCategories(updated);
                }}
              />
            </View>
          ))}

          <View style={s.addCatRow}>
            <TextInput
              style={[s.addCatInput, { color: G.fg, borderColor: G.border, backgroundColor: G.bgCard }]}
              placeholder={t('budget.custom_category')}
              placeholderTextColor={G.fgSecondary}
              value={customCategoryName}
              onChangeText={setCustomCategoryName}
              onSubmitEditing={addCustomCategory}
            />
            <TouchableOpacity style={[s.addCatBtn, { backgroundColor: G.fg }]} onPress={addCustomCategory}>
              <Plus size={18} color={G.bg} />
            </TouchableOpacity>
          </View>
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
  budgetsSection: { marginHorizontal: 24, marginTop: 24 },
  budgetCard: { borderRadius: 18, padding: 18, borderWidth: 1, marginBottom: 10, overflow: "hidden" },
  budgetCardHeader: { flexDirection: "row", alignItems: "flex-start" },
  budgetCardFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  badge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, gap: 4 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  emptyState: { alignItems: "center", paddingVertical: 60 },
  createBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16 },
  fabRow: { position: "absolute", bottom: 100, alignSelf: "center" },
  fab: { width: 60, height: 60, borderRadius: 30, justifyContent: "center", alignItems: "center", elevation: 2, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
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
  catInputRow: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 8 },
  amountInput: { width: 90, height: 44, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontFamily: Fonts.bold, fontSize: 14, textAlign: "right" },
  addCatRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  addCatInput: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontFamily: Fonts.medium, fontSize: 14 },
  addCatBtn: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  saveBtn: { height: 56, borderRadius: 16, justifyContent: "center", alignItems: "center" },
});

export default BudgetOverview;