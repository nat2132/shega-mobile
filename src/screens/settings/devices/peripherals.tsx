import { useEffect, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Activity,
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Globe,
  History,
  Info,
  LucideIcon,
  Play,
  Plus,
  Printer as PrinterIcon,
  Radio,
  RotateCcw,
  Scale,
  ScanLine,
  Smartphone,
  Trash2,
} from 'lucide-react-native';
import * as Device from 'expo-device';
import { useSettings } from '@/context/SettingsContext';
import { AppButton, AppText } from '@/components/ui';
import { getSettingsGlass } from '../glass-settings';
import { getPeripheralManager } from '@/services/peripherals/peripheralManager';
import { usePeripheralScan, usePeripheralStore } from '@/hooks/usePeripherals';
import { transportCapability } from '@/services/peripherals/transports';
import { defaultConfig } from '@/services/peripherals/types';
import { buildSampleReceiptPreview } from '@/services/peripherals/escpos';
import type { CommandCheck, CommandDiagnosticResult } from '@/services/peripherals/escpos';
import type {
  ConnectionType,
  DeviceRole,
  DeviceStatus,
  DiagnosticReport,
  PeripheralConfig,
  ScanResult,
  VirtualProbeResult,
} from '@/services/peripherals/types';

type ViewState =
  | { name: 'list' }
  | { name: 'detail'; id: string }
  | { name: 'add'; role?: DeviceRole }
  | { name: 'test-scanner' }
  | { name: 'test-printer'; id: string }
  | { name: 'diag' }
  | { name: 'logs' }
  | { name: 'pos' };

interface Glass {
  bg: string;
  bgCard: string;
  border: string;
  fg: string;
  muted: string;
  mutedLight: string;
  accentGlass: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  inputBg: string;
  inputBorder: string;
  placeholderColor: string;
}

const useGlass = (): Glass => {
  const { colors } = useSettings();
  return getSettingsGlass(colors) as unknown as Glass;
};

const connLabelKey = (c: ConnectionType): string => {
  const map: Record<ConnectionType, string> = {
    bluetooth_escpos: 'conn_bluetooth_escpos',
    usb_escpos: 'conn_usb_escpos',
    network_escpos: 'conn_network_escpos',
    virtual_tcp_escpos: 'conn_virtual_tcp_escpos',
    bluetooth_hid: 'conn_bluetooth_hid',
    usb_hid: 'conn_usb_hid',
    keyboard_hid: 'conn_keyboard_hid',
    camera: 'conn_camera',
  };
  return map[c];
};

// →→→ Small pieces →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
const CONNECTION_OPTIONS: Record<DeviceRole, ConnectionType[]> = {
  scanner: ['camera', 'keyboard_hid', 'bluetooth_hid', 'usb_hid'],
  printer: ['network_escpos', 'bluetooth_escpos', 'usb_escpos', 'virtual_tcp_escpos'],
  drawer: ['network_escpos', 'bluetooth_escpos', 'usb_escpos'],
  scale: ['bluetooth_escpos', 'usb_escpos'],
};

const isVirtualConnection = (c: ConnectionType): boolean => c === 'virtual_tcp_escpos';

const ROLE_ORDER: DeviceRole[] = ['scanner', 'printer', 'drawer', 'scale'];

const ROLE_ICONS: Record<DeviceRole, LucideIcon> = {
  scanner: ScanLine,
  printer: PrinterIcon,
  drawer: Banknote,
  scale: Scale,
};

const StatusChip = ({ status }: { status: DeviceStatus }) => {
  const { t } = useSettings();
  const G = useGlass();
  const color =
    status === 'connected'
      ? G.success
      : status === 'connecting' || status === 'not_configured'
        ? G.warning
        : status === 'error'
          ? G.error
          : G.muted;
  return (
    <View
      style={{
        backgroundColor: color + '1A',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
      }}
    >
      <AppText variant="micro" weight="bold" style={{ color }} numberOfLines={1}>
        {t(`devices.status_${status}`)}
      </AppText>
    </View>
  );
};

const CapBadge = ({ state }: { state: 'available' | 'needs_dev_build' | 'unsupported' }) => {
  const { t } = useSettings();
  const G = useGlass();
  const isOk = state === 'available';
  const isBuild = state === 'needs_dev_build';
  const color = isOk ? G.success : isBuild ? G.warning : G.error;
  const label = isOk
    ? t('devices.available')
    : isBuild
      ? t('devices.requires_dev')
      : t('devices.unsupported');
  return (
    <View
      style={{
        backgroundColor: color + '1A',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
      }}
    >
      <AppText variant="micro" weight="bold" style={{ color }} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
};

const MenuItem = ({
  icon: Icon,
  title,
  subtitle,
  onPress,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  onPress: () => void;
}) => {
  const G = useGlass();
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={styles.menuItem}>
      <View style={[styles.menuIcon, { backgroundColor: G.mutedLight }]}>
        <Icon size={18} color={G.fg} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="body" weight="bold" style={{ color: G.fg }} numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={2}>
          {subtitle}
        </AppText>
      </View>
      <ChevronRight size={16} color={G.muted} />
    </TouchableOpacity>
  );
};

const ToggleRow = ({
  title,
  value,
  onValueChange,
}: {
  title: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) => {
  const G = useGlass();
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}
    >
      <AppText variant="caption" weight="medium" style={{ color: G.fg }}>
        {title}
      </AppText>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
};

const Segmented = ({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (k: string) => void;
}) => {
  const G = useGlass();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: G.mutedLight, borderRadius: 10, padding: 3 }}>
      {options.map((o) => {
        const sel = o.key === String(value);
        return (
          <TouchableOpacity
            key={o.key}
            activeOpacity={0.8}
            onPress={() => onChange(o.key)}
            style={{
              flex: 1,
              backgroundColor: sel ? G.bgCard : 'transparent',
              borderRadius: 8,
              paddingVertical: 9,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: sel ? G.border : 'transparent',
            }}
          >
            <AppText variant="caption" weight="bold" style={{ color: sel ? G.accent : G.muted }} numberOfLines={1}>
              {o.label}
            </AppText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const DevBadge = () => {
  const { t } = useSettings();
  const G = useGlass();
  return (
    <View
      style={{
        backgroundColor: G.warning + '1A',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <FlaskConical size={10} color={G.warning} />
      <AppText variant="micro" weight="bold" style={{ color: G.warning }} numberOfLines={1}>
        {t('devices.virtual_dev_label')}
      </AppText>
    </View>
  );
};

// Remote TCP endpoint reachability test for the virtual printer. Results are
// real: "Connected" only when the endpoint answered, plus whitelist-aware
// failure guidance. Never fakes a successful connection.
const VirtualProbePanel = ({ host, port, onOpenSettings }: { host: string; port: number; onOpenSettings?: () => void }) => {
  const { t } = useSettings();
  const G = useGlass();
  const manager = getPeripheralManager();
  const [state, setState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [outcome, setOutcome] = useState<VirtualProbeResult | null>(null);
  const [internet, setInternet] = useState<boolean | null>(null);

  const run = async () => {
    if (!host || !port) {
      Alert.alert(t('devices.test_connection_failed'), t('devices.connection'));
      return;
    }
    setState('testing');
    setOutcome(null);
    setInternet(null);
    const r = await manager.probeVirtual(null, host, port);
    setState(r.ok ? 'ok' : 'fail');
    setOutcome(r);
  };

  const runDiagnostics = async () => {
    setInternet(null);
    setInternet(await manager.probeInternet());
  };

  const causes =
    outcome?.outcome === 'timeout' ? ['whitelist', 'not_running', 'firewall'] : ['internet', 'host', 'port', 'whitelist', 'not_running', 'firewall'];
  const showWhitelist = state === 'fail' && (outcome?.rejected || outcome?.outcome === 'timeout');

  return (
    <View style={{ marginTop: 14 }}>
      <AppButton
        label={state === 'testing' ? t('devices.connecting') : t('devices.test_connection')}
        variant="secondary"
        leftIcon={state !== 'testing' ? <Radio size={16} color={G.fg} /> : undefined}
        loading={state === 'testing'}
        onPress={run}
      />

      {state === 'testing' ? (
        <View style={[styles.card, { backgroundColor: G.warning + '14', borderColor: G.warning + '40' }]}>
          <AppText variant="caption" weight="bold" style={{ color: G.warning }}>
            {t('devices.connecting')}
          </AppText>
          <AppText variant="caption" weight="medium" style={{ color: G.fg, marginTop: 4 }}>
            {t('devices.tel_host')}: {host}:{port}
          </AppText>
          <AppText variant="caption" weight="medium" style={{ color: G.muted }}>
            {t('devices.tel_protocol')}: {t('devices.escpos_short')}
          </AppText>
        </View>
      ) : null}

      {state === 'ok' && outcome ? (
        <View style={[styles.card, { backgroundColor: G.success + '14', borderColor: G.success + '40' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={16} color={G.success} />
            <AppText variant="body" weight="bold" style={{ color: G.success }}>
              {t('devices.connected_ok')}
            </AppText>
          </View>
          <AppText variant="caption" weight="medium" style={{ color: G.fg, marginTop: 6 }}>
            {t('devices.tel_host')}: {host}:{port}
          </AppText>
          <AppText variant="caption" weight="medium" style={{ color: G.muted }}>
            {t('devices.tel_protocol')}: {t('devices.escpos_short')} · {t('devices.transport_tcp')}
            {outcome.latencyMs !== undefined ? ` · ${outcome.latencyMs}ms` : ''}
          </AppText>
        </View>
      ) : null}

      {state === 'fail' ? (
        <>
          <View style={[styles.card, { backgroundColor: G.error + '14', borderColor: G.error + '40' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} color={G.error} />
              <AppText variant="body" weight="bold" style={{ color: G.error }}>
                {t('devices.connection_failed')}
              </AppText>
            </View>
            {outcome?.outcome === 'timeout' ? (
              <AppText variant="caption" weight="medium" style={{ color: G.fg, marginTop: 6 }}>
                {t('devices.no_response')}
              </AppText>
            ) : null}
            <AppText variant="caption" weight="bold" style={{ color: G.muted, marginTop: 8 }}>
              {t('devices.probe_causes')}
            </AppText>
            {causes.map((c) => (
              <View key={c} style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
                <AppText variant="caption" weight="medium" style={{ color: G.muted }}>
                  •
                </AppText>
                <AppText variant="caption" weight="medium" style={{ color: G.fg, flex: 1 }}>
                  {t(`devices.cause_${c}`)}
                </AppText>
              </View>
            ))}

            {internet !== null ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                {internet ? <CheckCircle2 size={14} color={G.success} /> : <AlertTriangle size={14} color={G.error} />}
                <AppText variant="caption" weight="bold" style={{ color: internet ? G.success : G.error }}>
                  {t('devices.diag_internet')}: {internet ? t('devices.connected_ok') : t('devices.connection_failed')}
                </AppText>
              </View>
            ) : null}

            <View style={styles.actionRow}>
              <AppButton label={t('devices.retry')} variant="secondary" onPress={run} style={{ flex: 1 }} />
              <AppButton label={t('devices.diagnostics')} variant="secondary" onPress={runDiagnostics} style={{ flex: 1 }} />
            </View>
          </View>

          {showWhitelist ? (
            <View style={[styles.card, { backgroundColor: G.warning + '14', borderColor: G.warning + '40' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={16} color={G.warning} />
                <AppText variant="body" weight="bold" style={{ color: G.warning, flex: 1 }}>
                  {t('devices.whitelist_title')}
                </AppText>
              </View>
              <AppText variant="caption" weight="medium" style={{ color: G.fg, marginTop: 6 }} numberOfLines={4}>
                {t('devices.whitelist_body')}
              </AppText>
              <View style={styles.actionRow}>
                <AppButton label={t('devices.retry')} variant="secondary" onPress={run} style={{ flex: 1 }} />
                <AppButton label={t('devices.open_printer_settings')} variant="secondary" onPress={() => (onOpenSettings ? onOpenSettings() : Alert.alert(t('devices.whitelist_title'), t('devices.whitelist_body')))} style={{ flex: 1 }} />
              </View>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
};

const CmdRow = ({ c }: { c: CommandCheck }) => {
  const { t } = useSettings();
  const G = useGlass();
  return (
    <View style={[styles.logRow, { backgroundColor: G.bgCard, borderColor: G.border }]}>
      <View style={[styles.logDot, { backgroundColor: c.generated ? G.success : G.muted }]} />
      <View style={{ flex: 1 }}>
        <AppText variant="caption" weight="bold" style={{ color: G.fg }} numberOfLines={2}>
          {c.label}
        </AppText>
        <AppText variant="micro" weight="medium" style={{ color: G.muted }} numberOfLines={1}>
          {t('devices.cmd_generated')} · {t('devices.cmd_bytes', { bytes: String(c.bytesEmitted) })}
        </AppText>
        <AppText variant="micro" weight="medium" style={{ color: c.confirmed ? G.success : G.warning }} numberOfLines={1}>
          {c.confirmed ? t('devices.cmd_confirmed') : t('devices.cmd_awaiting')}
        </AppText>
      </View>
    </View>
  );
};

const CommandDiagnosticList = ({ commands }: { commands: CommandCheck[] }) => {
  const { t } = useSettings();
  const G = useGlass();
  return (
    <View style={{ marginTop: 12 }}>
      <View style={[styles.hintBox, { backgroundColor: G.mutedLight, borderColor: G.border }]}>
        <Info size={14} color={G.fg} />
        <AppText variant="caption" weight="medium" style={{ color: G.fg, flex: 1 }} numberOfLines={4}>
          {t('devices.cmd_notice')}
        </AppText>
      </View>
      <View style={styles.diagList}>
        {commands.map((c) => (
          <CmdRow key={c.id} c={c} />
        ))}
      </View>
    </View>
  );
};

// Per-print diagnostics for the virtual printer — counts/status only, no
// receipt/customer/payment content.
const VirtualTelemetry = ({ id }: { id: string }) => {
  const { t } = useSettings();
  const G = useGlass();
  const manager = getPeripheralManager();
  const dev = usePeripheralStore().devices.find((d) => d.id === id);
  if (!dev) return null;
  const m = manager.getVirtualMetrics(id);
  const connColor = m?.connection === 'connected' ? G.success : m?.connection === 'connecting' ? G.warning : m?.connection === 'error' ? G.error : G.muted;
  const rows: { label: string; value: string; color?: string }[] = [
    { label: t('devices.tel_host'), value: dev.address || '-' },
    { label: t('devices.tel_port'), value: String(dev.port ?? 9397) },
    { label: t('devices.tel_protocol'), value: t('devices.escpos_short') },
    { label: t('devices.tel_connection'), value: t(`devices.status_${m?.connection ?? 'disconnected'}`), color: connColor },
    { label: t('devices.tel_last_print'), value: m?.lastPrintAt ? new Date(m.lastPrintAt).toLocaleTimeString('en-GB') : t('devices.never_printed') },
    {
      label: t('devices.tel_last_result'),
      value:
        m?.lastResult === 'ok'
          ? t('devices.tel_result_ok')
          : m?.lastError
            ? `${t('devices.tel_result_failed')} · ${m.lastError}`
            : '-',
      color: m?.lastResult === 'ok' ? G.success : m?.lastResult === 'failed' ? G.error : undefined,
    },
    { label: t('devices.tel_bytes'), value: String(m?.bytesSent ?? 0) },
    { label: t('devices.tel_queue'), value: String(dev.printCopies ?? 1) },
  ];
  return (
    <View style={[styles.card, { backgroundColor: G.bgCard, borderColor: G.border }]}>
      <AppText variant="caption" weight="bold" style={{ color: G.muted, marginBottom: 4 }}>
        {t('devices.telemetry')}
      </AppText>
      {rows.map((r) => (
        <View key={r.label} style={styles.telemetryRow}>
          <AppText variant="caption" weight="medium" style={{ color: G.muted }}>
            {r.label}
          </AppText>
          <AppText variant="caption" weight="bold" style={{ color: r.color ?? G.fg }} numberOfLines={1}>
            {r.value}
          </AppText>
        </View>
      ))}
    </View>
  );
};

const BackBar = ({ title, onBack }: { title: string; onBack: () => void }) => {
  const G = useGlass();
  return (
    <View style={styles.backBar}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <ChevronLeft size={22} color={G.fg} />
      </TouchableOpacity>
      <AppText variant="body" weight="bold" style={{ color: G.fg, flex: 1 }} numberOfLines={1}>
        {title}
      </AppText>
    </View>
  );
};

// →→→ Peripheral center (list) →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
export const PeripheralCenter = ({ onClose }: { onClose: () => void }) => {
  const { t } = useSettings();
  const G = useGlass();
  const { devices } = usePeripheralStore();

  const [view, setView] = useState<ViewState>({ name: 'list' });

  const backToList = () => setView({ name: 'list' });

  if (view.name === 'add') {
    return <AddDeviceView role={view.role} onBack={backToList} />;
  }
  if (view.name === 'detail') {
    return (
      <DeviceDetailView
        id={view.id}
        onBack={backToList}
        onTestScanner={() => setView({ name: 'test-scanner' })}
        onTestPrinter={() => setView({ name: 'test-printer', id: view.id })}
      />
    );
  }
  if (view.name === 'diag') return <UnifiedDiagnosticsSheet onBack={backToList} />;
  if (view.name === 'logs') return <DeviceLogsSheet onBack={backToList} />;
  if (view.name === 'pos') return <PosDeviceSheet onBack={backToList} />;
  if (view.name === 'test-scanner') return <ScannerDiagnosticsSheet onBack={backToList} />;
  if (view.name === 'test-printer') return <PrinterDiagnosticsSheet id={view.id} onBack={backToList} />;

  const connectedCount = devices.filter((d) => d.status === 'connected').length;

  return (
    <View style={styles.sheetContent}>
      <AppText variant="heading" weight="bold" style={{ color: G.fg }} numberOfLines={2}>
        {t('devices.title')}
      </AppText>
      <AppText variant="body-sm" weight="medium" style={{ color: G.muted, marginTop: 4, marginBottom: 14 }} numberOfLines={2}>
        {t('devices.subtitle')}
      </AppText>

      <View style={[styles.banner, { backgroundColor: G.warning + '18', borderColor: G.warning + '40' }]}>
        <AlertTriangle size={16} color={G.warning} />
        <AppText variant="caption" weight="medium" style={{ color: G.fg, flex: 1 }} numberOfLines={3}>
          {t('devices.dev_build_banner')}
        </AppText>
      </View>

      <View style={[styles.summaryRow, { backgroundColor: G.bgCard, borderColor: G.border }]}>
        <AppText variant="caption" weight="medium" style={{ color: G.muted }}>
          {t('devices.devices')}
        </AppText>
        <AppText variant="body" weight="bold" style={{ color: G.fg }} numberOfLines={1}>
          {devices.length}
          <AppText variant="body" weight="regular" style={{ color: G.muted }}>
            {'  ·  '}
          </AppText>
          {connectedCount} {t('devices.connected_lower')}
        </AppText>
      </View>

      {devices.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: G.bgCard, borderColor: G.border }]}>
          <ScanLine size={28} color={G.muted} />
          <AppText variant="body" weight="bold" style={{ color: G.fg, marginTop: 10 }}>
            {t('devices.empty')}
          </AppText>
          <AppText variant="caption" weight="medium" style={{ color: G.muted, marginTop: 4, textAlign: 'center' }} numberOfLines={3}>
            {t('devices.empty_desc')}
          </AppText>
          <AppButton
            label={t('devices.add_device')}
            variant="secondary"
            leftIcon={<Plus size={18} color={G.fg} />}
            onPress={() => setView({ name: 'add' })}
            style={{ marginTop: 14 }}
          />
        </View>
      ) : (
        <View style={styles.deviceList}>
          {devices.map((dev) => {
            const Icon = ROLE_ICONS[dev.role] ?? ScanLine;
            return (
              <TouchableOpacity
                key={dev.id}
                activeOpacity={0.7}
                onPress={() => setView({ name: 'detail', id: dev.id })}
                style={[styles.deviceRow, { backgroundColor: G.bgCard, borderColor: G.border }]}
              >
                <View style={[styles.deviceIcon, { backgroundColor: G.accentGlass }]}>
                  <Icon size={20} color={G.fg} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="body" weight="bold" style={{ color: G.fg }} numberOfLines={1}>
                    {dev.name}
                  </AppText>
                  <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={1}>
                    {t(`devices.role_${dev.role}`)} · {t(`devices.${connLabelKey(dev.connectionType)}`)}
                  </AppText>
                </View>
                <StatusChip status={dev.status} />
                <ChevronRight size={16} color={G.muted} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <AppButton
        label={t('devices.add_device')}
        variant="primary"
        fullWidth
        leftIcon={<Plus size={18} color={G.bg} />}
        onPress={() => setView({ name: 'add' })}
        style={{ marginTop: 6 }}
      />

      <View style={[styles.settingsGroup, { backgroundColor: G.bgCard, borderColor: G.border }]}>
        <MenuItem
          icon={Activity}
          title={t('devices.diagnostics')}
          subtitle={t('devices.diagnostics_desc')}
          onPress={() => setView({ name: 'diag' })}
        />
        <MenuItem
          icon={History}
          title={t('devices.logs')}
          subtitle={t('devices.logs_desc')}
          onPress={() => setView({ name: 'logs' })}
        />
        <MenuItem
          icon={Smartphone}
          title={t('devices.pos_device')}
          subtitle={t('devices.pos_device_desc')}
          onPress={() => setView({ name: 'pos' })}
        />
      </View>

      <AppText variant="caption" weight="medium" style={{ color: G.muted, textAlign: 'center', marginTop: 16, marginBottom: 8 }}>
        {t('devices.registers_note')}
      </AppText>
    </View>
  );
};

// →→→ Add device →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

const AddDeviceView = ({ role: initialRole, onBack }: { role?: DeviceRole; onBack: () => void }) => {
  const { t } = useSettings();
  const G = useGlass();
  const manager = getPeripheralManager();

  const [role, setRole] = useState<DeviceRole | null>(initialRole ?? null);
  const [connection, setConnection] = useState<ConnectionType | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [port, setPort] = useState('');

  const chooseRole = (r: DeviceRole) => {
    setRole(r);
    const options = CONNECTION_OPTIONS[r];
    setConnection(options[0] ?? null);
  };

  const canSave = !!role && !!connection && name.trim().length > 0;
  const needsAddress =
    !!role && !!connection &&
    (connection === 'network_escpos' || connection === 'virtual_tcp_escpos' || connection === 'bluetooth_escpos' || connection === 'bluetooth_hid' ||
      connection === 'usb_escpos' || connection === 'usb_hid');
  const isNetwork = connection === 'network_escpos';
  const isVirtual = connection === 'virtual_tcp_escpos';
  const showEndpoint = isNetwork || isVirtual;
  const isScanRole = role === 'scanner';

  const handleSave = () => {
    if (!role || !connection || !name.trim()) return;
    const cfg = defaultConfig(role, connection);
    cfg.name = name.trim();
    if (needsAddress) cfg.address = address.trim() || undefined;
    if (isNetwork) cfg.port = parseInt(port, 10) > 0 ? parseInt(port, 10) : 9100;
    else if (isVirtual) cfg.port = parseInt(port, 10) > 0 ? parseInt(port, 10) : 9397;
    manager.addDevice(cfg);
    manager.connect(cfg.id);
    onBack();
  };

  return (
    <View style={styles.sheetContent}>
      <BackBar title={t('devices.add_device')} onBack={role ? (() => { setRole(null); setConnection(null); setName(''); }) : onBack} />

      {!role ? (
        <>
          <AppText variant="body-sm" weight="medium" style={{ color: G.muted, marginBottom: 12 }}>
            {t('devices.choose_type')}
          </AppText>
          <View style={styles.roleGrid}>
            {ROLE_ORDER.map((r) => {
              const Icon = ROLE_ICONS[r];
              return (
                <TouchableOpacity
                  key={r}
                  activeOpacity={0.7}
                  onPress={() => chooseRole(r)}
                  style={[styles.roleCard, { backgroundColor: G.bgCard, borderColor: G.border }]}
                >
                  <Icon size={22} color={G.fg} strokeWidth={2.2} />
                  <AppText variant="caption" weight="bold" style={{ color: G.fg, marginTop: 8, textAlign: 'center' }} numberOfLines={2}>
                    {t(`devices.role_${r}`)}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      ) : (
        <>
          <AppText variant="body-sm" weight="medium" style={{ color: G.muted, marginBottom: 10 }}>
            {t('devices.choose_connection')}
          </AppText>
          {(CONNECTION_OPTIONS[role] ?? []).map((c) => {
            const cap = transportCapability(c);
            const isSel = c === connection;
            const Icon =
              c === 'bluetooth_escpos' || c === 'bluetooth_hid' ? Radio : c === 'network_escpos' ? Activity : isVirtualConnection(c) ? Globe : ScanLine;
            return (
              <TouchableOpacity
                key={c}
                activeOpacity={0.7}
                onPress={() => setConnection(c)}
                style={[styles.connCard, { backgroundColor: G.bgCard, borderColor: isSel ? G.accent : G.border }]}
              >
                <Icon size={18} color={G.fg} strokeWidth={2.2} />
                <View style={{ flex: 1 }}>
                  <AppText variant="body" weight="bold" style={{ color: G.fg }} numberOfLines={1}>
                    {t(`devices.${connLabelKey(c)}`)}
                  </AppText>
                  <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={2}>
                    {t(`devices.conn_${connLabelKey(c)}_desc`)}
                  </AppText>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  {isVirtualConnection(c) ? <DevBadge /> : null}
                  <CapBadge state={cap.state} />
                </View>
              </TouchableOpacity>
            );
          })}

          <AppText variant="caption" weight="bold" style={{ color: G.muted, marginTop: 16, marginBottom: 8 }}>
            {t('devices.device_name')}
          </AppText>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t('devices.device_name_placeholder')}
            placeholderTextColor={G.placeholderColor}
            style={[styles.input, { backgroundColor: G.inputBg, borderColor: G.inputBorder, color: G.fg }]}
            maxLength={40}
          />

          {showEndpoint ? (
            <>
              <AppText variant="caption" weight="bold" style={{ color: G.muted, marginTop: 12, marginBottom: 8 }}>
                {t('devices.address')}
              </AppText>
              <TextInput
                value={address}
                onChangeText={setAddress}
                placeholder={isVirtual ? 'virtual-printer.online' : '192.168.1.50'}
                placeholderTextColor={G.placeholderColor}
                style={[styles.input, { backgroundColor: G.inputBg, borderColor: G.inputBorder, color: G.fg }]}
                maxLength={60}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <AppText variant="caption" weight="bold" style={{ color: G.muted, marginTop: 12, marginBottom: 8 }}>
                {t('devices.port')}
              </AppText>
              <TextInput
                value={port}
                onChangeText={setPort}
                placeholder={isVirtual ? '9397' : '9100'}
                placeholderTextColor={G.placeholderColor}
                style={[styles.input, { backgroundColor: G.inputBg, borderColor: G.inputBorder, color: G.fg }]}
                maxLength={5}
                keyboardType="number-pad"
              />
              {isVirtual ? (
                <>
                  <View style={[styles.readRow, { backgroundColor: G.bgCard, borderColor: G.border }]}>
                    <AppText variant="caption" weight="medium" style={{ color: G.muted }}>
                      {t('devices.protocol')}
                    </AppText>
                    <AppText variant="caption" weight="bold" style={{ color: G.fg }}>
                      {t('devices.escpos_short')}
                    </AppText>
                  </View>
                  <View style={[styles.readRow, { backgroundColor: G.bgCard, borderColor: G.border }]}>
                    <AppText variant="caption" weight="medium" style={{ color: G.muted }}>
                      {t('devices.transport')}
                    </AppText>
                    <AppText variant="caption" weight="bold" style={{ color: G.fg }}>
                      {t('devices.transport_tcp')}
                    </AppText>
                  </View>
                  <VirtualProbePanel host={address} port={parseInt(port, 10) || 0} />
                </>
              ) : null}
            </>
          ) : null}

          <View style={[styles.hintBox, { backgroundColor: isVirtual ? G.warning + '14' : isScanRole ? G.success + '14' : G.mutedLight, borderColor: isVirtual ? G.warning + '40' : isScanRole ? G.success + '40' : G.border }]}>
            {isVirtual ? <FlaskConical size={14} color={G.warning} /> : isScanRole ? <CheckCircle2 size={14} color={G.success} /> : <Info size={14} color={G.fg} />}
            <AppText variant="caption" weight="medium" style={{ color: G.fg, flex: 1 }} numberOfLines={3}>
              {t(isVirtual ? 'devices.virtual_note' : isScanRole ? 'devices.add_scan_hint' : 'devices.add_build_hint')}
            </AppText>
          </View>

          <AppButton label={t('common.save')} variant="primary" fullWidth disabled={!canSave} onPress={handleSave} style={{ marginTop: 18 }} />
        </>
      )}
    </View>
  );
};

// →→→ Device detail →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

const DeviceDetailView = ({
  id,
  onBack,
  onTestScanner,
  onTestPrinter,
}: {
  id: string;
  onBack: () => void;
  onTestScanner: () => void;
  onTestPrinter: () => void;
}) => {
  const { t } = useSettings();
  const G = useGlass();
  const manager = getPeripheralManager();
  const { devices } = usePeripheralStore();
  const dev = devices.find((d) => d.id === id);

  if (!dev) {
    return (
      <View style={styles.sheetContent}>
        <BackBar title={t('devices.title')} onBack={onBack} />
      </View>
    );
  }

  const Icon = ROLE_ICONS[dev.role] ?? ScanLine;
  const cap = transportCapability(dev.connectionType);
  const patch = (p: Partial<PeripheralConfig>) => manager.updateDevice(dev.id, p);

  const handleDelete = () => {
    Alert.alert(t('devices.delete_device'), t('devices.delete_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => { manager.removeDevice(dev.id); onBack(); } },
    ]);
  };

  const handleTest = async () => {
    if (dev.role === 'scanner') {
      onTestScanner();
      return;
    }
    if (dev.role === 'printer') {
      onTestPrinter();
      return;
    }
    const res = await manager.testDevice(dev.id);
    if (res.ok) Alert.alert(t('devices.test_drawer'), t('devices.drawer_test_sent'));
    else if (res.errorCode === 'needs_dev_build') Alert.alert(t('devices.requires_dev'), t('devices.dev_build_banner'));
    else Alert.alert(t('devices.connect_error'));
  };

  return (
    <View style={styles.sheetContent}>
      <BackBar title={dev.name} onBack={onBack} />

      <View style={[styles.deviceRow, { backgroundColor: G.bgCard, borderColor: G.border }]}>
        <View style={[styles.deviceIcon, { backgroundColor: G.accentGlass }]}>
          <Icon size={20} color={G.fg} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="body" weight="bold" style={{ color: G.fg }} numberOfLines={1}>
            {dev.name}
          </AppText>
          <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={1}>
            {t(`devices.role_${dev.role}`)} · {t(`devices.${connLabelKey(dev.connectionType)}`)}
          </AppText>
        </View>
        <StatusChip status={dev.status} />
      </View>

      <View style={styles.actionRow}>
        {dev.status === 'connected' ? (
          <AppButton label={t('devices.disconnect')} variant="secondary" onPress={() => manager.disconnect(dev.id)} style={{ flex: 1 }} />
        ) : (
          <AppButton label={t('devices.connect')} variant="primary" leftIcon={<Play size={16} color={G.bg} />} onPress={() => manager.connect(dev.id)} style={{ flex: 1 }} />
        )}
        <AppButton
          label={t(`devices.test_${dev.role}`)}
          variant="secondary"
          leftIcon={<Play size={16} color={G.fg} />}
          onPress={handleTest}
          style={{ flex: 1 }}
        />
      </View>

      <View style={[styles.card, { backgroundColor: G.bgCard, borderColor: G.border }]}>
        <AppText variant="caption" weight="bold" style={{ color: G.muted, marginBottom: 6 }}>
          {t('devices.capability')}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <CapBadge state={cap.state} />
          <AppText variant="caption" weight="medium" style={{ color: G.muted, flex: 1 }} numberOfLines={2}>
            {cap.state === 'available'
              ? t('devices.cap_available')
              : cap.state === 'needs_dev_build'
                ? t('devices.cap_dev_build')
                : t('devices.cap_unsupported')}
          </AppText>
        </View>
      </View>

      <AppText variant="caption" weight="bold" style={{ color: G.muted, marginTop: 14, marginBottom: 8 }}>
        {t('devices.configuration')}
      </AppText>

      {dev.role === 'scanner' ? (
        <>
          <AppText variant="caption" weight="medium" style={{ color: G.muted, marginBottom: 6 }}>
            {t('devices.scan_suffix')}
          </AppText>
          <Segmented
            options={[
              { key: 'enter', label: t('devices.suffix_enter') },
              { key: 'none', label: t('devices.suffix_none') },
            ]}
            value={dev.scanSuffix}
            onChange={(k) => patch({ scanSuffix: k === 'enter' ? 'enter' : 'none' })}
          />
          <ToggleRow title={t('devices.beep')} value={dev.beep} onValueChange={(v) => patch({ beep: v })} />
          <ToggleRow title={t('devices.vibration')} value={dev.vibration} onValueChange={(v) => patch({ vibration: v })} />
        </>
      ) : dev.role === 'printer' ? (
        <>
          <AppText variant="caption" weight="medium" style={{ color: G.muted, marginBottom: 6 }}>
            {t('devices.paper_width')}
          </AppText>
          <Segmented
            options={[
              { key: '58', label: t('devices.paper_58') },
              { key: '80', label: t('devices.paper_80') },
            ]}
            value={String(dev.paperWidth)}
            onChange={(k) => patch({ paperWidth: Number(k) === 80 ? 80 : 58 })}
          />
          {(dev.connectionType === 'network_escpos' || dev.connectionType === 'virtual_tcp_escpos') && dev.address ? (
            <View style={[styles.readRow, { backgroundColor: G.bgCard, borderColor: G.border }]}>
              <AppText variant="caption" weight="medium" style={{ color: G.muted }}>
                {t('devices.address')}
              </AppText>
              <AppText variant="caption" weight="bold" style={{ color: G.fg }} numberOfLines={1}>
                {dev.address}
                {dev.port ? `:${dev.port}` : ''}
              </AppText>
            </View>
          ) : null}
          {dev.connectionType === 'virtual_tcp_escpos' ? <VirtualProbePanel host={dev.address ?? ''} port={dev.port ?? 9397} /> : null}
        </>
      ) : dev.role === 'drawer' ? (
        <>
          <AppText variant="caption" weight="medium" style={{ color: G.muted, marginBottom: 6 }}>
            {t('devices.pin')}
          </AppText>
          <Segmented
            options={[
              { key: '2', label: t('devices.pin_2') },
              { key: '5', label: t('devices.pin_5') },
            ]}
            value={String(dev.pin)}
            onChange={(k) => patch({ pin: Number(k) === 5 ? 5 : 2 })}
          />
          <ToggleRow title={t('devices.open_cash_only')} value={dev.allowCashOnly} onValueChange={(v) => patch({ allowCashOnly: v })} />
        </>
      ) : null}

      {dev.role === 'scale' ? (
        <View style={[styles.hintBox, { backgroundColor: G.mutedLight, borderColor: G.border }]}>
          <Info size={14} color={G.fg} />
          <AppText variant="caption" weight="medium" style={{ color: G.fg, flex: 1 }} numberOfLines={3}>
            {t('devices.scale_note')}
          </AppText>
        </View>
      ) : null}

      <AppButton label={t('devices.delete_device')} variant="danger" fullWidth leftIcon={<Trash2 size={18} color="#fff" />} onPress={handleDelete} style={{ marginTop: 22 }} />
    </View>
  );
};

// →→→ Scanner diagnostics →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

export const ScannerDiagnosticsSheet = ({ onBack }: { onBack: () => void }) => {
  const { t } = useSettings();
  const G = useGlass();
  const [count, setCount] = useState(0);
  const [last, setLast] = useState<ScanResult | null>(null);

  usePeripheralScan({
    onProduct: (_item, result) => {
      setCount((c) => c + 1);
      setLast(result);
    },
    onUnknown: (result) => {
      setCount((c) => c + 1);
      setLast(result);
    },
  });

  return (
    <View style={styles.sheetContent}>
      <BackBar title={t('devices.test_scanner')} onBack={onBack} />

      <View style={[styles.banner, { backgroundColor: G.success + '14', borderColor: G.success + '40' }]}>
        <CheckCircle2 size={16} color={G.success} />
        <AppText variant="caption" weight="medium" style={{ color: G.fg, flex: 1 }} numberOfLines={3}>
          {t('devices.scanner_test_ready')}
        </AppText>
      </View>

      <View style={[styles.card, { backgroundColor: G.bgCard, borderColor: G.border }]}>
        <AppText variant="display" weight="bold" style={{ color: G.fg }}>
          {count}
        </AppText>
        <AppText variant="caption" weight="bold" style={{ color: G.muted }}>
          {t('devices.scan_count')}
        </AppText>
      </View>

      <View style={[styles.card, { backgroundColor: G.bgCard, borderColor: G.border }]}>
        <AppText variant="caption" weight="bold" style={{ color: G.muted, marginBottom: 6 }}>
          {t('devices.scan_result')}
        </AppText>
        <AppText variant="body" weight="bold" style={{ color: G.fg }} numberOfLines={2}>
          {last?.code ?? t('devices.scan_no_data')}
        </AppText>
        {last ? (
          <AppText variant="caption" weight="medium" style={{ color: G.muted }}>
            {t('devices.scan_format')}: {last.format} · {new Date(last.at).toLocaleTimeString('en-GB')}
          </AppText>
        ) : null}
      </View>

      <AppButton label={t('devices.scan_reset')} variant="secondary" fullWidth leftIcon={<RotateCcw size={16} color={G.fg} />} onPress={() => { setCount(0); setLast(null); }} style={{ marginTop: 8 }} />
      <AppText variant="caption" weight="medium" style={{ color: G.muted, textAlign: 'center', marginTop: 20 }}>
        {t('devices.scan_hint')}
      </AppText>
    </View>
  );
};

// →→→ Printer diagnostics →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

const buildTestPreview = (t: (k: string) => string, name: string, conn: ConnectionType, paper: 58 | 80): string => {
  const label = t(`devices.${connLabelKey(conn)}`);
  return [
    name,
    '** PRINTER TEST **',
    '--------------------------------',
    `Status     : [OK]`,
    `Connection : ${label}`,
    `Paper      : ${paper === 80 ? '80mm' : '58mm'}`,
    'Command set: ESC/POS',
    '--------------------------------',
    '[OK] Header row',
    '[OK] Data row',
    '[OK] Bold text',
    '[OK] LARGE',
    '--------------------------------',
    'BARCODE 123456789012',
    'QR: SHEGA-BUSINESS-2026',
    '--------------------------------',
    '*** TEST COMPLETE ***',
  ].join('\n');
};

export const PrinterDiagnosticsSheet = ({ id, onBack }: { id: string; onBack: () => void }) => {
  const { t } = useSettings();
  const G = useGlass();
  const manager = getPeripheralManager();
  const { devices } = usePeripheralStore();
  const dev = devices.find((d) => d.id === id);

  const [busy, setBusy] = useState(false);
  const [busySample, setBusySample] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sampleMessage, setSampleMessage] = useState<string | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<'test' | 'sample'>('test');
  const [cmd, setCmd] = useState<CommandDiagnosticResult | null>(null);

  if (!dev) {
    return (
      <View style={styles.sheetContent}>
        <BackBar title={t('devices.test_printer')} onBack={onBack} />
      </View>
    );
  }

  const isVirtual = dev.connectionType === 'virtual_tcp_escpos';
  const cap = transportCapability(dev.connectionType);
  const previewText =
    previewKind === 'test'
      ? buildTestPreview(t, dev.name, dev.connectionType, dev.paperWidth)
      : buildSampleReceiptPreview({ businessName: dev.name, paperWidth: dev.paperWidth });

  const run = async () => {
    setBusy(true);
    setMessage(null);
    setError(null);
    setPreviewKind('test');
    const res = await manager.testDevice(dev.id, {
      deviceName: dev.name,
      connectionLabel: t(`devices.${connLabelKey(dev.connectionType)}`),
      paperWidth: dev.paperWidth,
    });
    setBusy(false);
    if (res.ok) setMessage(t('devices.print_ok'));
    else if (res.errorCode === 'needs_dev_build') setError(t('devices.requires_dev'));
    else setError(t('devices.print_error'));
  };

  const runSample = async () => {
    setBusySample(true);
    setSampleMessage(null);
    setSampleError(null);
    const res = await manager.sampleReceipt(dev.id);
    setBusySample(false);
    setPreviewKind('sample');
    if (res.ok) setSampleMessage(t('devices.print_ok'));
    else if (res.errorCode === 'needs_dev_build') setSampleError(t('devices.requires_dev'));
    else setSampleError(t('devices.print_error'));
  };

  const runCmd = () => {
    setCmd(manager.commandDiagnostic(dev.id).result);
  };

  return (
    <View style={styles.sheetContent}>
      <BackBar title={t('devices.test_printer')} onBack={onBack} />

      <View style={[styles.card, { backgroundColor: G.bgCard, borderColor: G.border }]}>
        <AppText variant="caption" weight="bold" style={{ color: G.muted, marginBottom: 6 }}>
          {t('devices.connection')}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <CapBadge state={cap.state} />
          <AppText variant="caption" weight="medium" style={{ color: G.fg, flex: 1 }} numberOfLines={1}>
            {t(`devices.${connLabelKey(dev.connectionType)}`)}
          </AppText>
        </View>
      </View>

      {isVirtual ? <VirtualProbePanel host={dev.address ?? ''} port={dev.port ?? 9397} /> : null}

      <AppButton
        label={t('devices.print_test')}
        variant={cap.state === 'available' || isVirtual ? 'primary' : 'secondary'}
        fullWidth
        loading={busy}
        leftIcon={!busy ? <Play size={16} color={cap.state === 'available' || isVirtual ? G.bg : G.fg} /> : undefined}
        onPress={run}
        style={{ marginTop: 14 }}
      />

      {isVirtual ? (
        <View style={styles.actionRow}>
          <AppButton
            label={t('devices.print_sample_receipt')}
            variant="secondary"
            loading={busySample}
            leftIcon={!busySample ? <PrinterIcon size={16} color={G.fg} /> : undefined}
            onPress={runSample}
            style={{ flex: 1 }}
          />
          <AppButton
            label={t('devices.cmd_test')}
            variant="secondary"
            leftIcon={!cmd ? <FlaskConical size={16} color={G.fg} /> : undefined}
            onPress={runCmd}
            style={{ flex: 1 }}
          />
        </View>
      ) : null}

      {message ? (
        <View style={[styles.hintBox, { backgroundColor: G.success + '14', borderColor: G.success + '40' }]}>
          <CheckCircle2 size={14} color={G.success} />
          <AppText variant="caption" weight="medium" style={{ color: G.fg, flex: 1 }}>
            {message}
          </AppText>
        </View>
      ) : null}
      {error ? (
        <View style={[styles.hintBox, { backgroundColor: G.error + '14', borderColor: G.error + '40' }]}>
          <AlertTriangle size={14} color={G.error} />
          <AppText variant="caption" weight="medium" style={{ color: G.fg, flex: 1 }} numberOfLines={3}>
            {isVirtual ? `${error} — ${t('devices.virtual_dev_build')}` : `${error} — ${t('devices.print_dev_build')}`}
          </AppText>
        </View>
      ) : null}
      {sampleMessage ? (
        <View style={[styles.hintBox, { backgroundColor: G.success + '14', borderColor: G.success + '40' }]}>
          <CheckCircle2 size={14} color={G.success} />
          <AppText variant="caption" weight="medium" style={{ color: G.fg, flex: 1 }}>
            {sampleMessage}
          </AppText>
        </View>
      ) : null}
      {sampleError ? (
        <View style={[styles.hintBox, { backgroundColor: G.error + '14', borderColor: G.error + '40' }]}>
          <AlertTriangle size={14} color={G.error} />
          <AppText variant="caption" weight="medium" style={{ color: G.fg, flex: 1 }} numberOfLines={3}>
            {sampleError} — {t('devices.virtual_dev_build')}
          </AppText>
        </View>
      ) : null}

      {cmd ? (
        <View style={{ marginTop: 8 }}>
          <AppText variant="caption" weight="bold" style={{ color: G.muted, marginBottom: 4 }}>
            {t('devices.cmd_test')}
          </AppText>
          <AppText variant="micro" weight="medium" style={{ color: G.muted, marginBottom: 4 }}>
            {t('devices.cmd_bytes', { bytes: String(cmd.totalBytes) })} · ESC/POS
          </AppText>
          <CommandDiagnosticList commands={cmd.commands} />
        </View>
      ) : null}

      {isVirtual ? <VirtualTelemetry id={dev.id} /> : null}

      <AppText variant="caption" weight="bold" style={{ color: G.muted, marginTop: 16, marginBottom: 8 }}>
        {t('devices.preview')}
      </AppText>
      <View style={styles.receiptPreview}>
        <AppText variant="caption" weight="medium" style={{ color: '#111111', lineHeight: 18 }}>
          {previewText}
        </AppText>
      </View>
      <AppText variant="caption" weight="medium" style={{ color: G.muted, textAlign: 'center', marginTop: 10 }}>
        {t('devices.preview_note')}
      </AppText>
    </View>
  );
};

// →→→ Unified diagnostics →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

export const UnifiedDiagnosticsSheet = ({ onBack }: { onBack: () => void }) => {
  const { t } = useSettings();
  const G = useGlass();
  const manager = getPeripheralManager();
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<DiagnosticReport | null>(null);

  const run = async () => {
    setRunning(true);
    setReport(null);
    const r = await manager.runDiagnostics();
    setReport(r);
    setRunning(false);
  };

  useEffect(() => { void run(); }, []);

  const statusColor = (s: string): string =>
    s === 'ok' ? G.success : s === 'error' ? G.error : s === 'warn' ? G.warning : G.muted;

  return (
    <View style={styles.sheetContent}>
      <BackBar title={t('devices.diagnostics')} onBack={onBack} />

      <AppButton
        label={t('devices.check_permissions')}
        variant="primary"
        fullWidth
        loading={running}
        leftIcon={!running ? <Play size={16} color={G.bg} /> : undefined}
        onPress={run}
      />

      {report ? (
        <View style={styles.diagList}>
          {report.items.map((it) => {
            const st = statusColor(it.status);
            const Icon = it.status === 'ok' ? CheckCircle2 : it.status === 'error' ? AlertTriangle : Info;
            return (
              <View key={it.key} style={[styles.deviceRow, { backgroundColor: G.bgCard, borderColor: G.border }]}>
                <View style={[styles.deviceIcon, { backgroundColor: st + '18' }]}>
                  <Icon size={18} color={st} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="body" weight="bold" style={{ color: G.fg }} numberOfLines={1}>
                    {t(`devices.diag_${it.key}`)}
                  </AppText>
                  <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={3}>
                    {it.detail}
                  </AppText>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
};

// →→→ Device logs →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

export const DeviceLogsSheet = ({ onBack }: { onBack: () => void }) => {
  const { t } = useSettings();
  const G = useGlass();
  const manager = getPeripheralManager();
  const { devices } = usePeripheralStore();

  useEffect(() => { void devices; }, [devices]);

  const logs = manager.getLogs();
  const levelColor = (l: string): string => (l === 'error' ? G.error : l === 'warn' ? G.warning : G.muted);

  return (
    <View style={styles.sheetContent}>
      <BackBar title={t('devices.logs')} onBack={onBack} />

      {logs.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: G.bgCard, borderColor: G.border }]}>
          <History size={28} color={G.muted} />
          <AppText variant="body" weight="bold" style={{ color: G.fg, marginTop: 10 }}>
            {t('devices.logs_empty')}
          </AppText>
        </View>
      ) : (
        <>
          <View style={styles.diagList}>
            {[...logs].reverse().slice(0, 60).map((e) => (
              <View key={e.id} style={[styles.logRow, { backgroundColor: G.bgCard, borderColor: G.border }]}>
                <View style={[styles.logDot, { backgroundColor: levelColor(e.level) }]} />
                <View style={{ flex: 1 }}>
                  <AppText variant="caption" weight="bold" style={{ color: G.fg }} numberOfLines={2}>
                    {t(e.message, { name: e.deviceName, code: e.detail ?? '' })}
                  </AppText>
                  <AppText variant="micro" weight="medium" style={{ color: G.muted }} numberOfLines={1}>
                    {new Date(e.ts).toLocaleString('en-GB')} {e.deviceName ? `· ${e.deviceName}` : ''}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
          <AppButton label={t('devices.clear_logs')} variant="danger" fullWidth leftIcon={<Trash2 size={16} color="#fff" />} onPress={() => manager.clearLogs()} style={{ marginTop: 18 }} />
        </>
      )}
    </View>
  );
};

// →→→ POS terminal →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

export const PosDeviceSheet = ({ onBack }: { onBack: () => void }) => {
  const { t } = useSettings();
  const G = useGlass();
  const { devices } = usePeripheralStore();
  const assigned = devices.filter((d) => d.status === 'connected');

  return (
    <View style={styles.sheetContent}>
      <BackBar title={t('devices.pos_device')} onBack={onBack} />

      <View style={[styles.card, { backgroundColor: G.bgCard, borderColor: G.border }]}>
        <AppText variant="caption" weight="bold" style={{ color: G.muted, marginBottom: 6 }}>
          {t('devices.pos_terminal')}
        </AppText>
        <AppText variant="body" weight="bold" style={{ color: G.fg }}>
          {t('devices.this_register')}
        </AppText>
        <AppText variant="caption" weight="medium" style={{ color: G.muted, marginTop: 2 }}>
          {deviceIdentityString()}
        </AppText>
      </View>

      <AppText variant="caption" weight="bold" style={{ color: G.muted, marginTop: 14, marginBottom: 8 }}>
        {t('devices.assigned')}
      </AppText>
      {assigned.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: G.bgCard, borderColor: G.border }]}>
          <Smartphone size={26} color={G.muted} />
          <AppText variant="caption" weight="medium" style={{ color: G.muted, marginTop: 8, textAlign: 'center' }} numberOfLines={2}>
            {t('devices.assigned_empty')}
          </AppText>
        </View>
      ) : (
        <View style={styles.diagList}>
          {assigned.map((d) => (
            <View key={d.id} style={[styles.deviceRow, { backgroundColor: G.bgCard, borderColor: G.border }]}>
              <View style={[styles.deviceIcon, { backgroundColor: G.accentGlass }]}>
                <CheckCircle2 size={18} color={G.success} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="body" weight="bold" style={{ color: G.fg }} numberOfLines={1}>
                  {d.name}
                </AppText>
                <AppText variant="caption" weight="medium" style={{ color: G.muted }} numberOfLines={1}>
                  {t(`devices.role_${d.role}`)}
                </AppText>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={[styles.hintBox, { backgroundColor: G.mutedLight, borderColor: G.border }]}>
        <Info size={14} color={G.fg} />
        <AppText variant="caption" weight="medium" style={{ color: G.fg, flex: 1 }} numberOfLines={3}>
          {t('devices.registers_note')}
        </AppText>
      </View>
    </View>
  );
};

const deviceIdentityString = (): string => {
  const model = Device.modelName ? Device.modelName : 'POS terminal';
  return `Shega · ${model}`;
};

// →→→ Styles →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→

const styles = StyleSheet.create({
  sheetContent: { paddingTop: 20, paddingBottom: 12 },
  banner: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1 },
  hintBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderRadius: 10, padding: 10, marginTop: 12, borderWidth: 1 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 12, padding: 12, borderWidth: 1, marginBottom: 12 },
  empty: { alignItems: 'center', borderRadius: 14, padding: 24, borderWidth: 1 },
  deviceList: { gap: 10, marginBottom: 14 },
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 12, borderWidth: 1 },
  deviceIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  settingsGroup: { borderRadius: 16, overflow: 'hidden', marginTop: 12, borderWidth: 1 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  menuIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  backBar: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  backBtn: { padding: 4 },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  roleCard: { width: '48%', alignItems: 'center', borderRadius: 14, padding: 16, borderWidth: 1 },
  connCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1 },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, borderWidth: 1 },
  card: { borderRadius: 12, padding: 12, borderWidth: 1, marginTop: 12 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  readRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 10, padding: 10, borderWidth: 1, marginTop: 10 },
  diagList: { gap: 10, marginTop: 12 },
  logRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, padding: 12, borderWidth: 1 },
  logDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  receiptPreview: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 12, marginTop: 6 },
  telemetryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
});