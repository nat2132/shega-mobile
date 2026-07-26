import { AppCard, AppText } from '@/components/ui';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';
import {
  CSV_SPECS,
  downloadCSVTemplate,
  executeImport,
  exportToCSV,
  findDuplicates,
  generatePreview,
  MappingResult,
  PreviewData,
  transformRows,
  validateRows,
  ValidationError
} from '@/utils/csv-utils';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { playBad } from '@/services/soundService';
import { useToast } from '@/context/ToastContext';
import {
  getItems,
  getCategories,
  getFilteredExpenses,
  getContacts,
  getSales,
} from '@/database/db';
import {
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  ClipboardList,
  Download,
  FileText,
  Package,
  Tag,
  Upload,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { getSettingsGlass } from './glass-settings';

type Step = 'select' | 'preview' | 'validate' | 'import' | 'result';

interface ModuleOption {
  key: string;
  label: string;
  icon: any;
  description?: string;
  descKey?: string;
  color: string;
}

const CSVManagerScreen = () => {
  const { colors, t } = useSettings();
  const G = getSettingsGlass(colors);

  const MODULES: ModuleOption[] = [
    { key: 'items', label: t('dt.inventory_items_label'), icon: Package, descKey: 'dt.inventory_items', color: colors.primary },
    { key: 'sales', label: t('dt.sales_records_label'), icon: Wallet, descKey: 'dt.sales_records', color: colors.success },
    { key: 'expenses', label: t('dt.expenses_label'), icon: ClipboardList, descKey: 'dt.expenses', color: colors.warning },
    { key: 'categories', label: t('dt.categories_label'), icon: Tag, descKey: 'dt.categories', color: colors.tint },
    { key: 'contacts', label: t('dt.contacts_label'), icon: Users, descKey: 'dt.contacts', color: colors.error },
    { key: 'adjustments', label: t('dt.adjustments_label'), icon: ClipboardList, descKey: 'dt.adjustments', color: colors.tint },
  ];
  const { showToast } = useToast();
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>('select');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [mapping, setMapping] = useState<MappingResult | null>(null);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [transformedData, setTransformedData] = useState<any[]>([]);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [csvContent, setCsvContent] = useState<string>('');
  const [processing, setProcessing] = useState(false);

  const handleSelectModule = useCallback((moduleKey: string) => {
    setSelectedModule(moduleKey);
    setCurrentStep('select');
    setPreview(null);
    setMapping(null);
    setErrors([]);
    setTransformedData([]);
    setImportResult(null);
    setCsvContent('');
  }, []);

  const handlePickFile = useCallback(async () => {
    if (!selectedModule) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/csv',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const fileUri = result.assets[0].uri;
      const content = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      setCsvContent(content);
      setCurrentStep('preview');
    } catch {
      showToast(t('common.error'), 'error');
    }
  }, [selectedModule, showToast]);

  const handleGeneratePreview = useCallback(() => {
    if (!csvContent || !selectedModule) return;

    const spec = CSV_SPECS[selectedModule];
    if (!spec) return;

    const result = generatePreview(csvContent, selectedModule);
    if (result) {
      setPreview(result.preview);
      setMapping(result.mapping);
      setCurrentStep('validate');
    } else {
      showToast(t('common.error'), 'error');
    }
  }, [csvContent, selectedModule, showToast]);

  const handleValidateAndTransform = useCallback(() => {
    if (!preview || !mapping || !selectedModule) return;

    const spec = CSV_SPECS[selectedModule];
    const validationErrors = validateRows(preview.rows, mapping.mappings, spec);
    setErrors(validationErrors);

    if (validationErrors.length === 0) {
      const data = transformRows(preview.rows, mapping.mappings, spec);
      setTransformedData(data);
      setCurrentStep('import');
    } else {
      playBad();
      setCurrentStep('validate');
    }
  }, [preview, mapping, selectedModule]);

  const handleImport = useCallback(async () => {
    if (!transformedData.length || !selectedModule) return;

    setProcessing(true);
    try {
      const spec = CSV_SPECS[selectedModule];
      const getExistingRecords = () => {
        switch (selectedModule) {
          case 'items':
            return getItems() as any[];
          case 'categories':
            return getCategories() as any[];
          case 'expenses':
            return getFilteredExpenses({}) as any[];
          case 'contacts':
            return getContacts() as any[];
          default:
            return [];
        }
      };

      const existing = getExistingRecords();
      const dupes = findDuplicates(transformedData, spec, existing);

      const doImport = async () => {
        if (!selectedModule) return;

        try {
          const result = await executeImport(transformedData, selectedModule);
          setImportResult({
            imported: result.imported,
            skipped: result.skipped,
            errors: result.errors,
          });
          setCurrentStep('result');
          if (result.errors.length === 0) {
            showToast({ title: t('dt.import_complete'), message: t('dt.records_imported', { count: String(result.imported) }), type: 'success' });
          } else {
            showToast({ title: t('toast.import_complete'), message: t('dt.records_imported_issues', { count: String(result.imported), errors: String(result.errors.length) }), type: 'warning' });
            playBad();
          }
        } catch {
          showToast(t('common.error'), 'error');
        } finally {
          setProcessing(false);
        }
      };

      if (dupes.length > 0) {
        Alert.alert(
          t('common.error'),
          `${dupes.length} record(s) already exist. Continue with import?`,
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('dt.validate_map'), onPress: () => doImport() },
          ]
        );
      } else {
        await doImport();
      }
    } catch {
      showToast(t('toast.import_failed'), 'error');
      setProcessing(false);
    }
  }, [transformedData, selectedModule, showToast]);

  const handleTemplate = useCallback(async () => {
    if (!selectedModule) return;
    await downloadCSVTemplate(selectedModule);
  }, [selectedModule]);

  const handleExport = useCallback(async () => {
    if (!selectedModule) return;

    try {
      let data: any[] = [];

      switch (selectedModule) {
        case 'items':
          data = getItems() as any[];
          break;
        case 'sales':
          data = getSales() as any[];
          break;
        case 'expenses':
          data = getFilteredExpenses({}) as any[];
          break;
        case 'categories':
          data = getCategories() as any[];
          break;
        case 'contacts':
          data = getContacts() as any[];
          break;
        case 'adjustments':
          data = getRecentAdjustments() as any[];
          break;
      }

      await exportToCSV(data, selectedModule);
      showToast({ title: t('dt.export_summary'), message: t('dt.records_exported', { count: String(data.length) }), type: 'success' });
    } catch {
      showToast(t('common.error'), 'error');
    }
  }, [selectedModule, showToast]);

  const handleReset = useCallback(() => {
    setSelectedModule(null);
    setCurrentStep('select');
    setPreview(null);
    setMapping(null);
    setErrors([]);
    setTransformedData([]);
    setImportResult(null);
    setCsvContent('');
  }, []);

  // Module Selection Screen
  if (!selectedModule) {
    return (
      <View style={[styles.container, { backgroundColor: G.bg }]}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={[styles.glowWash, { backgroundColor: G.mutedLight, top: -80, left: -60, width: 200, height: 200, borderRadius: 100 }]} />
          <View style={[styles.glowWash, { backgroundColor: G.mutedLight, bottom: -40, right: -30, width: 160, height: 160, borderRadius: 80 }]} />
        </View>
        <View style={styles.header}>
          <AppText variant="display" weight="bold" style={[styles.title, { color: G.fg }]}>
            Data Transfer
          </AppText>
          <AppText variant="body" weight="medium" style={[styles.subtitle, { color: G.fgSecondary }]}>
            Import or export data using CSV files
          </AppText>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.moduleList}>
          {MODULES.map((module, index) => {
            const Icon = module.icon;
            const spec = CSV_SPECS[module.key];
            return (
              <Animated.View key={module.key} entering={FadeInDown.delay(index * 80).duration(500)}>
                <TouchableOpacity onPress={() => handleSelectModule(module.key)} activeOpacity={0.8}>
                  <AppCard style={styles.moduleCard}>
                    <View style={[styles.moduleIcon, { backgroundColor: module.color + '15' }]}>
                      <Icon size={24} color={module.color} />
                    </View>
                    <View style={styles.moduleInfo}>
                      <AppText variant="body" weight="bold" style={[styles.moduleName, { color: G.fg }]}>
                        {module.label}
                      </AppText>
                      <AppText variant="caption" weight="medium" style={[styles.moduleDesc, { color: G.fgSecondary }]}>
                        {module.description} • {spec.columns.length} fields
                      </AppText>
                    </View>
                    <ChevronRight size={20} color={G.border} />
                  </AppCard>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  const spec = CSV_SPECS[selectedModule];

  return (
    <View style={[styles.container, { backgroundColor: G.bg }]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[styles.glowWash, { backgroundColor: G.mutedLight, top: -80, left: -60, width: 200, height: 200, borderRadius: 100 }]} />
        <View style={[styles.glowWash, { backgroundColor: G.mutedLight, bottom: -40, right: -30, width: 160, height: 160, borderRadius: 80 }]} />
        <View style={[styles.glowWash, { backgroundColor: G.mutedLight, top: '40%', right: -50, width: 140, height: 140, borderRadius: 70 }]} />
      </View>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleReset} style={styles.backBtn}>
          <View style={[styles.backIcon, { backgroundColor: G.bgCard }]}>
            <AppText variant="caption" weight="bold" style={{ color: G.fg }}>←</AppText>
          </View>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <AppText variant="display" weight="bold" style={[styles.title, { color: G.fg }]}>
            {spec.name}
          </AppText>
          <AppText variant="body-sm" weight="medium" style={[styles.subtitle, { color: G.fgSecondary }]}>
            {spec.description}
          </AppText>
        </View>
      </View>

      {/* Step indicator */}
      <View style={styles.stepRow}>
        {['select', 'preview', 'validate', 'import', 'result'].map((step, idx) => {
          const stepIndex = ['select', 'preview', 'validate', 'import', 'result'].indexOf(currentStep);
          const currentIndex = idx;
          const isActive = currentIndex <= stepIndex;
          const isCurrentStep = step === currentStep;
          return (
            <View key={step} style={[styles.stepDot, { backgroundColor: isActive ? colors.primary : G.border }]}>
              {isCurrentStep && <View style={[styles.stepDotInner, { backgroundColor: G.bg }]} />}
            </View>
          );
        })}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Action Buttons */}
        {currentStep === 'select' && (
          <View style={styles.actionGrid}>
            <TouchableOpacity onPress={handlePickFile} activeOpacity={0.8}>
                  <AppCard style={styles.actionCard}>
                <View style={[styles.actionIcon, { backgroundColor: colors.primary + '15' }]}>
                  <Upload size={28} color={colors.primary} />
                </View>
                <AppText variant="body" weight="bold" style={[styles.actionTitle, { color: G.fg }]}>
                  Import CSV
                </AppText>
                <AppText variant="caption" weight="medium" style={[styles.actionDesc, { color: G.fgSecondary }]}>
                  Upload a CSV file to import data
                </AppText>
              </AppCard>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleTemplate} activeOpacity={0.8}>
              <AppCard style={styles.actionCard}>
                <View style={[styles.actionIcon, { backgroundColor: colors.success + '15' }]}>
                  <FileText size={28} color={colors.success} />
                </View>
                <AppText variant="body" weight="bold" style={[styles.actionTitle, { color: G.fg }]}>
                  Download Template
                </AppText>
                <AppText variant="caption" weight="medium" style={[styles.actionDesc, { color: G.fgSecondary }]}>
                  Get a formatted CSV template
                </AppText>
              </AppCard>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleExport} activeOpacity={0.8}>
              <AppCard style={styles.actionCard}>
                <View style={[styles.actionIcon, { backgroundColor: colors.warning + '15' }]}>
                  <Download size={28} color={colors.warning} />
                </View>
                <AppText variant="body" weight="bold" style={[styles.actionTitle, { color: G.fg }]}>
                  Export Data
                </AppText>
                <AppText variant="caption" weight="medium" style={[styles.actionDesc, { color: G.fgSecondary }]}>
                  Export all data to CSV
                </AppText>
              </AppCard>
            </TouchableOpacity>
          </View>
        )}

        {/* Preview Step */}
        {currentStep === 'preview' && preview && (
          <View style={styles.previewContainer}>
            <AppCard style={styles.infoCard}>
              <AppText variant="body" weight="bold" style={[styles.infoTitle, { color: G.fg }]}>
                File Ready
              </AppText>
              <AppText variant="body-sm" weight="medium" style={[styles.infoText, { color: G.fgSecondary }]}>
                {preview.totalRows} rows • {preview.headers.length} columns detected
              </AppText>
            </AppCard>

            <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.sectionLabel, { color: G.fgSecondary }]}>
              Column Mapping
            </AppText>
            {mapping?.mappings.map((m, idx) => (
              <View key={idx} style={[styles.mappingRow, { backgroundColor: G.bgCard, borderColor: G.border }]}>
                <AppText variant="body-sm" weight="medium" style={{ color: G.fg }}>{m.csvColumn}</AppText>
                <AppText variant="body-sm" weight="bold" style={{ color: colors.primary }}>→</AppText>
                <AppText variant="body-sm" weight="medium" style={{ color: G.fg }}>{m.dbField}</AppText>
              </View>
            ))}

            {mapping && mapping.unmappedCSV.length > 0 && (
              <View style={[styles.warningCard, { backgroundColor: colors.warning + '15', borderColor: colors.warning }]}>
                <AlertTriangle size={20} color={colors.warning} />
                <AppText variant="body-sm" weight="medium" style={{ color: colors.warning }}>
                  Unmapped columns: {mapping.unmappedCSV.join(', ')}
                </AppText>
              </View>
            )}

            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={handleGeneratePreview}>
              <AppText variant="body" weight="bold" style={{ color: G.bg }}>
                Continue to Validation
              </AppText>
              <ChevronRight size={20} color={G.bg} />
            </TouchableOpacity>
          </View>
        )}

        {/* Validation Step */}
        {currentStep === 'validate' && (
          <View style={styles.validateContainer}>
            {errors.length === 0 ? (
              <View>
                <View style={[styles.successCard, { backgroundColor: colors.success + '15', borderColor: colors.success }]}>
                  <CheckCircle size={32} color={colors.success} />
                  <AppText variant="body" weight="bold" style={{ color: colors.success }}>
                    Validation Passed
                  </AppText>
                  <AppText variant="body-sm" weight="medium" style={{ color: G.fgSecondary }}>
                    {transformedData.length} records ready to import
                  </AppText>
                </View>

                <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={handleValidateAndTransform}>
                  <AppText variant="body" weight="bold" style={{ color: G.bg }}>
                    Proceed to Import
                  </AppText>
                  <ChevronRight size={20} color={G.bg} />
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <View style={[styles.errorCard, { backgroundColor: colors.error + '15', borderColor: colors.error }]}>
                  <XCircle size={32} color={colors.error} />
                  <AppText variant="body" weight="bold" style={{ color: colors.error }}>
                    {errors.length} Error(s) Found
                  </AppText>
                </View>

                <ScrollView style={styles.errorList} nestedScrollEnabled>
                  {errors.slice(0, 20).map((err, idx) => (
                    <View key={idx} style={[styles.errorItem, { backgroundColor: G.bgCard, borderColor: G.border }]}>
                      <View style={styles.errorHeader}>
                        <AppText variant="caption" weight="bold" style={{ color: colors.error }}>
                          Row {err.row}
                        </AppText>
                        <AppText variant="caption" weight="medium" style={{ color: G.fgSecondary }}>
                          {err.field}
                        </AppText>
                      </View>
                      <AppText variant="body-sm" weight="medium" style={{ color: G.fg }}>
                        {err.message}
                      </AppText>
                    </View>
                  ))}
                  {errors.length > 20 && (
                    <AppText variant="body-sm" weight="medium" style={[styles.moreErrors, { color: G.fgSecondary }]}>
                      ... and {errors.length - 20} more errors
                    </AppText>
                  )}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {/* Import Step */}
        {currentStep === 'import' && (
          <View style={styles.importContainer}>
            <AppCard style={styles.summaryCard}>
              <AppText variant="body" weight="bold" style={[styles.summaryTitle, { color: G.fg }]}>
                Ready to Import
              </AppText>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <AppText variant="display" weight="bold" style={{ color: colors.primary }}>
                    {transformedData.length}
                  </AppText>
                  <AppText variant="caption" weight="medium" style={{ color: G.fgSecondary }}>
                    Total Records
                  </AppText>
                </View>
              </View>
            </AppCard>

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
              onPress={handleImport}
              disabled={processing}
            >
              <AppText variant="body" weight="bold" style={{ color: G.bg }}>
                {processing ? t('dt.import_complete') : t('dt.validate_map')}
              </AppText>
              <Upload size={20} color={G.bg} />
            </TouchableOpacity>
          </View>
        )}

        {/* Result Step */}
        {currentStep === 'result' && importResult && (
          <View style={styles.resultContainer}>
            <View style={[styles.resultCard, { backgroundColor: importResult.errors.length === 0 ? colors.success + '15' : colors.warning + '15', borderColor: importResult.errors.length === 0 ? colors.success : colors.warning }]}>
              {importResult.errors.length === 0 ? (
                <CheckCircle size={48} color={colors.success} />
              ) : (
                <AlertTriangle size={48} color={colors.warning} />
              )}
              <AppText variant="display" weight="bold" style={{ color: importResult.errors.length === 0 ? colors.success : colors.warning }}>
                {importResult.errors.length === 0 ? t('dt.import_successful') : t('dt.completed_issues')}
              </AppText>
            </View>

            <View style={styles.resultStats}>
              <View style={[styles.statCard, { backgroundColor: G.bgCard, borderColor: G.border }]}>
                <AppText variant="display" weight="bold" style={{ color: colors.success }}>
                  {importResult.imported}
                </AppText>
                <AppText variant="caption" weight="medium" style={{ color: G.fgSecondary }}>
                  Imported
                </AppText>
              </View>
              <View style={[styles.statCard, { backgroundColor: G.bgCard, borderColor: G.border }]}>
                <AppText variant="display" weight="bold" style={{ color: colors.warning }}>
                  {importResult.skipped}
                </AppText>
                <AppText variant="caption" weight="medium" style={{ color: G.fgSecondary }}>
                  Skipped
                </AppText>
              </View>
            </View>

            {importResult.errors.length > 0 && (
              <View style={styles.errorsSection}>
                <AppText variant="caption" weight="bold" transform="uppercase" style={[styles.sectionLabel, { color: G.fgSecondary }]}>
                  Errors & Warnings
                </AppText>
                <ScrollView style={styles.errorList} nestedScrollEnabled>
                  {importResult.errors.map((err, idx) => (
                    <View key={idx} style={[styles.errorItem, { backgroundColor: G.bgCard, borderColor: G.border }]}>
                      <AppText variant="body-sm" weight="medium" style={{ color: G.fg }}>
                        {err}
                      </AppText>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={handleReset}>
              <AppText variant="body" weight="bold" style={{ color: G.bg }}>
                Done
              </AppText>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16 },
  backBtn: { marginBottom: 12 },
  backIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  headerInfo: { marginTop: 4 },
  title: { fontSize: 32, letterSpacing: -1, marginBottom: 4 },
  subtitle: { fontSize: 15, lineHeight: 20 },
  stepRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24, paddingHorizontal: 40 },
  stepDot: { width: 12, height: 12, borderRadius: 6 },
  stepDotInner: { width: 8, height: 8, borderRadius: 4, margin: 2 },
  content: { paddingHorizontal: 24, paddingBottom: 120 },

  // Module Selection
  moduleList: { paddingBottom: 40 },
  moduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    gap: Spacing.md,
    overflow: 'hidden',
  },
  moduleIcon: { width: 56, height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  moduleInfo: { flex: 1 },
  moduleName: { fontSize: 16, marginBottom: 2 },
  moduleDesc: { fontSize: 13, lineHeight: 18 },

  // Actions
  actionGrid: { gap: Spacing.md },
  actionCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    alignItems: 'center',
    gap: Spacing.sm,
    overflow: 'hidden',
  },
  actionIcon: { width: 64, height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.xs },
  actionTitle: { fontSize: 16 },
  actionDesc: { fontSize: 13, textAlign: 'center', lineHeight: 18 },

  // Preview
  previewContainer: { gap: Spacing.md },
  infoCard: { padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, overflow: 'hidden' },
  infoTitle: { fontSize: 16, marginBottom: 4 },
  infoText: { fontSize: 14, lineHeight: 20 },
  sectionLabel: { fontSize: 11, letterSpacing: 1, marginBottom: Spacing.sm, marginTop: Spacing.md },
  mappingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },

  // Validation
  validateContainer: { gap: Spacing.md },
  successCard: {
    alignItems: 'center',
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    gap: Spacing.sm,
    overflow: 'hidden',
  },
  errorCard: {
    alignItems: 'center',
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    gap: Spacing.sm,
    overflow: 'hidden',
  },
  errorList: { maxHeight: 400, marginTop: Spacing.md },
  errorItem: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  errorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  moreErrors: { textAlign: 'center', marginTop: Spacing.sm, fontStyle: 'italic' },

  // Import
  importContainer: { gap: Spacing.lg },
  summaryCard: { padding: Spacing.lg, borderRadius: BorderRadius.xl, borderWidth: 1, alignItems: 'center', gap: Spacing.md, overflow: 'hidden' },
  summaryTitle: { fontSize: 18 },
  summaryRow: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.sm },
  summaryItem: { alignItems: 'center', minWidth: 100 },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.xs,
    overflow: 'hidden',
  },

  // Result
  resultContainer: { gap: Spacing.lg },
  resultCard: {
    alignItems: 'center',
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    gap: Spacing.sm,
    overflow: 'hidden',
  },
  resultStats: { flexDirection: 'row', gap: Spacing.md },
  errorsSection: { marginTop: Spacing.md },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  glowWash: { position: 'absolute' },
});

export default CSVManagerScreen;