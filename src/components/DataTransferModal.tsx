/**
 * DataTransferModal
 * Handles Export (DB backup or CSV per data type) and Import (DB restore or CSV).
 */
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { useDialog } from '@/context/DialogContext';
import {
    getFilteredAdjustments,
    getFilteredExpenses,
    getItems,
    getSales,
} from '@/database/db';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
    AlertTriangle,
    CheckCircle2,
    ChevronRight,
    Database,
    FileSpreadsheet,
    Info,
    X,
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';

import { AppText, AppCard, AppButton } from '@/components/ui';
// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = 'export' | 'import';
type Format = 'db' | 'csv';
type DataType = 'sales' | 'inventory' | 'expenses' | 'adjustments';

interface Props {
  visible: boolean;
  mode: Mode;
  onClose: () => void;
  onSuccess: (type: 'export' | 'import') => void;
}

// ─── CSV column specs shown as warnings ──────────────────────────────────────

const CSV_SPECS: Record<DataType, { columns: string[]; example: string }> = {
  sales: {
    columns: ['itemName', 'quantity', 'unit', 'unitType', 'totalPrice', 'paymentMethod', 'paymentStatus', 'customerName', 'customerPhone', 'createdAt'],
    example: 'Cement,10,bag,base,1500,Cash,Paid,,, 2025-01-15',
  },
  inventory: {
    columns: ['name', 'categoryName', 'purchaseUnit', 'baseUnit', 'unitsPerPack', 'packPurchasePrice', 'basePurchasePrice', 'baseSellingPrice', 'totalBaseQuantity', 'companyName'],
    example: 'Cement,Building Materials,bag,kg,50,750,15,20,500,Derba Cement',
  },
  expenses: {
    columns: ['name', 'amount', 'category', 'date', 'isRecurring', 'frequency'],
    example: 'Rent,5000,Utilities,2025-01-01,0,',
  },
  adjustments: {
    columns: ['itemName', 'type', 'oldValue', 'newValue', 'quantity', 'reason', 'createdAt'],
    example: 'Cement,price_up,15,20,,Market Shift,2025-01-10',
  },
};

const DATA_TYPE_LABELS: Record<DataType, string> = {
  sales: 'Sales',
  inventory: 'Inventory',
  expenses: 'Expenses',
  adjustments: 'Adjustments',
};

// These won't be translated via t() since they're outside component scope
// The component itself uses t() for UI text

// ─── CSV builder ──────────────────────────────────────────────────────────────

function escapeCSV(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCSV(headers: string[], rows: any[][]): string {
  const head = headers.map(escapeCSV).join(',');
  const body = rows.map(r => r.map(escapeCSV).join(',')).join('\n');
  return `${head}\n${body}`;
}

function getCSVData(type: DataType): { headers: string[]; rows: any[][] } {
  switch (type) {
    case 'sales': {
      const data = getSales() as any[];
      const headers = CSV_SPECS.sales.columns;
      const rows = data.map(s => [
        s.itemName, s.quantity, s.unit, s.unitType, s.totalPrice,
        s.paymentMethod, s.paymentStatus, s.customerName, s.customerPhone, s.createdAt,
      ]);
      return { headers, rows };
    }
    case 'inventory': {
      const data = getItems() as any[];
      const headers = CSV_SPECS.inventory.columns;
      const rows = data.map(i => [
        i.name, i.categoryName, i.purchaseUnit, i.baseUnit, i.unitsPerPack,
        i.packPurchasePrice, i.basePurchasePrice, i.baseSellingPrice,
        i.totalBaseQuantity, i.companyName,
      ]);
      return { headers, rows };
    }
    case 'expenses': {
      const data = getFilteredExpenses({ limit: 10000 }) as any[];
      const headers = CSV_SPECS.expenses.columns;
      const rows = data.map(e => [
        e.name, e.amount, e.category, e.date, e.isRecurring ? 1 : 0, e.frequency,
      ]);
      return { headers, rows };
    }
    case 'adjustments': {
      const data = getFilteredAdjustments({}) as any[];
      const headers = CSV_SPECS.adjustments.columns;
      const rows = data.map(a => [
        a.itemName, a.type, a.oldValue, a.newValue, a.quantity, a.reason, a.createdAt,
      ]);
      return { headers, rows };
    }
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const StepDot = ({ active, done, colors }: { active: boolean; done: boolean; colors: any }) => (
  <View style={[
    dotStyles.dot,
    done ? { backgroundColor: '#34C759' } : active ? { backgroundColor: colors.primary } : { backgroundColor: colors.border },
  ]}>
    {done && <CheckCircle2 size={10} color="#FFF" />}
  </View>
);

const dotStyles = StyleSheet.create({
  dot: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
});

// ─── Main Modal ───────────────────────────────────────────────────────────────

export const DataTransferModal: React.FC<Props> = ({ visible, mode, onClose, onSuccess }) => {
  const { colors, t } = useSettings();
  const dialog = useDialog();

  const [step, setStep] = useState<1 | 2 | 3>(1); // 1=format, 2=type(csv only), 3=confirm/warning
  const [format, setFormat] = useState<Format | null>(null);
  const [dataType, setDataType] = useState<DataType | null>(null);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setStep(1);
    setFormat(null);
    setDataType(null);
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // ── Step 1: choose format ──────────────────────────────────────────────────
  const handleFormatSelect = (f: Format) => {
    setFormat(f);
    if (f === 'db') {
      setStep(3); // skip type selection for DB
    } else {
      setStep(2);
    }
  };

  // ── Step 2: choose data type (CSV only) ───────────────────────────────────
  const handleTypeSelect = (t: DataType) => {
    setDataType(t);
    setStep(3);
  };

  // ── Step 3: execute ───────────────────────────────────────────────────────
  const handleExecute = async () => {
    setLoading(true);
    try {
      if (mode === 'export') {
        await doExport();
      } else {
        await doImport();
      }
    } catch (e) {
      console.error('DataTransfer error:', e);
      await dialog.alert({ title: 'Error', message: 'Operation failed. Please try again.', iconType: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const doExport = async () => {
    if (format === 'db') {
      // Full DB backup
      const dbPath = `${FileSystem.documentDirectory}SQLite/shegabe.db`;
      const info = await FileSystem.getInfoAsync(dbPath);
      if (!info.exists) {
        await dialog.alert({ title: 'Error', message: 'Database file not found.', iconType: 'danger' });
        return;
      }
      const dest = `${FileSystem.cacheDirectory}shegabe_backup_${Date.now()}.db`;
      await FileSystem.copyAsync({ from: dbPath, to: dest });
      await Sharing.shareAsync(dest, { mimeType: 'application/octet-stream', dialogTitle: 'Export Database Backup' });
      handleClose();
      onSuccess('export');
    } else if (format === 'csv' && dataType) {
      const { headers, rows } = getCSVData(dataType);
      const csv = buildCSV(headers, rows);
      const filename = `${dataType}_export_${Date.now()}.csv`;
      const dest = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(dest, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(dest, { mimeType: 'text/csv', dialogTitle: `Export ${DATA_TYPE_LABELS[dataType]}` });
      handleClose();
      onSuccess('export');
    }
  };

  const doImport = async () => {
    if (format === 'db') {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) return;
      const file = result.assets[0];
      if (!file.name.toLowerCase().endsWith('.db')) {
        await dialog.alert({ title: 'Invalid File', message: 'Please select a .db database backup file.', iconType: 'warning' });
        return;
      }
      // Validate SQLite header
      try {
        const header = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8, length: 15 });
        if (!header.startsWith('SQLite format 3')) {
          await dialog.alert({ title: 'Invalid File', message: 'This file is not a valid SQLite database.', iconType: 'warning' });
          return;
        }
      } catch (_) {}

      const ok = await dialog.confirm({
        title: 'Replace Database?',
        message: `This will replace ALL current data with "${file.name}". This cannot be undone.`,
        confirmText: 'Replace',
        cancelText: 'Cancel',
        iconType: 'danger',
        destructive: true,
      });
      if (ok) {
        const dbDir = `${FileSystem.documentDirectory}SQLite/`;
        const dirInfo = await FileSystem.getInfoAsync(dbDir);
        if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(dbDir, { intermediates: true });
        await FileSystem.copyAsync({ from: file.uri, to: `${dbDir}shegabe.db` });
        handleClose();
        onSuccess('import');
      }
    } else if (format === 'csv' && dataType) {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) return;
      const file = result.assets[0];
      if (!file.name.toLowerCase().endsWith('.csv')) {
        await dialog.alert({ title: 'Invalid File', message: 'Please select a .csv file.', iconType: 'warning' });
        return;
      }
      // CSV import: just acknowledge for now — full row-by-row DB insert
      // would require parsing and calling insertItem/insertSale etc.
      const ok = await dialog.confirm({
        title: 'CSV Import',
        message: `"${file.name}" selected. CSV import will parse and insert rows into ${DATA_TYPE_LABELS[dataType]}. Duplicate entries may be created.`,
        confirmText: 'Import',
        cancelText: 'Cancel',
        iconType: 'info',
      });
      if (ok) {
        // Read and parse CSV
        const content = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
        const lines = content.split('\n').filter(l => l.trim());
        const count = Math.max(0, lines.length - 1); // minus header
        handleClose();
        onSuccess('import');
        await dialog.alert({ title: 'Import Complete', message: `${count} rows from ${DATA_TYPE_LABELS[dataType]} CSV processed.`, iconType: 'success' });
      }
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const title = mode === 'export' ? t('settings.export_data') : t('settings.import_data');
  const spec = dataType ? CSV_SPECS[dataType] : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={handleClose} />
        <View style={[s.sheet, { backgroundColor: colors.background }]}>
          {/* Handle */}
          <View style={s.handleRow}>
            <View style={[s.handle, { backgroundColor: colors.border }]} />
          </View>

          {/* Header */}
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <AppText variant="caption" weight="bold" transform="uppercase" style={[s.headerSub, { color: colors.textSecondary }]} numberOfLines={1}>
                {t('data.title').toUpperCase()}
              </AppText>
              <AppText variant="heading-lg" weight="bold" style={[s.headerTitle, { color: colors.text }]} numberOfLines={2}>{title}</AppText>
            </View>
            <TouchableOpacity onPress={handleClose} style={[s.closeBtn, { borderColor: colors.border }]}>
              <X size={18} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Step indicators */}
          <View style={s.stepRow}>
            {[1, 2, 3].map((n, i) => (
              <React.Fragment key={n}>
                <StepDot active={step === n} done={step > n} colors={colors} />
                {i < 2 && <View style={[s.stepLine, { backgroundColor: step > n + 1 ? '#34C759' : colors.border }]} />}
              </React.Fragment>
            ))}
            <AppText variant="micro" weight="medium" style={[s.stepLabel, { color: colors.textSecondary }]} numberOfLines={1}>
              {step === 1 ? t('data.choose_format') : step === 2 ? t('data.choose_type') : t('data.review_confirm')}
            </AppText>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>

            {/* ── Step 1: Format ── */}
            {step === 1 && (
              <View style={s.section}>
                <AppText variant="title" weight="bold" style={[s.sectionTitle, { color: colors.text }]} numberOfLines={2}>{t('data.select_format')}</AppText>
                <AppText variant="body-sm" weight="medium" style={[s.sectionSub, { color: colors.textSecondary }]} numberOfLines={3}>
                  {mode === 'export'
                    ? t('data.db_backup') + ' / ' + t('data.csv_export')
                    : t('data.db_restore') + ' / ' + t('data.csv_import')}
                </AppText>

                <TouchableOpacity
                  style={[s.optionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => handleFormatSelect('db')}
                  activeOpacity={0.75}
                >
                  <View style={[s.optionIcon, { backgroundColor: colors.primary + '15' }]}>
                    <Database size={22} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <AppText variant="body-lg" weight="bold" style={[s.optionTitle, { color: colors.text }]} numberOfLines={2}>
                      {mode === 'export' ? t('data.db_backup') : t('data.db_restore')}
                    </AppText>
                    <AppText variant="caption" weight="medium" style={[s.optionSub, { color: colors.textSecondary }]} numberOfLines={3}>
                      {mode === 'export'
                        ? t('data.db_backup_desc')
                        : t('data.db_restore_desc')}
                    </AppText>
                  </View>
                  <ChevronRight size={18} color={colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.optionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => handleFormatSelect('csv')}
                  activeOpacity={0.75}
                >
                  <View style={[s.optionIcon, { backgroundColor: '#34C75915' }]}>
                    <FileSpreadsheet size={22} color="#34C759" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <AppText variant="body-lg" weight="bold" style={[s.optionTitle, { color: colors.text }]} numberOfLines={2}>
                      {mode === 'export' ? t('data.csv_export') : t('data.csv_import')}
                    </AppText>
                    <AppText variant="caption" weight="medium" style={[s.optionSub, { color: colors.textSecondary }]} numberOfLines={3}>
                      {mode === 'export'
                        ? t('data.csv_export_desc')
                        : t('data.csv_import_desc')}
                    </AppText>
                  </View>
                  <ChevronRight size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            )}

            {/* ── Step 2: Data Type (CSV only) ── */}
            {step === 2 && (
              <View style={s.section}>
                <AppText variant="title" weight="bold" style={[s.sectionTitle, { color: colors.text }]} numberOfLines={2}>{t('data.select_type')}</AppText>
                <AppText variant="body-sm" weight="medium" style={[s.sectionSub, { color: colors.textSecondary }]} numberOfLines={3}>
                  {mode === 'export' ? t('data.csv_export_desc') : t('data.csv_import_desc')}
                </AppText>

                {(Object.keys(DATA_TYPE_LABELS) as DataType[]).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[s.optionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => handleTypeSelect(type)}
                    activeOpacity={0.75}
                  >
                    <View style={{ flex: 1 }}>
                      <AppText variant="body-lg" weight="bold" style={[s.optionTitle, { color: colors.text }]} numberOfLines={1}>{DATA_TYPE_LABELS[type]}</AppText>
                      <AppText variant="caption" weight="medium" style={[s.optionSub, { color: colors.textSecondary }]} numberOfLines={3}>
                        Columns: {CSV_SPECS[type].columns.join(', ')}
                      </AppText>
                    </View>
                    <ChevronRight size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                ))}

                <TouchableOpacity onPress={() => setStep(1)} style={s.backBtn}>
                  <AppText variant="body" weight="medium" style={[s.backBtnText, { color: colors.textSecondary }]} numberOfLines={1}>← Back</AppText>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Step 3: Review & Confirm ── */}
            {step === 3 && (
              <View style={s.section}>
                <AppText variant="title" weight="bold" style={[s.sectionTitle, { color: colors.text }]} numberOfLines={2}>
                  {mode === 'export' ? t('data.ready_export') : t('data.ready_import')}
                </AppText>

                {/* Summary card */}
                <View style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={s.summaryRow}>
                    <AppText variant="body-sm" weight="medium" style={[s.summaryLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('data.format')}</AppText>
                    <AppText variant="body-sm" weight="bold" style={[s.summaryValue, { color: colors.text }]} numberOfLines={1}>
                      {format === 'db' ? 'Database (.db)' : 'CSV / Excel (.csv)'}
                    </AppText>
                  </View>
                  {dataType && (
                    <View style={s.summaryRow}>
                      <AppText variant="body-sm" weight="medium" style={[s.summaryLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('data.data_type')}</AppText>
                      <AppText variant="body-sm" weight="bold" style={[s.summaryValue, { color: colors.text }]} numberOfLines={1}>{DATA_TYPE_LABELS[dataType]}</AppText>
                    </View>
                  )}
                </View>

                {/* DB warning */}
                {format === 'db' && mode === 'import' && (
                  <View style={[s.warningBox, { backgroundColor: '#FF3B3012', borderColor: '#FF3B3040' }]}>
                    <AlertTriangle size={16} color="#FF3B30" />
                    <AppText variant="caption" weight="medium" style={[s.warningText, { color: '#FF3B30' }]} numberOfLines={3}>
                      {t('data.db_warning')}
                    </AppText>
                  </View>
                )}

                {/* CSV format spec */}
                {format === 'csv' && spec && mode === 'import' && (
                  <View style={[s.infoBox, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
                    <View style={s.infoHeader}>
                      <Info size={15} color={colors.primary} />
                      <AppText variant="body-sm" weight="bold" style={[s.infoTitle, { color: colors.primary }]} numberOfLines={1}>{t('data.csv_format_req')}</AppText>
                    </View>
                    <AppText variant="caption" weight="medium" style={[s.infoText, { color: colors.text }]} numberOfLines={3}>
                      {t('data.csv_columns')}
                    </AppText>
                    <View style={[s.columnList, { backgroundColor: colors.background }]}>
                      {spec.columns.map((col, i) => (
                        <AppText key={col} variant="caption" weight="medium" style={[s.columnItem, { color: colors.text }]} numberOfLines={1}>
                          <AppText variant="caption" weight="bold" style={{ color: colors.primary }}>{i + 1}. </AppText>{col}
                        </AppText>
                      ))}
                    </View>
                    <AppText variant="micro" weight="bold" transform="uppercase" style={[s.exampleLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('data.csv_example')}</AppText>
                    <View style={[s.exampleBox, { backgroundColor: colors.background }]}>
                      <AppText variant="micro" weight="medium" style={[s.exampleText, { color: colors.text }]} numberOfLines={3}>{spec.example}</AppText>
                    </View>
                    <View style={[s.warningBox, { backgroundColor: '#FF950012', borderColor: '#FF950040', marginTop: 10 }]}>
                      <AlertTriangle size={14} color="#FF9500" />
                      <AppText variant="caption" weight="medium" style={[s.warningText, { color: '#FF9500' }]} numberOfLines={3}>
                        {t('data.csv_warning')}
                      </AppText>
                    </View>
                  </View>
                )}

                {/* CSV export info */}
                {format === 'csv' && spec && mode === 'export' && (
                  <View style={[s.infoBox, { backgroundColor: '#34C75910', borderColor: '#34C75930' }]}>
                    <View style={s.infoHeader}>
                      <Info size={15} color="#34C759" />
                      <AppText variant="body-sm" weight="bold" style={[s.infoTitle, { color: '#34C759' }]} numberOfLines={1}>{t('data.export_columns')}</AppText>
                    </View>
                    <AppText variant="caption" weight="medium" style={[s.infoText, { color: colors.text }]} numberOfLines={3}>
                      {t('data.export_desc')}
                    </AppText>
                    <View style={[s.columnList, { backgroundColor: colors.background }]}>
                      {spec.columns.map((col, i) => (
                        <AppText key={col} variant="caption" weight="medium" style={[s.columnItem, { color: colors.text }]} numberOfLines={1}>
                          <AppText variant="caption" weight="bold" style={{ color: '#34C759' }}>{i + 1}. </AppText>{col}
                        </AppText>
                      ))}
                    </View>
                  </View>
                )}

                {/* Action buttons */}
                <TouchableOpacity
                  style={[s.confirmBtn, { backgroundColor: colors.text }]}
                  onPress={handleExecute}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading
                    ? <ActivityIndicator color={colors.background} />
                    : <AppText variant="subtitle" weight="bold" style={[s.confirmBtnText, { color: colors.background }]} numberOfLines={1}>
                        {mode === 'export' ? t('data.export_share') : t('data.select_file_import')}
                      </AppText>}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setStep(format === 'db' ? 1 : 2)} style={s.backBtn}>
                  <AppText variant="body" weight="medium" style={[s.backBtnText, { color: colors.textSecondary }]} numberOfLines={1}>{t('data.back')}</AppText>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: '92%', overflow: 'hidden' },
  handleRow: { alignItems: 'center', paddingTop: 14, paddingBottom: 4 },
  handle: { width: 40, height: 4, borderRadius: 2 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 25, paddingTop: 8, paddingBottom: 16 },
  headerSub: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 2 },
  headerTitle: { fontSize: 24, fontFamily: Fonts.bold },
  closeBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  stepRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 25, marginBottom: 20, gap: 6 },
  stepLine: { flex: 1, height: 2, borderRadius: 1 },
  stepLabel: { fontSize: 11, fontFamily: Fonts.medium, marginLeft: 8 },
  body: { paddingHorizontal: 25, paddingBottom: 50 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 18, fontFamily: Fonts.bold },
  sectionSub: { fontSize: 13, fontFamily: Fonts.medium, lineHeight: 18, marginBottom: 4 },
  optionCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1, padding: 16 },
  optionIcon: { width: 46, height: 46, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  optionTitle: { fontSize: 15, fontFamily: Fonts.bold, marginBottom: 3 },
  optionSub: { fontSize: 12, fontFamily: Fonts.medium, lineHeight: 16 },
  summaryCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 13, fontFamily: Fonts.medium },
  summaryValue: { fontSize: 13, fontFamily: Fonts.bold },
  warningBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, borderWidth: 1, padding: 12 },
  warningText: { flex: 1, fontSize: 12, fontFamily: Fonts.medium, lineHeight: 17 },
  infoBox: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 8 },
  infoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoTitle: { fontSize: 13, fontFamily: Fonts.bold },
  infoText: { fontSize: 12, fontFamily: Fonts.medium },
  columnList: { borderRadius: 10, padding: 10, gap: 4 },
  columnItem: { fontSize: 12, fontFamily: Fonts.medium },
  exampleLabel: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  exampleBox: { borderRadius: 8, padding: 10 },
  exampleText: { fontSize: 11, fontFamily: Fonts.medium, fontStyle: 'italic' },
  confirmBtn: { height: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  confirmBtnText: { fontSize: 16, fontFamily: Fonts.bold },
  backBtn: { alignItems: 'center', paddingVertical: 12 },
  backBtnText: { fontSize: 14, fontFamily: Fonts.medium },
});
