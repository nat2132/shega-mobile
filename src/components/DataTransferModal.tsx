/**
 * DataTransferModal
 * Handles Export (DB backup or CSV per data type) and Import (DB restore or CSV).
 * CSV import includes: auto column mapping, validation, preview, error reporting.
 * Export includes: all modules, record counts, format guide, and native sharing.
 */
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/context/ToastContext';
import {
    getFilteredExpenses,
    getItems,
    getSales,
    getCategories,
    getContacts,
    getWarehouses,
    getDB,
    getFilteredAdjustments,
} from '@/database/db';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
    AlertTriangle,
    CheckCircle2,
    ChevronRight,
    Database,
    Download,
    FileSpreadsheet,
    Info,
    X,
    UploadCloud,
    ArrowRight,
    Package,
    ShoppingCart,
    Receipt,
    Tag,
    Users,
    Warehouse,
    CreditCard,
    RotateCcw,
    Wrench,
    FileText,
    Share2,
} from 'lucide-react-native';
import React, { useState, useEffect, useCallback } from 'react';
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText, AppNumber } from '@/components/ui';
import {
    CSV_SPECS,
    parseCSV,
    autoMapColumns,
    validateRows,
    transformRows,
    executeImport,
    generateCSV,
    MappingResult,
    ValidationError,
} from '@/utils/csv-utils';

// ——— Types ————————————————————————————————————————————————————————————

type Mode = 'export' | 'import';
type Format = 'db' | 'csv';
type DataType = 'items' | 'sales' | 'expenses' | 'categories' | 'contacts' | 'adjustments' | 'warehouses' | 'debt_payments' | 'returns';

interface Props {
  visible: boolean;
  mode: Mode;
  onClose: () => void;
  onSuccess: (type: 'export' | 'import') => void;
}

interface ModuleInfo {
  key: DataType;
  label: string;
  icon: any;
  iconColor: string;
  count: number;
}

// ——— Constants ————————————————————————————————————————————————————————

const STEP_LABELS_EXPORT = ['dt.step_format', 'dt.step_select', 'dt.step_export'];
const STEP_LABELS_IMPORT = ['dt.step_format', 'dt.step_select', 'dt.step_guide', 'dt.step_map', 'dt.step_done'];

// ——— Sub-components ———————————————————————————————————————————————————

const StepIndicator = ({ steps, current, colors, t }: { steps: string[]; current: number; colors: any; t: (key: string) => string }) => (
  <View style={si.row}>
    {steps.map((label, i) => {
      const n = i + 1;
      const done = current > n;
      const active = current === n;
      return (
        <React.Fragment key={n}>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <View style={[
              si.dot,
              done ? { backgroundColor: colors.primary } : active ? { backgroundColor: colors.primary } : { backgroundColor: colors.border },
            ]}>
              {done && <CheckCircle2 size={10} color="#FFF" />}
            </View>
            <AppText variant="micro" weight={active || done ? 'bold' : 'medium'} style={{ color: active ? colors.primary : colors.textSecondary }}>{t(label)}</AppText>
          </View>
          {i < steps.length - 1 && <View style={[si.line, { backgroundColor: done ? colors.primary : colors.border }]} />}
        </React.Fragment>
      );
    })}
  </View>
);
const si = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 20, gap: 0 },
  dot: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  line: { flex: 1, height: 3, borderRadius: 2, marginTop: 10, marginHorizontal: 4 },
});

// ——— Main Modal ———————————————————————————————————————————————————————

export const DataTransferModal: React.FC<Props> = ({ visible, mode, onClose, onSuccess }) => {
  const { colors, t } = useSettings();
  const { showToast } = useToast();

  const [step, setStep] = useState(1);
  const [format, setFormat] = useState<Format | null>(null);
  const [dataType, setDataType] = useState<DataType | null>(null);
  const [loading, setLoading] = useState(false);

  // Export state
  const [selectedModules, setSelectedModules] = useState<DataType[]>([]);
  const [moduleCounts, setModuleCounts] = useState<Record<string, number>>({});

  // Import state
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<MappingResult | null>(null);
  const [manualOverrides, setManualOverrides] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [importResult, setImportResult] = useState<any>(null);
  const [fileName, setFileName] = useState('');

  // Load record counts when modal opens
  useEffect(() => {
    if (visible && mode === 'export') {
      loadCounts();
    }
  }, [visible, mode]);

  const loadCounts = useCallback(() => {
    try {
      const database = getDB();
      const counts: Record<string, number> = {};
      const tables: [string, string][] = [
        ['items', 'items'],
        ['sales', 'sales'],
        ['expenses', 'expenses'],
        ['categories', 'categories'],
        ['contacts', 'contacts'],
        ['adjustments', 'adjustments'],
        ['warehouses', 'warehouses'],
        ['debt_payments', 'debt_payments'],
        ['returns', 'returns'],
      ];
      for (const [key, table] of tables) {
        try {
          const row = database.getFirstSync<{ c: number }>(`SELECT COUNT(*) as c FROM ${table}`);
          counts[key] = row?.c || 0;
        } catch { counts[key] = 0; }
      }
      setModuleCounts(counts);
    } catch (e) {
      console.error('Failed to load counts:', e);
    }
  }, []);

  const reset = () => {
    setStep(1);
    setFormat(null);
    setDataType(null);
    setLoading(false);
    setSelectedModules([]);
    setCsvData([]);
    setCsvHeaders([]);
    setMapping(null);
    setManualOverrides({});
    setValidationErrors([]);
    setImportResult(null);
    setFileName('');
  };

  const handleClose = () => { reset(); onClose(); };

  const handleFormatSelect = (f: Format) => {
    setFormat(f);
    if (f === 'db') {
      if (mode === 'export') {
        setStep(3); // Go directly to export review
      } else {
        setStep(3); // Go directly to import execute
      }
    } else {
      setStep(2); // CSV → pick data type
    }
  };

  const handleTypeSelect = (type: DataType) => {
    setDataType(type);
    if (mode === 'export') {
      setStep(3); // Export review
    } else {
      setStep(3); // Import guidelines
    }
  };

  // ——— Export Logic ————————————————————————————————————————————————————

  const getDataForModule = (moduleKey: string): any[] => {
    try {
      const database = getDB();
      switch (moduleKey) {
        case 'items': return getItems() as any[];
        case 'sales': return getSales() as any[];
        case 'expenses': return getFilteredExpenses({ limit: 999999 }) as any[];
        case 'categories': return getCategories() as any[];
        case 'contacts': return getContacts() as any[];
        case 'adjustments': return getFilteredAdjustments() as any[];
        case 'warehouses': return getWarehouses() as any[];
        case 'debt_payments': return database.getAllSync('SELECT * FROM debt_payments ORDER BY id DESC') as any[];
        case 'returns': return database.getAllSync('SELECT r.*, i.name as itemName FROM returns r LEFT JOIN items i ON r.itemId = i.id ORDER BY r.id DESC') as any[];
        default: return [];
      }
    } catch { return []; }
  };

  const handleExportDB = async () => {
    setLoading(true);
    try {
      const dbPath = `${FileSystem.documentDirectory}SQLite/shegabe.db`;
      const info = await FileSystem.getInfoAsync(dbPath);
      if (!info.exists) {
        showToast(t('data.db_not_found'), 'error');
        return;
      }
      const dest = `${FileSystem.cacheDirectory}shegabe_backup_${new Date().toISOString().split('T')[0]}_${Date.now()}.db`;
      await FileSystem.copyAsync({ from: dbPath, to: dest });
      await Sharing.shareAsync(dest, { mimeType: 'application/octet-stream', dialogTitle: t('data.export_backup_title') });
      showToast({ title: t('data.backup_exported'), message: t('data.backup_exported_msg'), type: 'success' });
      handleClose();
      onSuccess('export');
    } catch (e) {
      console.error('DB export error:', e);
      showToast(t('data.operation_failed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    if (!dataType) return;
    setLoading(true);
    try {
      const spec = CSV_SPECS[dataType];
      if (!spec) return;

      const data = getDataForModule(dataType);
      const csv = generateCSV(spec.columns, data);
      const filename = `${spec.name.replace(/\s+/g, '_')}_Export_${new Date().toISOString().split('T')[0]}.csv`;
      const dest = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(dest, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(dest, { mimeType: 'text/csv', dialogTitle: `Export ${spec.name}` });
      showToast({ title: `${spec.name} Exported`, message: `${data.length} records exported to CSV`, type: 'success' });
      handleClose();
      onSuccess('export');
    } catch (e) {
      console.error('CSV export error:', e);
      showToast(t('data.operation_failed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  // ——— Import Logic ———————————————————————————————————————————————————

  const handlePickFile = async () => {
    if (format === 'db') {
      setLoading(true);
      try {
        const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
        if (result.canceled || !result.assets?.length) { setLoading(false); return; }
        const file = result.assets[0];
        if (!file.name.toLowerCase().endsWith('.db')) {
          showToast('Please select a .db file', 'warning');
          setLoading(false);
          return;
        }
        const dbPath = `${FileSystem.documentDirectory}SQLite/shegabe.db`;
        await FileSystem.copyAsync({ from: file.uri, to: dbPath });
        showToast({ title: 'Database Restored', message: 'Your data has been restored from backup. Please restart the app.', type: 'success' });
        handleClose();
        onSuccess('import');
      } catch (e: any) {
        showToast(e.message || 'Failed to restore database', 'error');
      } finally {
        setLoading(false);
      }
      return;
    }

    // CSV file pick
    setLoading(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) { setLoading(false); return; }
      const file = result.assets[0];
      if (!file.name.toLowerCase().endsWith('.csv')) {
        showToast(t('data.select_csv_file'), 'warning');
        setLoading(false);
        return;
      }

      setFileName(file.name);
      const content = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
      const { headers, rows } = parseCSV(content);

      if (headers.length === 0 || rows.length === 0) {
        showToast(t('data.csv_no_data'), 'warning');
        setLoading(false);
        return;
      }

      setCsvHeaders(headers);
      setCsvData(rows);

      const spec = CSV_SPECS[dataType!];
      const colMapping = autoMapColumns(headers, spec);
      setMapping(colMapping);

      const initialOverrides: Record<string, string> = {};
      colMapping.mappings.forEach(m => { initialOverrides[m.csvColumn] = m.dbField; });
      setManualOverrides(initialOverrides);

      revalidate(rows, initialOverrides, spec);
      setStep(4);
    } catch (e) {
      showToast('Failed to pick file', 'error');
    } finally {
      setLoading(false);
    }
  };

  const revalidate = (rows: Record<string, string>[], overrides: Record<string, string>, spec: any) => {
    const activeMappings = Object.entries(overrides)
      .filter(([_, dbField]) => dbField !== 'IGNORE')
      .map(([csvColumn, dbField]) => ({ csvColumn, dbField }));
    const errors = validateRows(rows, activeMappings, spec);
    setValidationErrors(errors);
  };

  const handleMappingChange = (csvCol: string, dbCol: string) => {
    const newOverrides = { ...manualOverrides, [csvCol]: dbCol };
    setManualOverrides(newOverrides);
    if (dataType && mapping) {
      const spec = CSV_SPECS[dataType];
      const mappedDBFields = new Set(Object.values(newOverrides));
      const newMissing = spec.requiredColumns.filter(c => !mappedDBFields.has(c));
      setMapping({ ...mapping, missingRequired: newMissing });
      revalidate(csvData, newOverrides, spec);
    }
  };

  const handleImportConfirm = async () => {
    setLoading(true);
    try {
      const spec = CSV_SPECS[dataType!];
      const activeMappings = Object.entries(manualOverrides)
        .filter(([_, dbField]) => dbField !== 'IGNORE')
        .map(([csvColumn, dbField]) => ({ csvColumn, dbField }));
      const transformed = transformRows(csvData, activeMappings, spec);
      const result = await executeImport(transformed, dataType!);
      setImportResult(result);
      setStep(5);
      showToast({ title: t('data.import_complete'), message: `${result.imported} records imported`, type: 'success' });
    } catch (e: any) {
      showToast(e.message || t('data.import_failed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateDownload = async () => {
    if (!dataType) return;
    const spec = CSV_SPECS[dataType];
    const csv = generateCSV(spec.columns);
    const filename = `${spec.name.replace(/\s+/g, '_')}_Template.csv`;
    const dest = `${FileSystem.cacheDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(dest, csv, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(dest, { mimeType: 'text/csv', dialogTitle: t('dt.download_template') });
  };

  // ——— Module metadata ————————————————————————————————————————————————

  const getModuleIcon = (key: DataType): any => {
    switch (key) {
      case 'items': return Package;
      case 'sales': return ShoppingCart;
      case 'expenses': return Receipt;
      case 'categories': return Tag;
      case 'contacts': return Users;
      case 'adjustments': return Wrench;
      case 'warehouses': return Warehouse;
      case 'debt_payments': return CreditCard;
      case 'returns': return RotateCcw;
      default: return FileText;
    }
  };

  const getModuleColor = (key: DataType): string => {
    switch (key) {
      case 'items': return colors.primary;
      case 'sales': return colors.success;
      case 'expenses': return colors.warning;
      case 'categories': return '#8B5CF6';
      case 'contacts': return '#06B6D4';
      case 'adjustments': return '#F59E0B';
      case 'warehouses': return '#10B981';
      case 'debt_payments': return colors.error;
      case 'returns': return '#EC4899';
      default: return colors.textSecondary;
    }
  };

  const DATA_TYPE_LABELS: Record<DataType, string> = {
    items: 'dt.inventory_items',
    sales: 'dt.sales_records',
    expenses: 'dt.expenses',
    categories: 'dt.categories',
    contacts: 'dt.contacts',
    adjustments: 'dt.adjustments',
    warehouses: 'dt.warehouses',
    debt_payments: 'dt.debt_payments',
    returns: 'dt.returns',
  };

  // ——— Determine steps ————————————————————————————————————————————————

  const totalSteps = mode === 'export' ? 3 : 5;
  const stepLabels = mode === 'export' ? STEP_LABELS_EXPORT : STEP_LABELS_IMPORT;
  const title = mode === 'export' ? t('settings.export_data') : t('settings.import_data');

  const stepTitle = (() => {
    if (mode === 'export') {
      if (step === 1) return t('dt.choose_format');
      if (step === 2) return t('dt.select_data');
      return t('dt.review_export');
    } else {
      if (step === 1) return 'Choose Format';
      if (step === 2) return t('dt.select_data_type');
      if (step === 3) return t('dt.formatting_guide');
      if (step === 4) return t('dt.validate_map');
      return t('dt.import_complete');
    }
  })();

  // ——— Render ——————————————————————————————————————————————————————————

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={handleClose} />
        <View style={[s.sheet, { backgroundColor: colors.background }]}>
          <View style={s.handleRow}>
            <View style={[s.handle, { backgroundColor: colors.border }]} />
          </View>

          {/* Header */}
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <AppText variant="caption" weight="bold" transform="uppercase" style={[s.headerSub, { color: colors.textSecondary }]} numberOfLines={1}>
                {title.toUpperCase()}
              </AppText>
              <AppText variant="heading-lg" weight="bold" style={[s.headerTitle, { color: colors.text }]} numberOfLines={2}>
                {stepTitle}
              </AppText>
            </View>
            <TouchableOpacity onPress={handleClose} style={[s.closeBtn, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <X size={18} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Step indicator */}
          <StepIndicator steps={stepLabels} current={step} colors={colors} />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>

            {/* ══════ STEP 1: Choose Format ══════ */}
            {step === 1 && (
              <Animated.View entering={FadeInDown.duration(300)} style={s.section}>
                <TouchableOpacity style={[s.formatCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => handleFormatSelect('db')} activeOpacity={0.7}>
                  <View style={[s.formatIcon, { backgroundColor: colors.primary + '15' }]}>
                    <Database size={26} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 16 }}>
                    <AppText variant="body-lg" weight="bold" style={{ color: colors.text }}>Full Database Backup</AppText>
                    <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary, marginTop: 4, lineHeight: 18 }}>
                      {mode === 'export' ? t('dt.full_backup_desc') : t('dt.full_backup_desc_import')}
                    </AppText>
                  </View>
                  <ChevronRight size={18} color={colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity style={[s.formatCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => handleFormatSelect('csv')} activeOpacity={0.7}>
                  <View style={[s.formatIcon, { backgroundColor: colors.success + '15' }]}>
                    <FileSpreadsheet size={26} color={colors.success} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 16 }}>
                    <AppText variant="body-lg" weight="bold" style={{ color: colors.text }}>Spreadsheet (CSV)</AppText>
                    <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary, marginTop: 4, lineHeight: 18 }}>
                      {mode === 'export' ? t('dt.spreadsheet_desc_export') : t('dt.spreadsheet_desc_import')}
                    </AppText>
                  </View>
                  <ChevronRight size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* ══════ STEP 2: Select Data Type ══════ */}
            {step === 2 && (
              <Animated.View entering={FadeInDown.duration(300)} style={s.section}>
                {(Object.keys(DATA_TYPE_LABELS) as DataType[]).map((key) => {
                  const Icon = getModuleIcon(key);
                  const iconColor = getModuleColor(key);
                  const count = moduleCounts[key] || 0;
                  return (
                    <TouchableOpacity key={key} style={[s.moduleCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => handleTypeSelect(key)} activeOpacity={0.7}>
                      <View style={[s.moduleIcon, { backgroundColor: iconColor + '15' }]}>
                        <Icon size={20} color={iconColor} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 14 }}>
                        <AppText variant="body" weight="bold" style={{ color: colors.text }}>{DATA_TYPE_LABELS[key]}</AppText>
                        {mode === 'export' && (
                          <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary, marginTop: 2 }}>
                            {count} {count === 1 ? 'record' : 'records'}
                          </AppText>
                        )}
                      </View>
                      <ChevronRight size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity onPress={() => setStep(1)} style={s.backBtn}>
                  <AppText variant="body" weight="medium" style={{ color: colors.textSecondary }}>Back</AppText>
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* ══════ STEP 3 — EXPORT: Review & Execute ══════ */}
            {step === 3 && mode === 'export' && format === 'db' && (
              <Animated.View entering={FadeInDown.duration(300)} style={s.section}>
                <View style={[s.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <AppText variant="body-lg" weight="bold" style={{ color: colors.text, marginBottom: 12 }}>Export Summary</AppText>

                  <View style={s.reviewRow}>
                    <AppText variant="body-sm" weight="medium" style={{ color: colors.textSecondary }}>Format</AppText>
                    <AppText variant="body-sm" weight="bold" style={{ color: colors.text }}>SQLite Database (.db)</AppText>
                  </View>
                  <View style={s.reviewRow}>
                    <AppText variant="body-sm" weight="medium" style={{ color: colors.textSecondary }}>Scope</AppText>
                    <AppText variant="body-sm" weight="bold" style={{ color: colors.text }}>All Data</AppText>
                  </View>
                  <View style={[s.reviewRow, { borderBottomWidth: 0 }]}>
                    <AppText variant="body-sm" weight="medium" style={{ color: colors.textSecondary }}>Total Records</AppText>
                    <AppText variant="body-sm" weight="bold" style={{ color: colors.primary }}>
                      {Object.values(moduleCounts).reduce((a, b) => a + b, 0)}
                    </AppText>
                  </View>
                </View>

                <View style={[s.infoBox, { backgroundColor: colors.primary + '08', borderColor: colors.primary + '20' }]}>
                  <Info size={18} color={colors.primary} />
                  <AppText variant="caption" weight="medium" style={{ color: colors.primary, flex: 1, lineHeight: 18 }}>
                    This creates an exact copy of your entire database. You can use it to restore your data on any device running this app.
                  </AppText>
                </View>

                <TouchableOpacity style={[s.primaryBtn, { backgroundColor: loading ? colors.border : colors.primary }]} onPress={handleExportDB} disabled={loading} activeOpacity={0.8}>
                  {loading ? <ActivityIndicator color="#FFF" /> : (
                    <>
                      <Share2 size={20} color="#FFF" style={{ marginRight: 8 }} />
                      <AppText variant="body" weight="bold" style={{ color: '#FFF' }}>Export & Share</AppText>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setStep(1)} style={s.backBtn}>
                  <AppText variant="body" weight="medium" style={{ color: colors.textSecondary }}>Back</AppText>
                </TouchableOpacity>
              </Animated.View>
            )}

            {step === 3 && mode === 'export' && format === 'csv' && dataType && (
              <Animated.View entering={FadeInDown.duration(300)} style={s.section}>
                <View style={[s.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <AppText variant="body-lg" weight="bold" style={{ color: colors.text, marginBottom: 12 }}>Export Summary</AppText>

                  <View style={s.reviewRow}>
                    <AppText variant="body-sm" weight="medium" style={{ color: colors.textSecondary }}>Format</AppText>
                    <AppText variant="body-sm" weight="bold" style={{ color: colors.text }}>CSV Spreadsheet</AppText>
                  </View>
                  <View style={s.reviewRow}>
                    <AppText variant="body-sm" weight="medium" style={{ color: colors.textSecondary }}>Data</AppText>
                    <AppText variant="body-sm" weight="bold" style={{ color: colors.text }}>{DATA_TYPE_LABELS[dataType]}</AppText>
                  </View>
                  <View style={s.reviewRow}>
                    <AppText variant="body-sm" weight="medium" style={{ color: colors.textSecondary }}>Records</AppText>
                    <AppText variant="body-sm" weight="bold" style={{ color: colors.primary }}>{moduleCounts[dataType] || 0}</AppText>
                  </View>
                  <View style={[s.reviewRow, { borderBottomWidth: 0 }]}>
                    <AppText variant="body-sm" weight="medium" style={{ color: colors.textSecondary }}>Columns</AppText>
                    <AppText variant="body-sm" weight="bold" style={{ color: colors.text }}>{CSV_SPECS[dataType].columns.length}</AppText>
                  </View>
                </View>

                {/* Column preview */}
                <View style={[s.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <AppText variant="body-sm" weight="bold" style={{ color: colors.text, marginBottom: 10 }}>Included Columns</AppText>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {CSV_SPECS[dataType].columns.map((col, i) => (
                      <View key={i} style={[s.colChip, {
                        backgroundColor: col.required ? colors.primary + '12' : colors.card,
                        borderColor: col.required ? colors.primary + '30' : colors.border,
                      }]}>
                        <AppText variant="micro" weight={col.required ? 'bold' : 'medium'} style={{ color: col.required ? colors.primary : colors.textSecondary }}>
                          {col.label}{col.required ? ' *' : ''}
                        </AppText>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={[s.infoBox, { backgroundColor: colors.success + '08', borderColor: colors.success + '20' }]}>
                  <FileSpreadsheet size={18} color={colors.success} />
                  <AppText variant="caption" weight="medium" style={{ color: colors.success, flex: 1, lineHeight: 18 }}>
                    CSV files can be opened in Excel, Google Sheets, or imported back into this app.
                  </AppText>
                </View>

                <TouchableOpacity style={[s.primaryBtn, { backgroundColor: loading ? colors.border : colors.success }]} onPress={handleExportCSV} disabled={loading} activeOpacity={0.8}>
                  {loading ? <ActivityIndicator color="#FFF" /> : (
                    <>
                      <Share2 size={20} color="#FFF" style={{ marginRight: 8 }} />
                      <AppText variant="body" weight="bold" style={{ color: '#FFF' }}>Export {DATA_TYPE_LABELS[dataType]}</AppText>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setStep(2)} style={s.backBtn}>
                  <AppText variant="body" weight="medium" style={{ color: colors.textSecondary }}>Back</AppText>
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* ══════ STEP 3 — IMPORT: DB Restore ══════ */}
            {step === 3 && mode === 'import' && format === 'db' && (
              <Animated.View entering={FadeInDown.duration(300)} style={s.section}>
                <View style={[s.warningBox, { backgroundColor: colors.error + '10', borderColor: colors.error + '30' }]}>
                  <AlertTriangle size={20} color={colors.error} />
                  <AppText variant="body-sm" weight="medium" style={{ color: colors.error, flex: 1, lineHeight: 18 }}>
                    Restoring a database backup will replace ALL current data. This action cannot be undone. Consider exporting a backup first.
                  </AppText>
                </View>

                <TouchableOpacity style={[s.primaryBtn, { backgroundColor: loading ? colors.border : colors.text }]} onPress={handlePickFile} disabled={loading}>
                  {loading ? <ActivityIndicator color={colors.background} /> : (
                    <>
                      <UploadCloud size={20} color={colors.background} style={{ marginRight: 8 }} />
                      <AppText variant="body" weight="bold" style={{ color: colors.background }}>Select .db File</AppText>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setStep(1)} style={s.backBtn}>
                  <AppText variant="body" weight="medium" style={{ color: colors.textSecondary }}>Back</AppText>
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* ══════ STEP 3 — IMPORT: CSV Guidelines ══════ */}
            {step === 3 && mode === 'import' && format === 'csv' && dataType && (
              <Animated.View entering={FadeInDown.duration(300)} style={s.section}>
                <View style={[s.guideCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <AppText variant="body-lg" weight="bold" style={{ color: colors.text, marginBottom: 10 }}>CSV Formatting Guide</AppText>
                  <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary, marginBottom: 16, lineHeight: 18 }}>
                    Format your CSV file according to these rules for a smooth import, or download our template.
                  </AppText>

                  {[
                    { label: t('dt.required_columns'), value: CSV_SPECS[dataType].requiredColumns.join(', ') },
                    { label: t('dt.date_format'), value: t('dt.date_format_example') },
                    { label: t('dt.boolean_format'), value: t('dt.boolean_format_example') },
                    { label: t('dt.numbers'), value: t('dt.numbers_example') },
                  ].map((item, i) => (
                    <View key={i} style={[s.guideRow, { borderBottomColor: colors.border }]}>
                      <AppText variant="caption" weight="bold" style={{ color: colors.text, flex: 0.4 }}>{item.label}</AppText>
                      <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary, flex: 0.6 }}>{item.value}</AppText>
                    </View>
                  ))}

                  <TouchableOpacity style={[s.templateBtn, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '25' }]} onPress={handleTemplateDownload}>
                    <Download size={18} color={colors.primary} />
                    <AppText variant="body-sm" weight="bold" style={{ color: colors.primary }}>Download Template</AppText>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={[s.primaryBtn, { backgroundColor: loading ? colors.border : colors.text }]} onPress={handlePickFile} disabled={loading}>
                  {loading ? <ActivityIndicator color={colors.background} /> : (
                    <>
                      <UploadCloud size={20} color={colors.background} style={{ marginRight: 8 }} />
                      <AppText variant="body" weight="bold" style={{ color: colors.background }}>Select CSV File</AppText>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setStep(2)} style={s.backBtn}>
                  <AppText variant="body" weight="medium" style={{ color: colors.textSecondary }}>Back</AppText>
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* ══════ STEP 4 — IMPORT: Validate & Map ══════ */}
            {step === 4 && mode === 'import' && format === 'csv' && dataType && mapping && (
              <Animated.View entering={FadeInDown.duration(300)} style={s.section}>
                {/* Stats */}
                <View style={s.statsRow}>
                  <View style={[s.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary }}>Rows</AppText>
                    <AppText variant="heading" weight="bold" style={{ color: colors.text }}>{csvData.length}</AppText>
                  </View>
                  <View style={[s.statBox, { backgroundColor: validationErrors.length > 0 ? colors.error + '10' : colors.success + '10', borderColor: validationErrors.length > 0 ? colors.error + '25' : colors.success + '25' }]}>
                    <AppText variant="caption" weight="medium" style={{ color: validationErrors.length > 0 ? colors.error : colors.success }}>Errors</AppText>
                    <AppText variant="heading" weight="bold" style={{ color: validationErrors.length > 0 ? colors.error : colors.success }}>{validationErrors.length}</AppText>
                  </View>
                </View>

                {/* Missing required */}
                {mapping.missingRequired.length > 0 && (
                  <View style={[s.warningBox, { backgroundColor: colors.error + '12', borderColor: colors.error + '30' }]}>
                    <AlertTriangle size={18} color={colors.error} />
                    <View style={{ flex: 1 }}>
                      <AppText variant="body-sm" weight="bold" style={{ color: colors.error }}>Missing Required Fields</AppText>
                      <AppText variant="caption" weight="medium" style={{ color: colors.error, marginTop: 4 }}>{mapping.missingRequired.join(', ')}</AppText>
                    </View>
                  </View>
                )}

                {/* Column Mapping */}
                <View style={[s.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <AppText variant="body-lg" weight="bold" style={{ color: colors.text, marginBottom: 6 }}>Column Mapping</AppText>
                  <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary, marginBottom: 14 }}>
                    Auto-mapped from your CSV headers. Tap a chip to change the mapping.
                  </AppText>

                  {csvHeaders.map((csvCol, idx) => {
                    const dbFields = CSV_SPECS[dataType].columns;
                    const currentValue = manualOverrides[csvCol] || 'IGNORE';
                    return (
                      <View key={idx} style={[s.mapRow, { borderBottomColor: colors.border }]}>
                        <AppText variant="body-sm" weight="bold" style={{ color: colors.text, width: 80 }} numberOfLines={1}>{csvCol}</AppText>
                        <ArrowRight size={12} color={colors.textSecondary} style={{ marginHorizontal: 6 }} />
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', gap: 5, paddingVertical: 4 }}>
                            <TouchableOpacity
                              style={[s.mapChip, currentValue === 'IGNORE' && { backgroundColor: colors.border }]}
                              onPress={() => handleMappingChange(csvCol, 'IGNORE')}
                            >
                              <AppText variant="micro" weight={currentValue === 'IGNORE' ? 'bold' : 'medium'} style={{ color: currentValue === 'IGNORE' ? colors.text : colors.textSecondary }}>Skip</AppText>
                            </TouchableOpacity>
                            {dbFields.map(f => (
                              <TouchableOpacity
                                key={f.key}
                                style={[s.mapChip, currentValue === f.key && { backgroundColor: colors.primary + '18', borderColor: colors.primary + '40', borderWidth: 1 }]}
                                onPress={() => handleMappingChange(csvCol, f.key)}
                              >
                                <AppText variant="micro" weight={currentValue === f.key ? 'bold' : 'medium'} style={{ color: currentValue === f.key ? colors.primary : colors.textSecondary }}>
                                  {f.label}{f.required ? '*' : ''}
                                </AppText>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </ScrollView>
                      </View>
                    );
                  })}
                </View>

                {/* Validation errors */}
                {validationErrors.length > 0 && (
                  <View style={[s.reviewCard, { backgroundColor: colors.error + '06', borderColor: colors.error + '18' }]}>
                    <AppText variant="body-sm" weight="bold" style={{ color: colors.error, marginBottom: 8 }}>Validation Details</AppText>
                    <ScrollView style={{ maxHeight: 120 }} showsVerticalScrollIndicator={false}>
                      {validationErrors.slice(0, 20).map((err, idx) => (
                        <AppText key={idx} variant="caption" weight="medium" style={{ color: colors.error, marginBottom: 4 }}>Row {err.row}: {err.message}</AppText>
                      ))}
                      {validationErrors.length > 20 && (
                        <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary, marginTop: 4 }}>+ {validationErrors.length - 20} more</AppText>
                      )}
                    </ScrollView>
                  </View>
                )}

                <TouchableOpacity
                  style={[s.primaryBtn, { backgroundColor: (loading || validationErrors.length > 0 || mapping.missingRequired.length > 0) ? colors.border : colors.success, marginTop: 8 }]}
                  onPress={handleImportConfirm}
                  disabled={loading || validationErrors.length > 0 || mapping.missingRequired.length > 0}
                >
                  {loading ? <ActivityIndicator color="#FFF" /> : (
                    <AppText variant="body" weight="bold" style={{ color: '#FFF' }}>Import {csvData.length} Rows</AppText>
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setStep(3)} style={s.backBtn}>
                  <AppText variant="body" weight="medium" style={{ color: colors.textSecondary }}>Back</AppText>
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* ══════ STEP 5 — IMPORT: Result ══════ */}
            {step === 5 && mode === 'import' && importResult && (
              <Animated.View entering={FadeInDown.duration(400).springify()} style={s.section}>
                <View style={{ alignItems: 'center', marginVertical: 16 }}>
                  <View style={[s.resultIcon, { backgroundColor: importResult.errors.length === 0 ? colors.success + '15' : colors.warning + '15' }]}>
                    {importResult.errors.length === 0 ? <CheckCircle2 size={52} color={colors.success} /> : <AlertTriangle size={52} color={colors.warning} />}
                  </View>
                  <AppText variant="heading-lg" weight="bold" style={{ color: colors.text, marginTop: 16 }}>
                    {importResult.errors.length === 0 ? t('dt.import_successful') : t('dt.completed_issues')}
                  </AppText>
                </View>

                <View style={s.statsRow}>
                  <View style={[s.statBox, { backgroundColor: colors.success + '10', borderColor: colors.success + '25' }]}>
                    <AppText variant="caption" weight="medium" style={{ color: colors.success }}>Imported</AppText>
                    <AppText variant="heading" weight="bold" style={{ color: colors.success }}>{importResult.imported}</AppText>
                  </View>
                  {importResult.skipped > 0 && (
                    <View style={[s.statBox, { backgroundColor: colors.warning + '10', borderColor: colors.warning + '25' }]}>
                      <AppText variant="caption" weight="medium" style={{ color: colors.warning }}>Skipped</AppText>
                      <AppText variant="heading" weight="bold" style={{ color: colors.warning }}>{importResult.skipped}</AppText>
                    </View>
                  )}
                </View>

                {importResult.errors.length > 0 && (
                  <View style={[s.reviewCard, { backgroundColor: colors.error + '06', borderColor: colors.error + '18', marginTop: 12 }]}>
                    <AppText variant="body-sm" weight="bold" style={{ color: colors.error, marginBottom: 8 }}>Skipped Row Details</AppText>
                    <ScrollView style={{ maxHeight: 120 }} showsVerticalScrollIndicator={false}>
                      {importResult.errors.slice(0, 15).map((err: string, idx: number) => (
                        <AppText key={idx} variant="caption" weight="medium" style={{ color: colors.error, marginBottom: 4 }}>• {err}</AppText>
                      ))}
                    </ScrollView>
                  </View>
                )}

                <TouchableOpacity style={[s.primaryBtn, { backgroundColor: colors.text, marginTop: 16 }]} onPress={handleClose}>
                  <AppText variant="body" weight="bold" style={{ color: colors.background }}>Done</AppText>
                </TouchableOpacity>
              </Animated.View>
            )}

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ——— Styles ———————————————————————————————————————————————————————————

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '92%', overflow: 'hidden' },
  handleRow: { alignItems: 'center', paddingTop: 16, paddingBottom: 8 },
  handle: { width: 44, height: 5, borderRadius: 3 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 16 },
  headerSub: { fontSize: 11, letterSpacing: 1.2, marginBottom: 4, fontFamily: Fonts.bold },
  headerTitle: { fontSize: 22, fontFamily: Fonts.bold },
  closeBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  body: { paddingHorizontal: 24, paddingBottom: 40 },
  section: { gap: 12 },
  // Format cards
  formatCard: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 20, borderWidth: 1 },
  formatIcon: { width: 52, height: 52, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  // Module cards
  moduleCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1 },
  moduleIcon: { width: 42, height: 42, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  // Review
  reviewCard: { padding: 18, borderRadius: 20, borderWidth: 1 },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(128,128,128,0.1)' },
  colChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  // Info / Warning
  infoBox: { flexDirection: 'row', padding: 16, borderRadius: 16, borderWidth: 1, gap: 12, alignItems: 'flex-start' },
  warningBox: { flexDirection: 'row', padding: 16, borderRadius: 16, borderWidth: 1, gap: 12, alignItems: 'flex-start' },
  // Guide
  guideCard: { padding: 20, borderRadius: 20, borderWidth: 1 },
  guideRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, gap: 8 },
  templateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16, borderWidth: 1, marginTop: 16 },
  // Stats
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statBox: { flex: 1, padding: 16, borderRadius: 16, borderWidth: 1, alignItems: 'center' },
  // Mapping
  mapRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  mapChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  // Buttons
  primaryBtn: { height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
  backBtn: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  // Result
  resultIcon: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center' },
});

export default DataTransferModal;