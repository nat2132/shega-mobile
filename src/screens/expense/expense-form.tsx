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
  Clock,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { playNice, playBad } from '@/services/soundService';
import {
  insertExpense,
  insertRecurringTemplate,
  updateRecurringTemplate,
  autoLinkExpenseToBudget,
  getBudgetStatusForCategory,
  getBudgets,
  getBudgetCategorySpending,
  getActiveBudgetForExpenses,
  isBudgetExpired,
  getBudgetLimitOverview,
  willExpenseExceedBudget,
  recordBudgetOverage,
} from '@/database/db';
import { notifyExpenseRecorded, notifyExpensePushedBudgetOverLimit, notifyLargeExpense, checkBudgetThresholds } from '@/services/notificationService';
import { useSettings } from '@/context/SettingsContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { useDialog } from '@/context/DialogContext';
import { Fonts } from '@/constants/theme';
import { formatDate, toLocalDateString } from '@/utils/date-utils';
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

// Convert a 24h "HH:MM" string to a localized 12-hour label like "8:00 AM".
const to12Hour = (value: string): string => {
  const [hRaw, mRaw] = String(value).split(':').map(Number);
  if (!Number.isFinite(hRaw)) return value;
  const h = ((hRaw % 24) + 24) % 24;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mins = Number.isFinite(mRaw) ? String(mRaw).padStart(2, '0') : '00';
  return `${h12}:${mins} ${suffix}`;
};

// Accept both "8:00 AM" / "20:00" style input and normalize to "HH:MM".
const normalizeReminderTime = (value: string): string => {
  const trimmed = String(value).trim().toUpperCase();
  const match = trimmed.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(AM|PM)?$/);
  if (!match) return value;
  let h = parseInt(match[1], 10);
  const m = match[2] ? Math.min(Math.max(parseInt(match[2], 10), 0), 59) : 0;
  const meridian = match[3];
  if (meridian === 'PM' && h < 12) h += 12;
  if (meridian === 'AM' && h === 12) h = 0;
  if (h < 0 || h > 23) return value;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const AddExpenseScreen = ({ onSaveSuccess, editingTemplate }: { onSaveSuccess?: () => void; editingTemplate?: any }) => {
  const { colors, t, calendarType, language, notifications } = useSettings();
  const { isReadOnly } = useSubscription();
  const G = getExpenseGlass(colors);
  const dialog = useDialog();
  const isEditingTemplate = !!editingTemplate;

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(() => toLocalDateString(new Date()));
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
  const [recurStartDate, setRecurStartDate] = useState(() => toLocalDateString(new Date()));
  const [recurEndDate, setRecurEndDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30); return toLocalDateString(d);
  });
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [recurReminderTime, setRecurReminderTime] = useState('08:00');
  const [reminderTimeDraft, setReminderTimeDraft] = useState('8:00 AM');
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
      recurReminderTime,
    }), [amount, category, date, description, selectedBudgetId, isRecurring, recurFrequency, recurStartDate, recurEndDate, recurReminderTime]),
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
    if (!editingTemplate) return;
    setAmount(String(editingTemplate.amount ?? ''));
    setCategory(editingTemplate.category || '');
    setDescription(editingTemplate.name || editingTemplate.category || '');
    setIsRecurring(true);
    setRecurFrequency((['Daily', 'Weekly', 'Monthly', 'Yearly'].includes(editingTemplate.frequency) ? editingTemplate.frequency : 'Monthly') as any);
    setRecurStartDate(editingTemplate.startDate || toLocalDateString(new Date()));
    if (editingTemplate.endDate) setRecurEndDate(editingTemplate.endDate);
    if (editingTemplate.reminderTime) {
      setRecurReminderTime(editingTemplate.reminderTime);
      setReminderTimeDraft(to12Hour(editingTemplate.reminderTime));
    }
  }, [editingTemplate]);

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
    if (isReadOnly) {
      await dialog.alert({ title: t('common.read_only_mode'), message: t('common.read_only_mode'), iconType: 'warning' });
      return;
    }
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

    // →→ Budget limit enforcement →→
    // Before saving, compare the expense amount with the remaining balance of
    // the selected budget. If it would exceed, never save silently — ask the
    // user whether to cancel or record the expense anyway.
    let budgetLimit: ReturnType<typeof willExpenseExceedBudget> = null;
    if (budgetIdToCheck && !isRecurring) {
      budgetLimit = willExpenseExceedBudget(budgetIdToCheck, amountNum);
      if (budgetLimit && budgetLimit.exceeds && budgetLimit.totalBudget > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        playBad();
        const detailLines = [
          `${t('budget.name_label') || 'Budget Name'}: ${budgetLimit.budgetName}`,
          `${t('budget.total_budget')}: ${budgetLimit.totalBudget.toLocaleString()} ${t('common.etb')}`,
          `${t('budget.total_spent')}: ${budgetLimit.totalSpent.toLocaleString()} ${t('common.etb')}`,
          `${t('budget.remaining')}: ${budgetLimit.remaining.toLocaleString()} ${t('common.etb')}`,
          `${t('expense.magnitude')}: ${amountNum.toLocaleString()} ${t('common.etb')}`,
          `${t('budget.over_by')}: ${budgetLimit.overBy.toLocaleString()} ${t('common.etb')}`,
        ];
        const confirmed = await dialog.confirm({
          title: t('budget.over_budget_warning_title'),
          message: `${detailLines.join('\n')}\n\n${t('budget.over_budget_confirm_msg', { amount: budgetLimit.overBy.toLocaleString() })}`,
          confirmText: t('budget.record_anyway'),
          cancelText: t('common.cancel'),
          destructive: true,
          iconType: 'warning',
        });
        if (!confirmed) {
          // Cancel — keep the form intact so the user can edit the amount or
          // select another budget.
          return;
        }
      }
    }

    saveFrequentCategory(category.trim());

    if (isRecurring) {
      if (isEditingTemplate && editingTemplate?.id) {
        updateRecurringTemplate(editingTemplate.id, {
          name: description.trim() || category.trim(),
          category: category.trim(),
          amount: amountNum,
          frequency: recurFrequency,
          startDate: recurStartDate,
          endDate: recurEndDate || undefined,
          reminderTime: recurReminderTime,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        playNice();
        await draftFormData.clearCurrent();
        setSuccessDetails({
          title: t('expense.recurring_updated') || 'Recurring Expense Updated',
          subtitle: `${recurFrequency} · ${formatDate(new Date(recurStartDate), calendarType, language)}`,
          mainLabel: t('expense.magnitude'),
          mainValue: `${amountNum.toLocaleString()} ${t('common.etb')}`,
          secondaryLabel: t('common.category'),
          secondaryValue: category.trim(),
          iconType: 'expense',
          itemName: description.trim() || category.trim()
        });
        return;
      }
      insertRecurringTemplate({
        name: description.trim() || category.trim(),
        category: category.trim(),
        amount: amountNum,
        frequency: recurFrequency as any,
        startDate: recurStartDate,
        endDate: recurEndDate || undefined,
        reminderTime: recurReminderTime,
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
      if (notifications.expense !== false) {
        notifyExpenseRecorded({
          id: id as number,
          name: description.trim() || category.trim(),
          amount: amountNum,
          category: category.trim(),
        });
      }
      if (amountNum >= 50000 && notifications.largeExpense !== false) {
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
            if (notifications.budget !== false) {
              notifyExpensePushedBudgetOverLimit({
                expenseId: id as number,
                expenseName: description.trim() || category.trim(),
                categoryName: category.trim(),
                budgetName: status.budgetName,
                budgetId: budget?.id || 0,
                excess: Math.abs(status.remaining),
              });
            }
          }
        } catch {}
      }

      // Record the over-budget event for analytics + recalculate the remaining
      // balance immediately, then fire any newly crossed guard-rail thresholds
      // (50% / 75% / 90% / 100% / over budget).
try {
        if (budgetIdToCheck && budgetLimit && budgetLimit.exceeds) {
          const after = getBudgetLimitOverview(budgetIdToCheck);
          recordBudgetOverage({
            budgetId: budgetIdToCheck,
            budgetName: budgetLimit.budgetName,
            expenseId: id as number,
            expenseName: description.trim() || category.trim(),
            amount: amountNum,
            totalPlanned: after?.totalBudget ?? budgetLimit.totalBudget,
            totalSpent: after?.totalSpent ?? budgetLimit.totalSpent,
            overAmount: after && after.remaining < 0 ? Math.abs(after.remaining) : budgetLimit.overBy,
            remainingAfter: after?.remaining ?? 0,
            percentOver: after?.percentUsed ?? 0,
          });
        }
        if (notifications.budget !== false) checkBudgetThresholds();
      } catch {}

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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
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
                setRecurReminderTime(d.recurReminderTime || '08:00');
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
                {isEditingTemplate ? (t('expense.edit_recurring') || 'Edit Recurring Expense') : t('expense.new_expense')}
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

                  {/* Reminder Time */}
                  <View style={[styles.fieldCard, { backgroundColor: G.bgCard, borderColor: G.border, marginBottom: 8, overflow: 'hidden' }]}>
                    <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.fieldLabel, { color: G.fgSecondary, marginBottom: 10 }]}>{t('expense.reminder_time')}</AppText>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                      {['06:00', '07:00', '08:00', '09:00', '12:00', '15:00', '18:00', '19:00'].map(time => (
                        <TouchableOpacity key={time}
                          style={[styles.chip, { backgroundColor: G.bgCard, borderColor: G.border, paddingVertical: 8, paddingHorizontal: 14 }, recurReminderTime === time && { backgroundColor: G.fg }]}
                          onPress={() => { setRecurReminderTime(time); setReminderTimeDraft(to12Hour(time)); Haptics.selectionAsync(); }}
                        >
                          <AppText variant="body-sm" weight="bold" style={{ color: recurReminderTime === time ? G.bg : G.fg }}>{to12Hour(time)}</AppText>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                      <Clock size={16} color={G.fgSecondary} />
                      <TextInput
                        style={[styles.customCatInput, { backgroundColor: G.bgCard, borderColor: G.border, color: G.fg, flex: 1, height: 42, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, fontSize: 14, fontFamily: Fonts.medium, marginLeft: 8 }]}
                        value={reminderTimeDraft}
                        onChangeText={(v) => {
                          setReminderTimeDraft(v);
                          const normalized = normalizeReminderTime(v);
                          if (normalized !== recurReminderTime) setRecurReminderTime(normalized);
                        }}
                        onBlur={() => {
                          setRecurReminderTime(normalizeReminderTime(reminderTimeDraft));
                          setReminderTimeDraft(to12Hour(normalizeReminderTime(reminderTimeDraft)));
                        }}
                        placeholder="8:00 AM"
                        placeholderTextColor={G.fgSecondary}
                        autoCapitalize="none"
                      />
                    </View>
                    <AppText variant="caption" weight="medium" style={{ color: G.fgSecondary, marginTop: 6 }}>
                      {t('expense.reminder_time_hint')}
                    </AppText>
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
                {isRecurring ? (isEditingTemplate ? (t('expense.update_schedule') || 'Update Schedule') : t('expense.save_schedule')) : t('expense.commit_ledger')}
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

