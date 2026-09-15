import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  Landmark,
  Percent,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
  Wallet,
} from 'lucide-react-native';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { AppText } from '@/components/ui';
import { getSettingsGlass } from './glass-settings';
import MorVerificationInline from '@/components/tax/mor-verification';
import {
  addVatCredit,
  annualTurnover,
  dueSoon,
  estimateAnnualTax,
  getBusinessTaxConfig,
  getTaxProfile,
  listTaxPayments,
  obligationsFor,
  periodTotals,
  recordTaxPayment,
  saveTaxProfile,
  syncTaxReminders,
  addTaxType,
  updateTaxType,
  removeTaxType,
  toggleBusinessTax,
  setActiveTaxType,
  type TaxPaymentRecord,
  type TaxTypeConfig,
} from '@/services/taxService';
import { rateFor } from '@shega/shared';
import type { TaxProfile } from '@shega/shared';

const num = (v: string) => {
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TaxCenterScreen = () => {
  const { colors, t } = useSettings();
  const G = getSettingsGlass(colors);

  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const profile: TaxProfile = getTaxProfile();
  const totals = periodTotals(year, month);
  const obligations = obligationsFor(year);
  const upcoming = dueSoon(45);
  const payments = listTaxPayments();
  const advance = rateFor('ADVANCE');
  const estimatedTax = estimateAnnualTax();

  const totalObligations = obligations.length;
  const paidCount = obligations.filter((o) => o.status === 'paid').length;
  const overdue = obligations.filter((o) => o.status === 'overdue');

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<{
    tin: string; licenseNumber: string; vatNumber: string;
    category: 'A' | 'B'; vatRegistered: boolean; estimatedAnnualTurnover: string; payrollActive: boolean;
  }>({
    tin: profile.tin,
    licenseNumber: profile.licenseNumber || '',
    vatNumber: profile.vatNumber || '',
    category: profile.category,
    vatRegistered: profile.vatRegistered,
    estimatedAnnualTurnover: String(profile.estimatedAnnualTurnover || annualTurnover()),
    payrollActive: profile.payrollActive,
  });

  const [creditInput, setCreditInput] = useState('');
  const [creditOpen, setCreditOpen] = useState(false);
  const [reminderMsg, setReminderMsg] = useState<string | null>(null);

  // Per-business tax configuration (VAT / TOT / custom tax types). Configured
  // here once and applied automatically to every sale — the cashier never
  // picks tax at the till.
  const taxCfg = getBusinessTaxConfig();
  const [editingTax, setEditingTax] = useState<TaxTypeConfig | null>(null);
  const [showTaxForm, setShowTaxForm] = useState(false);
  const [taxNameDraft, setTaxNameDraft] = useState('');
  const [taxRateDraft, setTaxRateDraft] = useState('');
  const [, setRefresher] = useState(0);
  const refresh = () => { setRefresher((x) => x + 1); setShowTaxForm(false); setEditingTax(null); };

  const openAddTax = () => {
    setEditingTax(null);
    setTaxNameDraft('VAT');
    setTaxRateDraft('15');
    setShowTaxForm(true);
  };

  const openEditTax = (t: TaxTypeConfig) => {
    setEditingTax(t);
    setTaxNameDraft(t.name);
    setTaxRateDraft(String(t.rate));
    setShowTaxForm(true);
  };

  const saveTaxType = () => {
    const name = taxNameDraft.trim();
    const rate = parseFloat(taxRateDraft) || 0;
    if (!name || rate <= 0) return;
    if (editingTax) updateTaxType(editingTax.id, { name, rate });
    else addTaxType(name, rate);
    refresh();
  };

  const removeTaxTypeCfg = (id: string) => {
    removeTaxType(id);
    refresh();
  };

  const openEdit = () => {
    setDraft({
      tin: profile.tin,
      licenseNumber: profile.licenseNumber || '',
      vatNumber: profile.vatNumber || '',
      category: profile.category,
      vatRegistered: profile.vatRegistered,
      estimatedAnnualTurnover: String(profile.estimatedAnnualTurnover || annualTurnover()),
      payrollActive: profile.payrollActive,
    });
    setEditing(true);
  };

  const saveEdit = () => {
    saveTaxProfile({
      tin: draft.tin.trim(),
      licenseNumber: draft.licenseNumber.trim(),
      vatNumber: draft.vatNumber.trim(),
      category: draft.category,
      vatRegistered: draft.vatRegistered,
      estimatedAnnualTurnover: num(draft.estimatedAnnualTurnover),
      payrollActive: draft.payrollActive,
    });
    setEditing(false);
    refresh();
  };

  const payObligation = (o: { id: string; kind: string; period: string }) => {
    let amount = 0;
    if (o.kind === 'vat') amount = totals.netVat;
    else if (o.kind === 'tot') amount = totals.turnover * rateFor('TOT_2');
    else if (o.kind === 'wht') amount = totals.whtCollected;
    else if (o.kind === 'advance') amount = estimatedTax;
    else if (o.kind === 'annual') amount = estimatedTax;
    else amount = 0;
    const rec: TaxPaymentRecord = {
      obligationId: o.id,
      kind: o.kind,
      period: o.period,
      amount: amount > 0 ? amount : 0,
      paidDate: new Date().toISOString().slice(0, 10),
      method: 'bank',
      reference: `PAY-${Date.now()}`,
    };
    recordTaxPayment(rec);
    refresh();
  };

  const handleAddCredit = () => {
    const amount = num(creditInput);
    if (amount <= 0) return;
    addVatCredit({ period: totals.period, amount, note: 'manual' });
    setCreditInput('');
    setCreditOpen(false);
    refresh();
  };

  const handleSyncReminders = () => {
    const n = syncTaxReminders();
    setReminderMsg(n > 0 ? `Reminded for ${n} tax obligation(s).` : 'Up to date — no new reminders.');
    setTimeout(() => setReminderMsg(null), 3000);
  };

  const statusColor: Record<string, string> = {
    paid: '#22C55E',
    overdue: '#EF4444',
    pending: G.muted,
  };

  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  const yearOptions = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <View style={[styles.container, { backgroundColor: G.bg }]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[styles.glowWash, { backgroundColor: G.mutedLight, top: -80, left: -60, width: 240, height: 240, borderRadius: 120 }]} />
      </View>

      <View style={styles.header}>
        <View style={[styles.headerIconBox, { backgroundColor: G.accentGlass }]}>
          <Landmark size={26} color={G.fg} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.headerLabel, { color: G.fgSecondary }]} numberOfLines={1}>Ethiopian Tax Center</AppText>
          <AppText variant="display" weight="bold" style={[styles.mainTitle, { color: G.fg }]} numberOfLines={1}>ZERO extra tax work</AppText>
        </View>
      </View>

      {/* Tax configuration — managed here, applied automatically to every sale */}
      <View style={[styles.card, { backgroundColor: G.bgCard, borderColor: G.border }]}>
        <View style={styles.cardHeaderRow}>
          <Percent size={18} color={G.fg} />
          <AppText variant="title-sm" weight="bold" style={[styles.cardTitle, { color: G.fg }]} numberOfLines={1}>Tax configuration</AppText>
          <Switch
            value={taxCfg.enabled}
            onValueChange={(v) => { toggleBusinessTax(v); refresh(); }}
            trackColor={{ false: G.border, true: G.fg + '60' }}
            thumbColor={taxCfg.enabled ? G.fg : G.muted}
          />
        </View>
        <AppText variant="caption" weight="medium" style={{ color: G.muted, marginTop: 4 }} numberOfLines={2}>
          Applied automatically to every sale — the cashier never picks tax at the till.
        </AppText>

        {taxCfg.enabled && taxCfg.taxTypes.length === 0 && (
          <AppText variant="body-sm" weight="medium" style={{ color: G.muted, marginTop: 12 }} numberOfLines={2}>
            No tax types configured yet. Add one below to start charging tax on sales.
          </AppText>
        )}

        {taxCfg.taxTypes.map((t) => (
          <View key={t.id} style={[styles.taxEntry, { borderTopColor: G.border }]}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => setActiveTaxType(t.id)} activeOpacity={0.7}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <AppText variant="body" weight="bold" style={{ color: G.fg }} numberOfLines={1}>{t.name}</AppText>
                <View style={[styles.pill, { backgroundColor: t.active ? 'rgba(34,197,94,0.14)' : 'rgba(255,255,255,0.05)' }]}>
                  <AppText variant="caption" weight="bold" style={{ color: t.active ? '#22C55E' : G.muted }} numberOfLines={1}>{t.rate}%</AppText>
                </View>
              </View>
              <AppText variant="caption" weight="medium" style={{ color: G.muted, marginTop: 2 }} numberOfLines={1}>
                {t.active ? 'Active — applied at checkout' : 'Tap to set as active'}
              </AppText>
            </TouchableOpacity>
            <Switch
              value={t.enabled}
              onValueChange={(v) => { updateTaxType(t.id, { enabled: v }); refresh(); }}
              trackColor={{ false: G.border, true: G.fg + '60' }}
              thumbColor={t.enabled ? G.fg : G.muted}
            />
            <TouchableOpacity style={[styles.iconBtn, { borderColor: G.border }]} onPress={() => openEditTax(t)} hitSlop={8}>
              <Pencil size={15} color={G.fg} />
            </TouchableOpacity>
            {taxCfg.taxTypes.length > 1 && (
              <TouchableOpacity style={[styles.iconBtn, { borderColor: 'rgba(239,68,68,0.3)' }]} onPress={() => removeTaxTypeCfg(t.id)} hitSlop={8}>
                <Trash2 size={15} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>
        ))}

        {showTaxForm && (
          <View style={[styles.taxForm, { borderTopColor: G.border }]}>
            <TextInput
              style={[styles.taxNameInput, { color: G.fg, borderColor: G.border, backgroundColor: G.bg }]}
              value={taxNameDraft}
              onChangeText={setTaxNameDraft}
              placeholder="e.g. VAT"
              placeholderTextColor={G.muted}
            />
            <View style={styles.taxRateRow}>
              <TextInput
                style={[styles.taxRateInput, { color: G.fg, borderColor: G.border, backgroundColor: G.bg }]}
                value={taxRateDraft}
                onChangeText={(v) => setTaxRateDraft(v.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={G.muted}
              />
              <AppText variant="body-sm" weight="bold" style={{ color: G.muted }} numberOfLines={1}>%</AppText>
            </View>
            <View style={styles.taxFormActions}>
              <TouchableOpacity style={[styles.iconBtn, { borderColor: G.border, flex: 1 }]} onPress={() => setShowTaxForm(false)} hitSlop={8}>
                <AppText variant="body-sm" weight="bold" style={{ color: G.muted }} numberOfLines={1}>Cancel</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.taxSaveBtn, { backgroundColor: G.fg, flex: 1 }]} onPress={saveTaxType}>
                <AppText variant="body-sm" weight="bold" shrink={false} style={{ color: G.bg }} numberOfLines={1}>{editingTax ? 'Save' : 'Add'}</AppText>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!showTaxForm && (
          <TouchableOpacity style={[styles.addTaxBtn, { borderColor: G.border, backgroundColor: G.accentGlass }]} onPress={openAddTax}>
            <Plus size={16} color={G.fg} />
            <AppText variant="body-sm" weight="bold" style={{ color: G.fg }} numberOfLines={1}>Add tax type</AppText>
          </TouchableOpacity>
        )}

        <AppText variant="caption" weight="medium" style={{ color: G.muted, marginTop: 12 }} numberOfLines={2}>
          Tax settings are per-business and sync to your authorized devices automatically.
        </AppText>
      </View>

      {/* Period picker */}
      <View style={[styles.pickerRow, { marginBottom: 16 }]}>
        {yearOptions.map((y) => (
          <TouchableOpacity
            key={y}
            style={[styles.chip, { borderColor: G.border, backgroundColor: year === y ? G.fg : G.bgCard }]}
            onPress={() => { setYear(y); refresh(); }}
          >
            <AppText variant="caption" weight="bold" style={{ color: year === y ? G.bg : G.fg }}>{y}</AppText>
          </TouchableOpacity>
        ))}
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={[styles.chip, { borderColor: G.border, backgroundColor: G.bgCard }]}
          onPress={() => { setMonth(month === 12 ? 1 : month + 1); refresh(); }}
        >
          <AppText variant="caption" weight="bold" style={{ color: G.fg }}>{totalObligations ? `${String(year)}-${String(month).padStart(2, '0')}` : '—'}</AppText>
        </TouchableOpacity>
      </View>

      {/* Totals card */}
      <View style={[styles.card, { backgroundColor: G.bgCard, borderColor: G.border }]}>
        <View style={styles.cardHeaderRow}>
          <FileText size={18} color={G.fg} />
          <AppText variant="title-sm" weight="bold" style={[styles.cardTitle, { color: G.fg }]} numberOfLines={1}>Current period — {totals.period}</AppText>
        </View>
        <View style={styles.twoCol}>
          <View style={styles.statBox}>
            <AppText variant="caption" weight="bold" style={{ color: G.muted }} numberOfLines={1}>OUTPUT VAT</AppText>
            <AppText variant="title" weight="bold" style={{ color: G.fg }} numberOfLines={1}>{fmt(totals.outputVat)}</AppText>
          </View>
          <View style={styles.statBox}>
            <AppText variant="caption" weight="bold" style={{ color: G.muted }} numberOfLines={1}>INPUT VAT</AppText>
            <AppText variant="title" weight="bold" style={{ color: G.fg }} numberOfLines={1}>{fmt(totals.inputVat)}</AppText>
          </View>
        </View>
        <View style={[styles.netRow, { borderTopColor: G.border }]}>
          <AppText variant="body" weight="bold" style={{ color: G.muted }} numberOfLines={1}>Net VAT payable</AppText>
          <AppText variant="title" weight="bold" style={{ color: totals.netVat > 0 ? '#22C55E' : G.fg }} numberOfLines={1}>{fmt(totals.netVat)}</AppText>
        </View>
        <View style={[styles.netRow, { borderTopColor: G.border }]}>
          <AppText variant="body" weight="bold" style={{ color: G.muted }} numberOfLines={1}>Gross turnover</AppText>
          <AppText variant="title" weight="bold" style={{ color: G.fg }} numberOfLines={1}>{fmt(totals.turnover)}</AppText>
        </View>
        <View style={[styles.netRow, { borderTopColor: G.border }]}>
          <AppText variant="body" weight="bold" style={{ color: G.muted }} numberOfLines={1}>WHT collected / remitted</AppText>
          <AppText variant="title" weight="bold" style={{ color: G.fg }} numberOfLines={1}>{fmt(totals.whtCollected)}</AppText>
        </View>

        <TouchableOpacity
          style={[styles.addCreditBtn, { borderColor: G.border, backgroundColor: G.accentGlass }]}
          onPress={() => setCreditOpen(!creditOpen)}
        >
          <Plus size={16} color={G.fg} />
          <AppText variant="body-sm" weight="bold" style={{ color: G.fg }} numberOfLines={1}>Add input VAT credit (tax invoices received)</AppText>
        </TouchableOpacity>
        {creditOpen && (
          <View style={styles.creditRow}>
            <TextInput
              style={[styles.creditInput, { color: G.fg, borderColor: G.border, backgroundColor: G.bg }]}
              value={creditInput}
              onChangeText={setCreditInput}
              placeholder="Amount (ETB)"
              placeholderTextColor={G.muted}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity style={[styles.creditSave, { backgroundColor: G.fg }]} onPress={handleAddCredit}>
              <AppText variant="body-sm" weight="bold" style={{ color: G.bg }}>Save</AppText>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Due soon */}
      <View style={styles.sectionHead}>
        <CalendarClock size={18} color={G.fg} />
        <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.sectionTitle, { color: G.muted }]} numberOfLines={1}>DUE SOON (45 DAYS)</AppText>
        <TouchableOpacity onPress={handleSyncReminders}>
          <AppText variant="body-sm" weight="bold" style={{ color: G.fg }} numberOfLines={1}>Remind me</AppText>
        </TouchableOpacity>
      </View>
      {reminderMsg && (
        <AppText variant="caption" weight="medium" style={{ color: '#22C55E', marginTop: 4 }} numberOfLines={2}>{reminderMsg}</AppText>
      )}
      <View style={[styles.card, { backgroundColor: G.bgCard, borderColor: G.border }]}>
        {upcoming.length === 0 && (
          <AppText variant="body" weight="medium" style={{ color: G.muted, padding: 6 }} numberOfLines={2}>Nothing due in the next 45 days. Great job staying ahead.</AppText>
        )}
        {upcoming.map((o) => (
          <View key={o.id} style={[styles.obligationRow, { borderBottomColor: G.border }]}>
            <View style={{ flex: 1 }}>
              <AppText variant="body" weight="bold" style={{ color: G.fg }} numberOfLines={1}>{o.label}</AppText>
              <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={1}>Due {o.dueDate}</AppText>
            </View>
            <View style={[styles.statusDot, { backgroundColor: statusColor[o.status] || G.muted }]} />
            {o.status !== 'paid' && (
              <TouchableOpacity style={[styles.payBtn, { backgroundColor: G.accentGlass }]} onPress={() => payObligation(o)}>
                <CheckCircle2 size={14} color={G.fg} />
                <AppText variant="caption" weight="bold" style={{ color: G.fg }}>PAID</AppText>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>

      {/* Obligations calendar */}
      <View style={styles.sectionHead}>
        <Wallet size={18} color={G.fg} />
        <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.sectionTitle, { color: G.muted }]} numberOfLines={1}>OBLIGATIONS {year} · {paidCount}/{totalObligations} PAID</AppText>
      </View>
      <View style={[styles.card, { backgroundColor: G.bgCard, borderColor: G.border }]}>
        {overdue.length > 0 && (
          <View style={[styles.overdueBanner, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
            <ShieldAlert size={16} color="#EF4444" />
            <AppText variant="body-sm" weight="bold" style={{ color: '#EF4444', flex: 1 }} numberOfLines={2}>{overdue.length} overdue — act before penalty.</AppText>
          </View>
        )}
        {obligations.map((o) => (
          <View key={o.id} style={[styles.obligationRow, { borderBottomColor: G.border }]}>
            <View style={{ flex: 1 }}>
              <AppText variant="body" weight="bold" style={{ color: G.fg }} numberOfLines={1}>{o.label}</AppText>
              <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={1}>
                Due {o.dueDate}
                {o.status === 'paid' && o.paidAmount ? ` · ${fmt(o.paidAmount)} paid` : ''}
              </AppText>
            </View>
            <View style={[styles.statusDot, { backgroundColor: statusColor[o.status] || G.muted }]} />
            {o.status !== 'paid' && (
              <TouchableOpacity style={[styles.payBtn, { backgroundColor: G.accentGlass }]} onPress={() => payObligation(o)}>
                <CheckCircle2 size={14} color={G.fg} />
                <AppText variant="caption" weight="bold" style={{ color: G.fg }}>PAID</AppText>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>

      {/* Advance estimate */}
      <View style={[styles.card, { backgroundColor: G.bgCard, borderColor: G.border }]}>
        <View style={styles.cardHeaderRow}>
          <CircleDollarSign size={18} color={G.fg} />
          <AppText variant="title-sm" weight="bold" style={[styles.cardTitle, { color: G.fg }]} numberOfLines={1}>Quarterly advance estimate</AppText>
        </View>
        <AppText variant="body-sm" weight="medium" style={{ color: G.muted, marginTop: 4 }} numberOfLines={3}>
          {Math.round(advance * 100)}% of prior-year liability. Estimated from turnover: {fmt(estimatedTax)} per quarter. Reconcile at year end.
        </AppText>
        <View style={styles.monthPickerRow}>
          {monthOptions.map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.monthChip, { borderColor: G.border, backgroundColor: month === m ? G.fg : G.bgCard }]}
              onPress={() => setMonth(m)}
            >
              <AppText variant="caption" weight="bold" style={{ color: month === m ? G.bg : G.muted }}>{m}</AppText>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Payments ledger */}
      <View style={styles.sectionHead}>
        <Landmark size={18} color={G.fg} />
        <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.sectionTitle, { color: G.muted }]} numberOfLines={1}>PAYMENT LEDGER</AppText>
      </View>
      <View style={[styles.card, { backgroundColor: G.bgCard, borderColor: G.border }]}>
        {payments.length === 0 && (
          <AppText variant="body" weight="medium" style={{ color: G.muted, padding: 6 }} numberOfLines={2}>No recorded tax payments yet. Tap PAID to record one.</AppText>
        )}
        {payments.map((p, i) => (
          <View key={`${p.obligationId}-${i}`} style={[styles.obligationRow, { borderBottomColor: G.border }]}>
            <BadgeCheck size={16} color="#22C55E" />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <AppText variant="body-sm" weight="bold" style={{ color: G.fg }} numberOfLines={1}>{p.obligationId}</AppText>
              <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={1}>{p.paidDate} · {p.reference || p.method}</AppText>
            </View>
            <AppText variant="body" weight="bold" style={{ color: '#22C55E' }} numberOfLines={1}>{fmt(p.amount)}</AppText>
          </View>
        ))}
      </View>

      {/* Profile / taxpayer */}
      <View style={[styles.card, { backgroundColor: G.bgCard, borderColor: G.border }]}>
        <View style={styles.cardHeaderRow}>
          <Landmark size={18} color={G.fg} />
          <AppText variant="title-sm" weight="bold" style={[styles.cardTitle, { color: G.fg }]} numberOfLines={1}>Taxpayer profile</AppText>
        </View>
        {!editing ? (
          <>
            <Row G={G} label="Category" value={profile.category === 'A' ? 'Category A — VAT liable' : 'Category B — turnover tax'} />
            <Row G={G} label="TIN" value={profile.tin || '—'} />
            <Row G={G} label="VAT registration" value={profile.vatRegistered ? `Yes · ${profile.vatNumber || ''}` : 'No'} />
            <Row G={G} label="Turnover (ann.)" value={fmt(profile.estimatedAnnualTurnover ?? annualTurnover())} />
            <TouchableOpacity style={[styles.addCreditBtn, { borderColor: G.border, backgroundColor: G.accentGlass }]} onPress={openEdit}>
              <AppText variant="body-sm" weight="bold" style={{ color: G.fg }} numberOfLines={1}>Edit profile</AppText>
            </TouchableOpacity>
            <View style={[styles.morBlock, { borderTopColor: G.border }]}>
              <AppText variant="micro" weight="bold" transform="uppercase" style={[styles.sectionTitle, { color: G.muted }]} numberOfLines={1}>MINISTRY OF REVENUES</AppText>
              <MorVerificationInline
                tin={draft.tin || profile.tin}
                onVerified={(v) => {
                  if (!draft.tin.trim() && v.taxpayerName) setDraft((d) => ({ ...d, tin: v.tin }));
                }}
              />
            </View>
          </>
        ) : (
          <>
            {(['A', 'B'] as const).map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.categoryChip, { borderColor: G.border, backgroundColor: draft.category === c ? G.fg : G.bgCard }]}
                onPress={() => setDraft((d) => ({ ...d, category: c, vatRegistered: c === 'A' ? d.vatRegistered : false }))}
              >
                <AppText variant="body-sm" weight="bold" style={{ color: draft.category === c ? G.bg : G.fg }} numberOfLines={1}>
                  {c === 'A' ? 'Category A (income + VAT)' : 'Category B (gross receipts)'}
                </AppText>
              </TouchableOpacity>
            ))}
            <Field G={G} label="TIN" value={draft.tin} onChangeText={(v) => setDraft((d) => ({ ...d, tin: v }))} placeholder="e.g. 0XXXXXXXXXXXX" />
            <Field G={G} label="VAT number" value={draft.vatNumber} onChangeText={(v) => setDraft((d) => ({ ...d, vatNumber: v }))} />
            <Field G={G} label="Business license" value={draft.licenseNumber} onChangeText={(v) => setDraft((d) => ({ ...d, licenseNumber: v }))} />
            <Field G={G} label="Annual turnover (ETB)" value={draft.estimatedAnnualTurnover} onChangeText={(v) => setDraft((d) => ({ ...d, estimatedAnnualTurnover: v }))} keyboardType="decimal-pad" />
            <View style={[styles.switchRow, { borderTopColor: G.border }]}>
              <View style={{ flex: 1 }}>
                <AppText variant="body-sm" weight="bold" style={{ color: G.fg }} numberOfLines={1}>VAT registered</AppText>
                <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={2}>Enables monthly VAT obligations & filing.</AppText>
              </View>
              <Switch
                value={draft.vatRegistered}
                onValueChange={(v) => setDraft((d) => ({ ...d, vatRegistered: v }))}
                trackColor={{ false: G.border, true: G.fg + '60' }}
                thumbColor={draft.vatRegistered ? G.fg : G.muted}
              />
            </View>
            <View style={[styles.switchRow, { borderTopColor: G.border }]}>
              <View style={{ flex: 1 }}>
                <AppText variant="body-sm" weight="bold" style={{ color: G.fg }} numberOfLines={1}>Payroll (PAYE + pension)</AppText>
                <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={2}>Include PAYE & pension remittance obligations.</AppText>
              </View>
              <Switch
                value={draft.payrollActive}
                onValueChange={(v) => setDraft((d) => ({ ...d, payrollActive: v }))}
                trackColor={{ false: G.border, true: G.fg + '60' }}
                thumbColor={draft.payrollActive ? G.fg : G.muted}
              />
            </View>
            <View style={styles.editActions}>
              <TouchableOpacity style={[styles.actionBtn, { borderColor: G.border }]} onPress={() => setEditing(false)}>
                <AppText variant="body" weight="bold" style={{ color: G.muted }} numberOfLines={1}>{t('common.cancel')}</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: G.fg }]} onPress={saveEdit}>
                <AppText variant="body" weight="bold" style={{ color: G.bg }} numberOfLines={1}>Save profile</AppText>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  );
};

const Row = ({ G, label, value }: { G: ReturnType<typeof getSettingsGlass>; label: string; value: string }) => (
  <View style={[styles.infoRow, { borderTopColor: G.border }]}>
    <AppText variant="body-sm" weight="medium" style={{ color: G.muted, flex: 1 }} numberOfLines={1}>{label}</AppText>
    <AppText variant="body-sm" weight="bold" style={{ color: G.fg }} numberOfLines={2} >{value}</AppText>
  </View>
);

const Field = ({ G, label, value, onChangeText, placeholder, keyboardType }: {
  G: ReturnType<typeof getSettingsGlass>; label: string; value: string;
  onChangeText: (v: string) => void; placeholder?: string; keyboardType?: 'default' | 'decimal-pad';
}) => (
  <View style={[styles.fieldWrap, { borderTopColor: G.border }]}>
    <AppText variant="caption" weight="bold" style={{ color: G.muted }} numberOfLines={1}>{label}</AppText>
    <TextInput
      style={[styles.fieldInput, { color: G.fg, borderColor: G.border, backgroundColor: G.bg }]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={G.muted}
      keyboardType={keyboardType || 'default'}
    />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 8, paddingBottom: 40 },
  glowWash: { position: 'absolute' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 10 },
  headerIconBox: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  headerLabel: { fontSize: 11, fontFamily: Fonts.bold, letterSpacing: 1.5 },
  mainTitle: { fontSize: 22, fontFamily: Fonts.bold, marginTop: 2 },
  card: { borderRadius: 24, borderWidth: 1, padding: 18, marginBottom: 18, overflow: 'hidden' },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  cardTitle: { fontSize: 16, fontFamily: Fonts.bold, flex: 1 },
  twoCol: { flexDirection: 'row', gap: 12, marginBottom: 6 },
  statBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 14 },
  netRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 2,
  },
  addCreditBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center',
    borderRadius: 14, paddingVertical: 12, borderWidth: 1, marginTop: 12,
  },
  creditRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  creditInput: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 14, fontFamily: Fonts.bold },
  creditSave: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 18 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, marginTop: 4 },
  sectionTitle: { fontSize: 11, fontFamily: Fonts.bold, letterSpacing: 1, flex: 1 },
  obligationRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  payBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10 },
  overdueBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 10, marginBottom: 8 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  taxEntry: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4,
  },
  pill: { borderRadius: 8, paddingVertical: 3, paddingHorizontal: 8 },
  iconBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 10, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 12,
  },
  taxForm: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4, paddingTop: 12, gap: 10 },
  taxNameInput: { borderRadius: 12, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12, fontFamily: Fonts.bold },
  taxRateRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  taxRateInput: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12, fontFamily: Fonts.bold },
  taxSaveBtn: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 18, alignItems: 'center' },
  taxFormActions: { flexDirection: 'row', gap: 10, marginTop: 2 },
  addTaxBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center',
    borderRadius: 14, paddingVertical: 12, borderWidth: 1, marginTop: 12,
  },
  chip: { borderRadius: 16, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1 },
  monthPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  monthChip: { borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1 },
  categoryChip: { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, marginBottom: 8 },
  fieldWrap: { marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  fieldInput: { borderRadius: 12, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 14, marginTop: 6, fontFamily: Fonts.medium },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 10,
  },
  editActions: { flexDirection: 'row', gap: 12, marginTop: 18 },
  actionBtn: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1 },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth,
  },
  morBlock: { marginTop: 16, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14, gap: 8 },
});

export default TaxCenterScreen;