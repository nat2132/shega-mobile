import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import {
  Calendar as CalendarIcon,
  ShieldCheck,
  Tag,
  DollarSign,
  AlertTriangle,
  Wallet,
  Repeat,
  Plus,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { playNice, playBad } from '@/services/soundService';
import {
  insertExpense,
  insertRecurringTemplate,
  autoLinkExpenseToBudget,
  getBudgetStatusForCategory,
  getBudgets,
  getBudgetCategorySpending,
  getActiveBudgetForExpenses,
  isBudgetExpired,
} from '@/database/db';
import { notifyExpenseRecorded, notifyExpensePushedBudgetOverLimit, notifyLargeExpense } from '@/services/notificationService';
import { useSettings } from '@/context/SettingsContext';
import { useDialog } from '@/context/DialogContext';
import { Fonts } from '@/constants/theme';
import { formatDate } from '@/utils/date-utils';
import BusinessSuccessModal, { BusinessSuccessDetails } from '@/components/BusinessSuccessModal';
import { CustomDatePicker } from '@/components/CustomDatePicker';
import { AppNumber, AppText } from '@/components/ui';
import { getExpenseGlass } from './glass-expense';
import { useFormDrafts } from '@/hooks/useFormDrafts';
import { DraftSection } from '@/components/DraftSection';
import { Draft } from '@/services/draftService';
import { useTutorial, useTutorialExample, TutorialTarget, TutorialButton, TutorialScrollView } from '@/tutorials';
import { expenseFormTutorial } from '@/tutorials/definitions';

const FREQUENT_CATEGORIES_KEY = 'frequent_expense_categories';

const AddExpenseScreen = ({ onSaveSuccess }: { onSaveSuccess?: () => void }) => {
  const { colors, t, calendarType, language } = useSettings();
  const G = getExpenseGlass(colors);
  const dialog = useDialog();

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [description, setDescription] = useState('');

  const [budgetStatus, setBudgetStatus] = useState<any>(null);
  const [budgetCategoryId, setBudgetCategoryId] = useState<number | null>(null);
  const [ambiguousCategories, setAmbiguousCategories] = useState<any[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [frequentCategories, setFrequentCategories] = useState<string[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState<number | null>(null);
  const [budgetCategoryNames, setBudgetCategoryNames] = useState<string[]>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurFrequency, setRecurFrequency] = useState('Monthly');
  const [recurStartDate, setRecurStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [recurEndDate, setRecurEndDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split('T')[0];
  });
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [successDetails, setSuccessDetails] = useState<BusinessSuccessDetails | null>(null);
  const [customCategoryInput, setCustomCategoryInput] = useState('');

  const draftFormKey = 'expense';
  const draftFormData = useFormDrafts({
    screen: 'expense',
    formKey: draftFormKey,
    getPayload: useCallback(() => ({
      amount,
      category,
      date,
      description,
      selectedBudgetId,
      isRecurring,
      recurFrequency,
      recurStartDate,
      recurEndDate,
    }), [amount, category, date, description, selectedBudgetId, isRecurring, recurFrequency, recurStartDate, recurEndDate]),
    getTitle: useCallback(() => (category ? t('draft.expense_title', { category }) : t('draft.expense_default')), [category, t]),
    getSubtitle: useCallback(() => (amount ? t('draft.expense_subtitle', { amount }) : t('draft.expense_no_amount')), [amount, t]),
    enabled: !successDetails,
  });

  const tutorial = useTutorial({ tutorial: expenseFormTutorial });
  useTutorialExample('ef-amount', setAmount);
  useTutorialExample('ef-description', setDescription);

  useEffect(() => {
    try {
      const stored = globalThis?.localStorage?.getItem(FREQUENT_CATEGORIES_KEY);
      if (stored) setFrequentCategories(JSON.parse(stored));
    } catch {}
    setBudgets(getBudgets({ status: 'active' }));
  }, []);

  useEffect(() => {
    const d = new Date(recurStartDate);
    switch (recurFrequency) {
      case 'Daily': d.setDate(d.getDate() + 1); break;
      case 'Weekly': d.setDate(d.getDate() + 7); break;
      case 'Monthly': d.setDate(d.getDate() + 30); break;
      case 'Yearly': d.setFullYear(d.getFullYear() + 1); break;
    }
    setRecurEndDate(d.toISOString().split('T')[0]);
  }, [recurFrequency, recurStartDate]);

  const saveFrequentCategory = (cat: string) => {
    const updated = [cat, ...frequentCategories.filter(c => c !== cat)].slice(0, 5);
    setFrequentCategories(updated);
    try {
      globalThis?.localStorage?.setItem(FREQUENT_CATEGORIES_KEY, JSON.stringify(updated));
    } catch {}
  };

  const handleBudgetSelect = (budgetId: number | null) => {
    setSelectedBudgetId(budgetId);
    Haptics.selectionAsync();
    if (budgetId) {
      const cats = getBudgetCategorySpending(budgetId);
      setBudgetCategoryNames(cats.map((c: any) => c.category));
    } else {
      setBudgetCategoryNames([]);
    }
    if (budgetId && category) {
      const result = autoLinkExpenseToBudget(category, date, budgetId);
      if (result.budgetCategoryId) {
        setBudgetCategoryId(result.budgetCategoryId);
        setAmbiguousCategories([]);
        const status = getBudgetStatusForCategory(category, date);
        setBudgetStatus(status);
      }
    } else if (!budgetId) {
      setBudgetCategoryId(null);
      setAmbiguousCategories([]);
      setBudgetStatus(null);
    }
  };

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    setShowCategoryPicker(false);
    Haptics.selectionAsync();

    const result = autoLinkExpenseToBudget(cat, date, selectedBudgetId || undefined);
    if (result.budgetCategoryId) {
      setBudgetCategoryId(result.budgetCategoryId);
      setAmbiguousCategories([]);
      const status = getBudgetStatusForCategory(cat, date);
      setBudgetStatus(status);
    } else if (result.ambiguousCategories && result.ambiguousCategories.length > 1) {
      setAmbiguousCategories(result.ambiguousCategories || []);
      setBudgetCategoryId(null);
      setBudgetStatus(null);
    } else {
      setBudgetCategoryId(null);
      setAmbiguousCategories([]);
      setBudgetStatus(null);
    }
  };

  const handleSelectAmbiguousCategory = (cat: any) => {
    setBudgetCategoryId(cat.id);
    setAmbiguousCategories([]);
    const status = getBudgetStatusForCategory(cat.category, date);
    setBudgetStatus(status);
    Haptics.selectionAsync();
  };

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    setShowDatePicker(false);
    if (category) {
      const result = autoLinkExpenseToBudget(category, newDate, selectedBudgetId || undefined);
      if (result.budgetCategoryId) {
        setBudgetCategoryId(result.budgetCategoryId);
        const status = getBudgetStatusForCategory(category, newDate);
        setBudgetStatus(status);
      }
    }
  };

  const handleSave = async () => {
    const amountNum = Number(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      playBad();
      await dialog.alert({ title: t('common.error'), message: t('expense.validation_amount') || 'Enter a valid amount', iconType: 'danger' });
      return;
    }
    if (!category.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      playBad();
      await dialog.alert({ title: t('common.error'), message: t('expense.select_category'), iconType: 'danger' });
      return;
    }

    const activeBudget = getActiveBudgetForExpenses();
    const budgetIdToCheck = selectedBudgetId ?? activeBudget?.id ?? null;
    if (budgetIdToCheck && !isRecurring && isBudgetExpired(budgetIdToCheck)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      playBad();
      await dialog.alert({
        title: t('budget.expired') || 'Budget Expired',
        message: t('budget.expired_block_message') || 'This budget has expired. Please renew it or create a new budget before recording additional expenses.',
        iconType: 'warning',
      });
      return;
    }
    if (!activeBudget && !isRecurring) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      playBad();
      await dialog.alert({ title: t('common.error'), message: t('budget.no_active_budget') || 'No active budget. Create a budget before recording expenses.', iconType: 'warning' });
      return;
    }

    saveFrequentCategory(category.trim());

    if (isRecurring) {
      insertRecurringTemplate({
        name: description.trim() || category.trim(),
        category: category.trim(),
        amount: amountNum,
        frequency: recurFrequency as any,
        startDate: recurStartDate,
        endDate: recurEndDate || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      playNice();
      await draftFormData.clearCurrent();
      setSuccessDetails({
        title: t('expense.recurring_scheduled'),
        subtitle: `${recurFrequency} Ã‚· ${formatDate(new Date(recurStartDate), calendarType, language)}`,
        mainLabel: t('expense.magnitude'),
        mainValue: `${amountNum.toLocaleString()} ${t('common.etb')}`,
        secondaryLabel: t('common.category'),
        secondaryValue: category.trim(),
        iconType: 'expense',
        itemName: description.trim() || category.trim()
      });
      return;
    }

    const expenseData: any = {
      name: description.trim() || category.trim(),
      amount: amountNum,
      category: category.trim(),
      date,
      budgetCategoryId: budgetCategoryId || undefined,
      budgetId: selectedBudgetId || activeBudget?.id || undefined,
    };

    const id = insertExpense(expenseData);
    if (id) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      playNice();
      await draftFormData.clearCurrent();
      notifyExpenseRecorded({
        id: id as number,
        name: description.trim() || category.trim(),
        amount: amountNum,
        category: category.trim(),
      });
      if (amountNum >= 50000) {
        notifyLargeExpense({
          id: id as number,
          name: description.trim() || category.trim(),
          amount: amountNum,
          category: category.trim(),
          threshold: 50000,
        });
      }
      if (category.trim()) {
        try {
          const status = getBudgetStatusForCategory(category.trim(), date);
          if (status && status.status === 'exceeded' && status.remaining < 0) {
            const budgets = getBudgets({ status: 'active' });
            const budget = (budgets as any[]).find((b: any) => status.budgetName && b.name === status.budgetName);
            notifyExpensePushedBudgetOverLimit({
              expenseId: id as number,
              expenseName: description.trim() || category.trim(),
              categoryName: category.trim(),
              budgetName: status.budgetName,
              budgetId: budget?.id || 0,
              excess: Math.abs(status.remaining),
            });
          }
        } catch {}
      }

      setSuccessDetails({
        title: t('expense.commit_success'),
        subtitle: t('expense.magnitude_logged'),
        mainLabel: t('expense.magnitude'),
        mainValue: `${amountNum.toLocaleString()} ${t('common.etb')}`,
        secondaryLabel: t('common.category'),
        secondaryValue: category.trim(),
        iconType: 'expense',
        itemName: description.trim() || category.trim()
      });
    } else {
      await dialog.alert({ title: t('common.error'), message: t('expense.failed_to_save'), iconType: 'danger' });
    }
  };

  const progressColor = !budgetStatus ? G.fgSecondary
    : budgetStatus.status === 'exceeded' ? colors.error
    : budgetStatus.status === 'critical' ? colors.warning
    : budgetStatus.status === 'warning' ? colors.warning
    : colors.success;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: G.bg }]}>
      {/* Ambient glow washes */}
      <View style={{ position: 'absolute', top: -80, left: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: G.mutedLight, opacity: 0.12 }} />
      <View style={{ position: 'absolute', bottom: -40, right: -60, width: 180, height: 180, borderRadius: 90, backgroundColor: G.mutedLight, opacity: 0.08 }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <TutorialScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {draftFormData.showDrafts && (
            <DraftSection
              drafts={draftFormData.drafts}
              onRestore={async (draft) => {
                const d = draft.data;
                setAmount(d.amount || '');
                setCategory(d.category || '');
                setDate(d.date || '');
                setDescription(d.description || '');
                setSelectedBudgetId(d.selectedBudgetId || null);
                setIsRecurring(d.isRecurring || false);
                setRecurFrequency(d.recurFrequency || 'Monthly');
                setRecurStartDate(d.recurStartDate || '');
                setRecurEndDate(d.recurEndDate || '');
                await draftFormData.remove(draft.id);
              }}
              onDelete={async (id) => {
                await draftFormData.remove(id);
              }}
            />
          )}
          <TutorialTarget id="ef-header">
            <View style={styles.header}>
              <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.headerSub, { color: G.fgSecondary }]}>
                {t('expense.capital_management')}
              </AppText>
              <AppText variant="title" weight="bold" style={[styles.headerTitle, { color: G.fg }]}>
                {t('expense.new_expense')}
              </AppText>
            </View>
          </TutorialTarget>

          {/* Amount Input */}
          <TutorialTarget id="ef-amount">
            <Animated.View entering={FadeInDown.duration(400)} style={[styles.amountCard, { backgroundColor: G.bgCard, borderColor: G.border, overflow: 'hidden' }]}>
              <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.amountLabel, { color: G.fgSecondary }]}>
                {t('expense.magnitude')}
              </AppText>
              <View style={styles.amountRow}>
                <TextInput
                  style={[styles.amountInput, { color: G.fg }]}
                  placeholder="0.00"
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={setAmount}
                  placeholderTextColor={G.border}
                  autoFocus
                />
                <AppText variant="heading" weight="bold" style={[styles.currency, { color: G.fgSecondary }]}>
                  {t('common.etb')}
                </AppText>
              </View>
            </Animated.View>
          </TutorialTarget>

          {/* Category */}
          <TutorialTarget id="ef-category">
            <Animated.View entering={FadeInDown.duration(400).delay(100)}>
              <TouchableOpacity
                style={[styles.fieldCard, { backgroundColor: G.bgCard, borderColor: G.border, overflow: 'hidden' }]}
                onPress={() => setShowCategoryPicker(!showCategoryPicker)}
              >
                <View style={styles.fieldRow}>
                  <Tag size={18} color={G.fgSecondary} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: G.fgSecondary }]}>
                      {t('common.category')}
                    </AppText>
                    <AppText variant="body" weight="bold" style={[styles.fieldValue, { color: category ? G.fg : G.fgSecondary }]}>
                      {category || t('common.select_category')}
                    </AppText>
                  </View>
                </View>
              </TouchableOpacity>

              {showCategoryPicker && (
                <Animated.View entering={FadeIn} style={styles.categoryGrid}>
                  {frequentCategories.length > 0 && (
                    <>
                      <AppText variant="caption" weight="bold" style={[styles.sectionLabel, { color: G.fgSecondary }]}>
                        {t('expense.recent')}
                      </AppText>
                      <View style={styles.chipRow}>
                        {frequentCategories.map(cat => (
                          <TouchableOpacity key={cat} style={[styles.chip, { backgroundColor: G.bgCard, borderColor: G.border }]}
                            onPress={() => handleCategoryChange(cat)}>
                            <AppText variant="body-sm" weight="bold" style={{ color: G.fg }}>{cat}</AppText>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}
                  <AppText variant="caption" weight="bold" style={[styles.sectionLabel, { color: G.fgSecondary }]}>
                    {selectedBudgetId && budgetCategoryNames.length > 0 ? `Budget: ${budgets.find((b: any) => b.id === selectedBudgetId)?.name || ''} Categories` : t('common.categories')}
                  </AppText>
                  <View style={styles.chipRow}>
                    {(selectedBudgetId && budgetCategoryNames.length > 0 ? budgetCategoryNames : DEFAULT_CATEGORY_KEYS).map(key => (
                      <TouchableOpacity key={key} style={[styles.chip, { backgroundColor: G.bgCard, borderColor: G.border }]}
                        onPress={() => handleCategoryChange(t(key))}>
                        <AppText variant="body-sm" weight="bold" style={{ color: G.fg }}>{t(key)}</AppText>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={[styles.chipRow, { marginTop: 8, alignItems: 'center' }]}>
                    <TextInput
                      style={[styles.customCatInput, { backgroundColor: G.bgCard, borderColor: G.border, color: G.fg }]}
                      placeholder={t('expense.custom_category') || 'Custom category...'}
                      placeholderTextColor={G.fgSecondary}
                      value={customCategoryInput}
                      onChangeText={setCustomCategoryInput}
                    />
                    <TouchableOpacity
                      style={[styles.addCatBtn, { backgroundColor: G.fg }]}
                      onPress={() => {
                        const trimmed = customCategoryInput.trim();
                        if (trimmed) {
                          handleCategoryChange(trimmed);
                          saveFrequentCategory(trimmed);
                          setCustomCategoryInput('');
                        }
                      }}
                    >
                      <Plus size={18} color={G.bg} strokeWidth={2.5} />
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              )}
            </Animated.View>
          </TutorialTarget>

          {/* Date */}
          <TutorialTarget id="ef-date">
            <Animated.View entering={FadeInDown.duration(400).delay(150)}>
              <TouchableOpacity
                style={[styles.fieldCard, { backgroundColor: G.bgCard, borderColor: G.border }]}
                onPress={() => setShowDatePicker(true)}
              >
                <View style={styles.fieldRow}>
                  <CalendarIcon size={18} color={G.fgSecondary} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: G.fgSecondary }]}>
                      {t('common.date')}
                    </AppText>
                    <AppText variant="body" weight="bold" style={[styles.fieldValue, { color: G.fg }]}>
                      {formatDate(new Date(date), calendarType, language)}
                    </AppText>
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          </TutorialTarget>

          {/* Description (optional) */}
          <TutorialTarget id="ef-description">
            <Animated.View entering={FadeInDown.duration(400).delay(200)}>
              <View style={[styles.fieldCard, { backgroundColor: G.bgCard, borderColor: G.border }]}>
                <TextInput
                  style={[styles.descInput, { color: G.fg }]}
                  placeholder={t('expense.desc_placeholder') || 'Description (optional)'}
                  placeholderTextColor={G.fgSecondary}
                  value={description}
                  onChangeText={setDescription}
                  maxLength={100}
                />
              </View>
            </Animated.View>
          </TutorialTarget>

          {/* Budget Selector */}
          {budgets.length > 0 && (
            <TutorialTarget id="ef-budget">
              <Animated.View entering={FadeInDown.duration(400).delay(250)}>
                <View style={[styles.fieldCard, { backgroundColor: G.bgCard, borderColor: G.border, marginBottom: 12, overflow: 'hidden' }]}>
                  <View style={styles.fieldRow}>
                    <Wallet size={18} color={G.fgSecondary} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: G.fgSecondary }]}>
                        {t('expense.budget_label')}
                      </AppText>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 8 }}>
                        <TouchableOpacity
                          style={[styles.miniChip, { backgroundColor: selectedBudgetId === null ? G.fg : G.bgCard, borderColor: G.border }]}
                          onPress={() => handleBudgetSelect(null)}
                        >
                          <AppText variant="micro" weight="bold" style={{ color: selectedBudgetId === null ? G.bg : G.fg }}>
                            {t('expense.auto')}
                          </AppText>
                        </TouchableOpacity>
                        {budgets.map((b: any) => (
                          <TouchableOpacity
                            key={b.id}
                            style={[styles.miniChip, { backgroundColor: selectedBudgetId === b.id ? G.fg : G.bgCard, borderColor: G.border }]}
                            onPress={() => handleBudgetSelect(b.id)}
                          >
                            <AppText variant="micro" weight="bold" style={{ color: selectedBudgetId === b.id ? G.bg : G.fg }}>
                              {b.name}
                            </AppText>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                </View>
              </Animated.View>
            </TutorialTarget>
          )}

          {/* Ambiguous category selection */}
          {ambiguousCategories.length > 0 && (
            <Animated.View entering={FadeIn} style={[styles.warningCard, { backgroundColor: colors.warning + '15', borderColor: colors.warning }]}>
              <AppText variant="caption" weight="bold" style={{ color: colors.warning, marginBottom: 8 }}>
                {t('expense.multiple_budget_match')}
              </AppText>
              {ambiguousCategories.map((cat: any) => (
                <TouchableOpacity key={cat.id} style={[styles.ambiguousRow, { borderBottomColor: G.border }]}
                  onPress={() => handleSelectAmbiguousCategory(cat)}>
                  <AppText variant="body-sm" weight="bold" style={{ color: G.fg }}>{cat.category}</AppText>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <AppText variant="caption" style={{ color: G.fgSecondary }}>{t('expense.budget_label')}: </AppText>
                    <AppNumber value={cat.plannedAmount} size="caption" prefix={t('common.etb') + ' '} />
                  </View>
                </TouchableOpacity>
              ))}
            </Animated.View>
          )}

          {/* Budget Status Card */}
          {budgetStatus && (
            <Animated.View entering={FadeIn} style={[styles.budgetCard, { backgroundColor: G.bgCard, borderColor: progressColor + '30', overflow: 'hidden' }]}>
              <View style={styles.budgetHeader}>
                <DollarSign size={16} color={progressColor} />
                <AppText variant="caption" weight="bold" style={[styles.budgetName, { color: G.fgSecondary }]}>
                  {budgetStatus.budgetName}
                </AppText>
                <View style={[styles.statusPill, { backgroundColor: progressColor + '20' }]}>
                  <AppText variant="micro" weight="bold" style={{ color: progressColor }}>
                    {budgetStatus.status === 'exceeded' ? t('budget.exceeded') || 'Exceeded'
                      : budgetStatus.status === 'critical' ? '90%'
                      : budgetStatus.status === 'warning' ? '80%'
                      : t('budget.on_track') || 'On Track'}
                  </AppText>
                </View>
              </View>

              <View style={styles.budgetBar}>
                <View style={[styles.budgetBarBg, { backgroundColor: G.border }]}>
                  <View style={[styles.budgetBarFill, { width: `${Math.min(budgetStatus.percentUsed, 100)}%`, backgroundColor: progressColor }]} />
                </View>
              </View>

              <View style={styles.budgetStats}>
                <View>
                  <AppText variant="micro" weight="medium" style={{ color: G.fgSecondary }}>{t('expense.planned')}</AppText>
                  <AppNumber value={budgetStatus.planned} size="body-sm" prefix={t('common.etb') + ' '} />
                </View>
                <View>
                  <AppText variant="micro" weight="medium" style={{ color: G.fgSecondary }}>{t('expense.spent')}</AppText>
                  <AppNumber value={budgetStatus.spent} size="body-sm" prefix={t('common.etb') + ' '} />
                </View>
                <View>
                  <AppText variant="micro" weight="medium" style={{ color: G.fgSecondary }}>{t('expense.remaining')}</AppText>
                  <AppNumber value={budgetStatus.remaining} size="body-sm" prefix={t('common.etb') + ' '} />
                </View>
              </View>

              {budgetStatus.remaining < 0 && (
                <View style={[styles.overWarning, { backgroundColor: colors.error + '15' }]}>
                  <AlertTriangle size={14} color={colors.error} />
                  <AppText variant="caption" weight="bold" style={{ color: colors.error, flex: 1, marginLeft: 6 }}>
                    {t('expense.will_exceed_budget')}
                  </AppText>
                </View>
              )}
            </Animated.View>
          )}

          {/* Recurring Toggle */}
          <TutorialTarget id="ef-recurring">
            <Animated.View entering={FadeInDown.duration(400).delay(350)}>
              <TouchableOpacity
                style={[styles.fieldCard, { backgroundColor: G.bgCard, borderColor: isRecurring ? G.fg : G.border, marginBottom: isRecurring ? 8 : 12, overflow: 'hidden' }]}
                onPress={() => { setIsRecurring(!isRecurring); Haptics.selectionAsync(); }}
                activeOpacity={0.7}
              >
                <View style={styles.fieldRow}>
                  <Repeat size={18} color={isRecurring ? G.fg : G.fgSecondary} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: G.fgSecondary }]}>
                      {t('expense.recurring')}
                    </AppText>
                    <AppText variant="body" weight="bold" style={[styles.fieldValue, { color: isRecurring ? G.fg : G.fgSecondary }]}>
                      {isRecurring ? `${recurFrequency} · ${formatDate(new Date(recurStartDate), calendarType, language)}` : t('expense.one_time')}
                    </AppText>
                  </View>
                  <View style={[styles.toggleTrack, { backgroundColor: isRecurring ? G.fg : G.border }]}>
                    <View style={[styles.toggleThumb, { backgroundColor: isRecurring ? G.bg : G.bgCard }]} />
                  </View>
                </View>
              </TouchableOpacity>

              {isRecurring && (
                <Animated.View entering={FadeIn} style={{ marginBottom: 12 }}>
                  <View style={[styles.fieldCard, { backgroundColor: G.bgCard, borderColor: G.border, marginBottom: 8, overflow: 'hidden' }]}>
                     <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: G.fgSecondary, marginBottom: 10 }]}>{t('expense.frequency')}</AppText>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {[{ key: 'Daily', label: t('expense.daily') }, { key: 'Weekly', label: t('expense.weekly') }, { key: 'Monthly', label: t('expense.monthly') }, { key: 'Yearly', label: t('expense.yearly') }].map(freq => (
                        <TouchableOpacity key={freq.key}
                          style={[styles.chip, { backgroundColor: G.bgCard, borderColor: G.border, paddingVertical: 8, paddingHorizontal: 14 }, recurFrequency === freq.key && { backgroundColor: G.fg }]}
                          onPress={() => { setRecurFrequency(freq.key); Haptics.selectionAsync(); }}
                        >
                          <AppText variant="body-sm" weight="bold" style={{ color: recurFrequency === freq.key ? G.bg : G.fg }}>{freq.label}</AppText>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      style={[styles.dateField, { backgroundColor: G.bgCard, borderColor: G.border, flex: 1 }]}
                      onPress={() => setShowStartPicker(true)}
                    >
                      <CalendarIcon size={16} color={G.fgSecondary} />
                      <AppText variant="caption" weight="bold" style={{ color: G.fg, marginLeft: 6 }} numberOfLines={1}>
                        {formatDate(new Date(recurStartDate), calendarType, language)}
                      </AppText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.dateField, { backgroundColor: G.bgCard, borderColor: G.border, flex: 1 }]}
                      onPress={() => setShowEndPicker(true)}
                    >
                      <CalendarIcon size={16} color={G.fgSecondary} />
                      <AppText variant="caption" weight="bold" style={{ color: G.fg, marginLeft: 6 }} numberOfLines={1}>
                        {formatDate(new Date(recurEndDate), calendarType, language)}
                      </AppText>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              )}
            </Animated.View>
          </TutorialTarget>

          {/* Save Button */}
          <TutorialTarget id="ef-commit-btn">
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: G.fg, overflow: 'hidden' }]}
              onPress={handleSave}
              activeOpacity={0.8}
            >
              <ShieldCheck size={22} color={G.bg} />
              <AppText variant="body" weight="bold" style={[styles.saveBtnText, { color: G.bg }]}>
                {isRecurring ? t('expense.save_schedule') : t('expense.commit_ledger')}
              </AppText>
            </TouchableOpacity>
          </TutorialTarget>
          <TutorialButton tutorialId="expense-form" screenName={t('screen.add_expense')} />
        </TutorialScrollView>
      </KeyboardAvoidingView>

      <CustomDatePicker
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelectDate={handleDateChange}
        initialDate={date}
      />

      <CustomDatePicker
        visible={showStartPicker}
        onClose={() => setShowStartPicker(false)}
        initialDate={recurStartDate}
        onSelectDate={(d) => { setRecurStartDate(d); setShowStartPicker(false); }}
      />
      <CustomDatePicker
        visible={showEndPicker}
        onClose={() => setShowEndPicker(false)}
        initialDate={recurEndDate}
        onSelectDate={(d) => { setRecurEndDate(d); setShowEndPicker(false); }}
      />

      {successDetails && (
        <BusinessSuccessModal
          details={successDetails}
          onClose={() => {
            setSuccessDetails(null);
            onSaveSuccess?.();
          }}
        />
      )}
    </SafeAreaView>
  );
};

const DEFAULT_CATEGORY_KEYS = [
  'expense.cat_utilities', 'expense.cat_rent', 'expense.cat_salaries', 'expense.cat_inventory', 'expense.cat_transportation',
  'expense.cat_marketing', 'expense.cat_maintenance', 'expense.cat_taxes', 'expense.cat_loan_payment', 'expense.cat_office_supplies',
  'expense.cat_insurance', 'expense.cat_general'
];

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 60 },
  header: { marginTop: 8, marginBottom: 16 },
  headerSub: { fontSize: 12, letterSpacing: 1.2, marginBottom: 4, opacity: 0.7 },
  headerTitle: { fontSize: 28, letterSpacing: -0.5 },
  amountCard: { borderRadius: 24, padding: 16, borderWidth: 1, alignItems: 'center', marginBottom: 12 },
  amountLabel: { fontSize: 11, letterSpacing: 1.5, marginBottom: 8 },
  amountRow: { flexDirection: 'row', alignItems: 'baseline' },
  amountInput: { fontSize: 40, fontFamily: Fonts.bold, textAlign: 'center', minWidth: 160 },
  currency: { fontSize: 16, fontFamily: Fonts.bold, marginLeft: 8 },
  fieldCard: { borderRadius: 16, padding: 14, borderWidth: 1, marginBottom: 10 },
  fieldRow: { flexDirection: 'row', alignItems: 'center' },
  fieldLabel: { fontSize: 10, letterSpacing: 0.5, marginBottom: 2 },
  fieldValue: { fontSize: 16, fontFamily: Fonts.bold },
  descInput: { fontSize: 16, fontFamily: Fonts.medium, padding: 0 },
  categoryGrid: { paddingVertical: 8, gap: 8, marginBottom: 8 },
  sectionLabel: { fontSize: 12, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  customCatInput: { flex: 1, height: 42, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, fontSize: 14, fontFamily: Fonts.medium },
  addCatBtn: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  miniChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  warningCard: { borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 12 },
  ambiguousRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  toggleTrack: { width: 44, height: 24, borderRadius: 12, justifyContent: 'center', paddingHorizontal: 2 },
  toggleThumb: { width: 20, height: 20, borderRadius: 10 },
  dateField: { flexDirection: 'row', alignItems: 'center', height: 44, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12 },
  budgetCard: { borderRadius: 18, padding: 18, borderWidth: 1, marginBottom: 16 },
  budgetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  budgetName: { flex: 1, marginLeft: 8, fontSize: 12, fontFamily: Fonts.bold },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  budgetBar: { marginBottom: 14 },
  budgetBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  budgetBarFill: { height: '100%', borderRadius: 3 },
  budgetStats: { flexDirection: 'row', justifyContent: 'space-between' },
  overWarning: { flexDirection: 'row', alignItems: 'center', marginTop: 12, padding: 10, borderRadius: 10 },
  saveBtn: { height: 54, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 },
  saveBtnText: { fontSize: 16, fontFamily: Fonts.bold },
});

export default AddExpenseScreen;

