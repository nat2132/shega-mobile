/**
 * DataTransferModal
 * Handles Export (DB backup or CSV per data type) and Import (DB restore or CSV).
 * CSV import now includes: auto column mapping, validation, preview, error reporting.
 */
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/context/ToastContext';
import {
    getFilteredExpenses,
    getItems,
    getSales,
    getCategories,
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

// →→→ Types →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

type Mode = 'export' | 'import';
type Format = 'db' | 'csv';
type DataType = 'items' | 'sales' | 'expenses' | 'categories';

interface Props {
  visible: boolean;
  mode: Mode;
  onClose: () => void;
  onSuccess: (type: 'export' | 'import') => void;
}

const DATA_TYPE_LABELS: Record<DataType, string> = {
  items: 'data.items_label',
  sales: 'data.sales_label',
  expenses: 'data.expenses_label',
  categories: 'data.categories_label',
};

// →→→ Sub-components →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

const StepDot = ({ active, done, colors }: { active: boolean; done: boolean; colors: any }) => (
  <View style={[
    dotStyles.dot,
    done ? { backgroundColor: colors.primary } : active ? { backgroundColor: colors.primary } : { backgroundColor: colors.border },
  ]}>
    {done && <CheckCircle2 size={10} color="#FFF" />}
  </View>
);

const dotStyles = StyleSheet.create({
  dot: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
});

// →→→ Main Modal →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

export const DataTransferModal: React.FC<Props> = ({ visible, mode, onClose, onSuccess }) => {
  const { colors, t } = useSettings();
  const { showToast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [format, setFormat] = useState<Format | null>(null);
  const [dataType, setDataType] = useState<DataType | null>(null);
  const [loading, setLoading] = useState(false);

  // Import state
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<MappingResult | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [importResult, setImportResult] = useState<any>(null);
  const [fileName, setFileName] = useState('');

  const reset = () => {
    setStep(1);
    setFormat(null);
    setDataType(null);
    setLoading(false);
    setCsvData([]);
    setCsvHeaders([]);
    setMapping(null);
    setValidationErrors([]);
    setImportResult(null);
    setFileName('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // →→ Step 1: choose format →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
  const handleFormatSelect = (f: Format) => {
    setFormat(f);
    setStep(f === 'db' ? 3 : 2);
  };

  // →→ Step 2: choose data type →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
  const handleTypeSelect = (type: DataType) => {
    setDataType(type);
    setStep(mode === 'import' ? 3 : 3);
  };

  // →→ Step 3: execute →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
  const handleExecute = async () => {
    setLoading(true);
    try {
      if (mode === 'export') {
        await doExport();
      } else {
        await doImportPick();
      }
    } catch (e) {
      console.error('DataTransfer error:', e);
      showToast(t('data.operation_failed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  // →→ Export →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
  const doExport = async () => {
    if (format === 'db') {
      const dbPath = `${FileSystem.documentDirectory}SQLite/shegabe.db`;
      const info = await FileSystem.getInfoAsync(dbPath);
      if (!info.exists) {
        showToast(t('data.db_not_found'), 'error');
        return;
      }
      const dest = `${FileSystem.cacheDirectory}shegabe_backup_${Date.now()}.db`;
      await FileSystem.copyAsync({ from: dbPath, to: dest });
      await Sharing.shareAsync(dest, { mimeType: 'application/octet-stream', dialogTitle: t('data.export_backup_title') });
      showToast({ title: t('data.backup_exported'), message: t('data.backup_exported_msg'), type: 'success' });
      handleClose();
      onSuccess('export');
    } else if (format === 'csv' && dataType) {
      const spec = CSV_SPECS[dataType];
      if (!spec) return;

      let data: any[] = [];
      switch (dataType) {
        case 'sales': data = getSales() as any[]; break;
        case 'items': data = getItems() as any[]; break;
        case 'expenses': data = getFilteredExpenses({ limit: 10000 }) as any[]; break;
        case 'categories': {
          data = getCategories() as any[];
          break;
        }
      }

      const csv = generateCSV(spec.columns, data);
      const filename = `${spec.name.replace(/\s+/g, '_')}_Export_${new Date().toISOString().split('T')[0]}.csv`;
      const dest = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(dest, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(dest, { mimeType: 'text/csv', dialogTitle: `${t('settings.export_data')} ${spec.name}` });
      showToast({ title: `${spec.name} ${t('data.exported')}`, message: t('data.exported_to_csv', { count: data.length.toString() }), type: 'success' });
      handleClose();
      onSuccess('export');
    }
  };

  // →→ Import: pick file →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
  const doImportPick = async () => {
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

    // Auto-map columns
    const spec = CSV_SPECS[dataType!];
    const colMapping = autoMapColumns(headers, spec);
    setMapping(colMapping);

    // Validate
    const errors = validateRows(rows, colMapping.mappings, spec);
    setValidationErrors(errors);

    setLoading(false);
    setStep(4);
  };

  // →→ Import: confirm and execute →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
  const handleImportConfirm = async () => {
    setLoading(true);
    try {
      const spec = CSV_SPECS[dataType!];
      const transformed = transformRows(csvData, mapping!.mappings, spec);
      const result = await executeImport(transformed, dataType!);
      setImportResult(result);
      setStep(5);
      showToast({ title: t('data.import_complete'), message: t('data.import_records_added', { count: result.imported.toString(), name: spec.name }), type: 'success' });
    } catch (e: any) {
      showToast(e.message || t('data.import_failed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  // →→ Template download →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
  const handleTemplateDownload = async () => {
    if (!dataType) return;
    const spec = CSV_SPECS[dataType];
    const csv = generateCSV(spec.columns);
    const filename = `${spec.name.replace(/\s+/g, '_')}_Template.csv`;
    const dest = `${FileSystem.cacheDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(dest, csv, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(dest, { mimeType: 'text/csv', dialogTitle: `${t('data.download_template_csv')} ${spec.name}` });
    showToast({ title: t('data.template_ready'), message: t('data.template_downloaded', { name: spec.name }), type: 'success' });
  };

  // →→ Render →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

  const title = mode === 'export' ? t('settings.export_data') : t('settings.import_data');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={handleClose} />
        <View style={[s.sheet, { backgroundColor: colors.background }]}>
          <View style={s.handleRow}>
            <View style={[s.handle, { backgroundColor: colors.border }]} />
          </View>

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
                {i < 2 && <View style={[s.stepLine, { backgroundColor: step > n + 1 ? colors.primary : colors.border }]} />}
              </React.Fragment>
            ))}
            <AppText variant="micro" weight="medium" style={[s.stepLabel, { color: colors.textSecondary }]} numberOfLines={1}>
              {step === 1 ? t('data.choose_format') : step === 2 ? t('data.choose_type') : step === 4 ? t('data.preview_map') : step === 5 ? t('data.result') : t('data.review_confirm')}
            </AppText>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>

            {/* →→ Step 1: Format →→ */}
            {step === 1 && (
              <View style={s.section}>
                <AppText variant="title" weight="bold" style={[s.sectionTitle, { color: colors.text }]} numberOfLines={2}>{t('data.select_format')}</AppText>
                <AppText variant="body-sm" weight="medium" style={[s.sectionSub, { color: colors.textSecondary }]} numberOfLines={3}>
                  {mode === 'export' ? t('data.db_backup') + ' / ' + t('data.csv_export') : t('data.db_restore') + ' / ' + t('data.csv_import')}
                </AppText>

                <TouchableOpacity style={[s.optionCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => handleFormatSelect('db')} activeOpacity={0.75}>
                  <View style={[s.optionIcon, { backgroundColor: colors.primary + '15' }]}><Database size={22} color={colors.primary} /></View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <AppText variant="body-lg" weight="bold" style={[s.optionTitle, { color: colors.text }]} numberOfLines={2}>{mode === 'export' ? t('data.db_backup') : t('data.db_restore')}</AppText>
                    <AppText variant="caption" weight="medium" style={[s.optionSub, { color: colors.textSecondary }]} numberOfLines={3}>{mode === 'export' ? t('data.db_backup_desc') : t('data.db_restore_desc')}</AppText>
                  </View>
                  <ChevronRight size={18} color={colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity style={[s.optionCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => handleFormatSelect('csv')} activeOpacity={0.75}>
                  <View style={[s.optionIcon, { backgroundColor: colors.success + '15' }]}><FileSpreadsheet size={22} color={colors.success} /></View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <AppText variant="body-lg" weight="bold" style={[s.optionTitle, { color: colors.text }]} numberOfLines={2}>{mode === 'export' ? t('data.csv_export') : t('data.csv_import')}</AppText>
                    <AppText variant="caption" weight="medium" style={[s.optionSub, { color: colors.textSecondary }]} numberOfLines={3}>{mode === 'export' ? t('data.csv_export_desc') : t('data.csv_import_desc')}</AppText>
                  </View>
                  <ChevronRight size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            )}

            {/* →→ Step 2: Data Type →→ */}
            {step === 2 && (
              <View style={s.section}>
                <AppText variant="title" weight="bold" style={[s.sectionTitle, { color: colors.text }]} numberOfLines={2}>{t('data.select_type')}</AppText>
                <AppText variant="body-sm" weight="medium" style={[s.sectionSub, { color: colors.textSecondary }]} numberOfLines={3}>{mode === 'export' ? t('data.csv_export_desc') : t('data.csv_import_desc')}</AppText>

                {(Object.keys(DATA_TYPE_LABELS) as DataType[]).map((type) => {
                  const spec = CSV_SPECS[type];
                  return (
                    <TouchableOpacity key={type} style={[s.optionCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => handleTypeSelect(type)} activeOpacity={0.75}>
                      <View style={{ flex: 1 }}>
                        <AppText variant="body-lg" weight="bold" style={[s.optionTitle, { color: colors.text }]} numberOfLines={1}>{t(DATA_TYPE_LABELS[type])}</AppText>
                        <AppText variant="caption" weight="medium" style={[s.optionSub, { color: colors.textSecondary }]} numberOfLines={2}>
                          {spec.columns.filter(c => spec.requiredColumns.includes(c.key)).map(c => c.label).join(', ')} + {t('data.optional_fields')}
                        </AppText>
                      </View>
                      <ChevronRight size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  );
                })}

                {mode === 'import' && dataType && (
                  <TouchableOpacity style={[s.templateBtn, { borderColor: colors.primary }]} onPress={handleTemplateDownload}>
                    <Download size={16} color={colors.primary} />
                    <AppText variant="body-sm" weight="bold" style={{ color: colors.primary }} numberOfLines={1}>{t('data.download_template_csv')}</AppText>
                  </TouchableOpacity>
                )}

                <TouchableOpacity onPress={() => setStep(1)} style={s.backBtn}>
                  <AppText variant="body" weight="medium" style={[s.backBtnText, { color: colors.textSecondary }]} numberOfLines={1}>{t('data.back')}</AppText>
                </TouchableOpacity>
              </View>
            )}

            {/* →→ Step 3: Review & Execute →→ */}
            {step === 3 && (
              <View style={s.section}>
                <AppText variant="title" weight="bold" style={[s.sectionTitle, { color: colors.text }]} numberOfLines={2}>
                  {mode === 'export' ? t('data.ready_export') : t('data.ready_import')}
                </AppText>

                <View style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={s.summaryRow}>
                    <AppText variant="body-sm" weight="medium" style={[s.summaryLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('data.format')}</AppText>
                    <AppText variant="body-sm" weight="bold" style={[s.summaryValue, { color: colors.text }]} numberOfLines={1}>
                      {format === 'db' ? t('data.database_format') : t('data.csv_format')}
                    </AppText>
                  </View>
                  {dataType && (
                    <View style={s.summaryRow}>
                      <AppText variant="body-sm" weight="medium" style={[s.summaryLabel, { color: colors.textSecondary }]} numberOfLines={1}>{t('data.data_type')}</AppText>
                      <AppText variant="body-sm" weight="bold" style={[s.summaryValue, { color: colors.text }]} numberOfLines={1}>{DATA_TYPE_LABELS[dataType]}</AppText>
                    </View>
                  )}
                </View>

                {format === 'db' && mode === 'import' && (
                  <View style={[s.warningCard, { backgroundColor: colors.warning + '10', borderColor: colors.warning + '40' }]}>
                    <AlertTriangle size={18} color={colors.warning} />
                    <AppText variant="caption" weight="medium" style={[s.warningText, { color: colors.warning }]} numberOfLines={4}>
                      {t('data.csv_warning')}
                    </AppText>
                  </View>
                )}

                {mode === 'import' && format === 'csv' && dataType && (
                  <View style={[s.infoCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
                    <Info size={18} color={colors.primary} />
                    <AppText variant="caption" weight="medium" style={{ color: colors.primary, flex: 1 }} numberOfLines={4}>
                      {t('data.csv_import_info')}
                    </AppText>
                  </View>
                )}

                <TouchableOpacity
                  style={[s.executeBtn, { backgroundColor: loading ? colors.border : colors.text }]}
                  onPress={handleExecute}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color={colors.background} />
                  ) : (
                    <AppText variant="body" weight="bold" style={[s.executeBtnText, { color: colors.background }]} numberOfLines={1}>
                      {mode === 'export' ? t('data.export_now') : t('data.import_now')}
                    </AppText>
                  )}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setStep(2)} style={s.backBtn}>
                  <AppText variant="body" weight="medium" style={[s.backBtnText, { color: colors.textSecondary }]} numberOfLines={1}>{t('data.back')}</AppText>
                </TouchableOpacity>
              </View>
            )}

            {/* →→ Step 4: Preview & Mapping (Import only) →→ */}
            {step === 4 && mapping && (
              <View style={s.section}>
                <AppText variant="title" weight="bold" style={[s.sectionTitle, { color: colors.text }]} numberOfLines={2}>{t('data.preview_column_mapping')}</AppText>
                <AppText variant="body-sm" weight="medium" style={[s.sectionSub, { color: colors.textSecondary }]} numberOfLines={2}>
                  {fileName} • <AppNumber value={csvData.length} size="body-sm" /> {t('data.rows')} • <AppNumber value={csvHeaders.length} size="body-sm" /> {t('data.columns_detected')}
                </AppText>

                {/* Column mapping */}
                <View style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <AppText variant="body-sm" weight="bold" style={{ color: colors.text, marginBottom: 10 }} numberOfLines={1}>{t('data.column_mapping')}</AppText>
                  {mapping.mappings.map((m, idx) => (
                    <View key={idx} style={[s.mappingRow, { borderBottomColor: colors.border }]}>
                      <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary, flex: 1 }} numberOfLines={1}>CSV: {m.csvColumn}</AppText>
                      <AppText variant="caption" weight="bold" style={{ color: colors.success, flex: 1, textAlign: 'right' }} numberOfLines={1}>â†’ {m.dbField}</AppText>
                    </View>
                  ))}
                  {mapping.unmappedCSV.length > 0 && (
                    <View style={{ marginTop: 8 }}>
                      <AppText variant="caption" weight="bold" style={{ color: colors.warning, marginBottom: 4 }} numberOfLines={1}>{t('data.unmapped_columns')}</AppText>
                      {mapping.unmappedCSV.map((col, idx) => (
                        <AppText key={idx} variant="caption" weight="medium" style={{ color: colors.textSecondary }} numberOfLines={1}>• {col}</AppText>
                      ))}
                    </View>
                  )}
                  {mapping.missingRequired.length > 0 && (
                    <View style={[s.warningCard, { backgroundColor: colors.error + '10', borderColor: colors.error + '40', marginTop: 10 }]}>
                      <AlertTriangle size={16} color={colors.error} />
                      <AppText variant="caption" weight="bold" style={{ color: colors.error, flex: 1 }} numberOfLines={3}>
                        {t('data.missing_required_fields', { fields: mapping.missingRequired.join(', ') })}
                      </AppText>
                    </View>
                  )}
                </View>

                {/* Validation errors */}
                {validationErrors.length > 0 && (
                  <View style={[s.summaryCard, { backgroundColor: colors.error + '10', borderColor: colors.error + '40' }]}>
                    <AppText variant="body-sm" weight="bold" style={{ color: colors.error, marginBottom: 8 }} numberOfLines={1}>
                      <AppNumber value={validationErrors.length} size="body-sm" color={colors.error} /> {validationErrors.length > 1 ? t('data.validation_errors_plural') : t('data.validation_errors')}
                    </AppText>
                    <ScrollView style={{ maxHeight: 150 }} showsVerticalScrollIndicator={false}>
                      {validationErrors.slice(0, 20).map((err, idx) => (
                        <View key={idx} style={{ marginBottom: 4 }}>
                          <AppText variant="caption" weight="medium" style={{ color: colors.error }} numberOfLines={2}>
                            {t('data.row')} {err.row}, {err.field}: {err.message}
                          </AppText>
                        </View>
                      ))}
                      {validationErrors.length > 20 && (
                        <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary }} numberOfLines={1}>
                          {t('data.and_more_errors', { count: (validationErrors.length - 20).toString() })}
                        </AppText>
                      )}
                    </ScrollView>
                  </View>
                )}

                {/* Preview rows */}
                <View style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <AppText variant="body-sm" weight="bold" style={{ color: colors.text, marginBottom: 10 }} numberOfLines={1}>{t('data.preview_rows')}</AppText>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View>
                      <View style={[s.previewRow, { backgroundColor: colors.text + '10' }]}>
                        {mapping.mappings.slice(0, 5).map((m, idx) => (
                          <AppText key={idx} variant="micro" weight="bold" style={[s.previewCell, { color: colors.text, minWidth: 80 }]} numberOfLines={1}>{m.dbField}</AppText>
                        ))}
                      </View>
                      {csvData.slice(0, 5).map((row, rowIdx) => (
                        <View key={rowIdx} style={[s.previewRow, { borderBottomColor: colors.border }]}>
                          {mapping.mappings.slice(0, 5).map((m, idx) => (
                            <AppText key={idx} variant="micro" weight="medium" style={[s.previewCell, { color: colors.textSecondary, minWidth: 80 }]} numberOfLines={1}>
                              {row[m.csvColumn] || '—'}
                            </AppText>
                          ))}
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                {/* Actions */}
                <TouchableOpacity
                  style={[s.executeBtn, { backgroundColor: (loading || validationErrors.length > 0 || mapping.missingRequired.length > 0) ? colors.border : colors.success }]}
                  onPress={handleImportConfirm}
                  disabled={loading || validationErrors.length > 0 || mapping.missingRequired.length > 0}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <AppText variant="body" weight="bold" style={[s.executeBtnText, { color: '#FFF' }]} numberOfLines={1}>
                      {t('data.import_rows', { count: csvData.length.toString() })}
                    </AppText>
                  )}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setStep(3)} style={s.backBtn}>
                  <AppText variant="body" weight="medium" style={[s.backBtnText, { color: colors.textSecondary }]} numberOfLines={1}>{t('data.back')}</AppText>
                </TouchableOpacity>
              </View>
            )}

            {/* →→ Step 5: Import Result →→ */}
            {step === 5 && importResult && (
              <View style={s.section}>
                <View style={[s.resultIconBox, { backgroundColor: importResult.errors.length === 0 ? colors.success + '15' : colors.warning + '15' }]}>
                  {importResult.errors.length === 0 ? (
                    <CheckCircle2 size={48} color={colors.success} />
                  ) : (
                    <AlertTriangle size={48} color={colors.warning} />
                  )}
                </View>

                <AppText variant="heading-lg" weight="bold" align="center" style={{ color: colors.text, marginTop: 16 }} numberOfLines={2}>
                  {importResult.errors.length === 0 ? t('data.import_complete') : t('data.import_completed_issues')}
                </AppText>

                <View style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 16 }]}>
                  <View style={s.summaryRow}>
                    <AppText variant="body-sm" weight="medium" style={{ color: colors.success }} numberOfLines={1}>← {t('data.imported')}</AppText>
                    <AppText variant="body-sm" weight="bold" style={{ color: colors.success }} numberOfLines={1}><AppNumber value={importResult.imported} size="body-sm" color={colors.success} /> {t('data.rows')}</AppText>
                  </View>
                  {importResult.skipped > 0 && (
                    <View style={s.summaryRow}>
                      <AppText variant="body-sm" weight="medium" style={{ color: colors.warning }} numberOfLines={1}>← {t('data.skipped')}</AppText>
                      <AppText variant="body-sm" weight="bold" style={{ color: colors.warning }} numberOfLines={1}><AppNumber value={importResult.skipped} size="body-sm" color={colors.warning} /> {t('data.rows')}</AppText>
                    </View>
                  )}
                </View>

                {importResult.errors.length > 0 && (
                  <View style={[s.summaryCard, { backgroundColor: colors.error + '10', borderColor: colors.error + '40', marginTop: 12 }]}>
                    <AppText variant="body-sm" weight="bold" style={{ color: colors.error, marginBottom: 8 }} numberOfLines={1}>{t('data.issues')}</AppText>
                    <ScrollView style={{ maxHeight: 120 }} showsVerticalScrollIndicator={false}>
                      {importResult.errors.slice(0, 15).map((err: string, idx: number) => (
                        <AppText key={idx} variant="caption" weight="medium" style={{ color: colors.error, marginBottom: 3 }} numberOfLines={2}>• {err}</AppText>
                      ))}
                    </ScrollView>
                  </View>
                )}

                <TouchableOpacity style={[s.executeBtn, { backgroundColor: colors.text, marginTop: 20 }]} onPress={handleClose} activeOpacity={0.8}>
                  <AppText variant="body" weight="bold" style={[s.executeBtnText, { color: colors.background }]} numberOfLines={1}>{t('data.done')}</AppText>
                </TouchableOpacity>
              </View>
            )}

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// →→→ Styles →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: '88%', overflow: 'hidden' },
  handleRow: { alignItems: 'center', paddingTop: 14, paddingBottom: 4 },
  handle: { width: 40, height: 4, borderRadius: 2 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 25, paddingTop: 10, paddingBottom: 16 },
  headerSub: { fontSize: 11, fontFamily: Fonts.bold, letterSpacing: 1.2, marginBottom: 2 },
  headerTitle: { fontSize: 22, fontFamily: Fonts.bold },
  closeBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  stepRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 25, paddingBottom: 16, gap: 8 },
  stepLine: { flex: 1, height: 2 },
  stepLabel: { fontSize: 10, fontFamily: Fonts.bold, marginLeft: 8 },
  body: { paddingHorizontal: 25, paddingBottom: 40 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 18, fontFamily: Fonts.bold },
  sectionSub: { fontSize: 13, fontFamily: Fonts.medium, lineHeight: 18 },
  optionCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 18, borderWidth: 1, gap: 12 },
  optionIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  optionTitle: { fontSize: 15, fontFamily: Fonts.bold },
  optionSub: { fontSize: 12, fontFamily: Fonts.medium, marginTop: 2, lineHeight: 16 },
  summaryCard: { borderRadius: 18, borderWidth: 1, padding: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  summaryLabel: { fontSize: 13, fontFamily: Fonts.medium },
  summaryValue: { fontSize: 13, fontFamily: Fonts.bold },
  warningCard: { flexDirection: 'row', padding: 14, borderRadius: 14, borderWidth: 1, gap: 10, alignItems: 'flex-start' },
  warningText: { fontSize: 12, fontFamily: Fonts.medium, flex: 1, lineHeight: 18 },
  infoCard: { flexDirection: 'row', padding: 14, borderRadius: 14, borderWidth: 1, gap: 10, alignItems: 'flex-start' },
  executeBtn: { height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  executeBtnText: { fontSize: 16, fontFamily: Fonts.bold },
  backBtn: { paddingVertical: 12, alignItems: 'center' },
  backBtnText: { fontSize: 14, fontFamily: Fonts.bold },
  templateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1, marginTop: 8 },
  mappingRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1 },
  previewRow: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1 },
  previewCell: { fontSize: 11, fontFamily: Fonts.medium, paddingHorizontal: 6 },
  resultIconBox: { width: 80, height: 80, borderRadius: 40, alignSelf: 'center', justifyContent: 'center', alignItems: 'center' },
});

export default DataTransferModal;