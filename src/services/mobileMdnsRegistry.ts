/**
 * Mobile mDNS Registry — the single owner of the app's ONE native NSD slot.
 *
 * Android's `NsdManager` (backing react-native-zeroconf) allows exactly ONE
 * concurrent service registration and ONE active discovery listener, and its
 * JS wrapper gives no failure events (onRegistrationFailed is an empty stub).
 * The app has two advertisement sources (the POS hub `_shega-pos._tcp` and the
 * pairing beacon `_shega-pair._tcp`) and two browse sources (`shega-pos` in
 * mdnsDiscovery, `shega-pair` in the pairing radar). Previously each created
 * its own Zeroconf and stamped on the shared native instance, so the pairing
 * beacon's publish was silently rejected on boot (the hub ad already owned the
 * slot) — the phone was invisible over mDNS.
 *
 * This registry owns ONE Zeroconf instance, serializes registration changes
 * (always unregister-then-register so registerService can never hit
 * FAILURE_ALREADY_ACTIVE), enforces priority (pairing beacon preempts the hub
 * ad; the hub is re-published when the radar closes), tracks the browse slot,
 * and exposes diagnostics + change notifications for the discovery screens.
 */

import { NativeModules } from 'react-native';

// The library ships untyped JS; type as any so the real API surface is usable.
const ZeroconfMod: any = require('react-native-zeroconf');
const ZeroconfCtor: any = ZeroconfMod?.default ?? ZeroconfMod?.Zeroconf;

export type MdnsKind = 'hub' | 'pair';

export interface MdnsPublishRequest {
  kind: MdnsKind;
  /** Service type WITHOUT underscores: 'shega-pos' | 'shega-pair'. */
  serviceType: string;
  /** Instance name, e.g. 'Shega Pair — ACME Corp'. */
  name: string;
  port: number;
  txt: Record<string, string>;
}

export interface DiscoveryDiagnostics {
  nativePresent: boolean;
  zcCreated: boolean;
  activeKind: MdnsKind | null;
  activeName: string | null;
  activeSince: number | null;
  confirmed: boolean;
  hubDesired: boolean;
  activeBrowse: string | null;
  lastPublish: { at: number; kind: MdnsKind; name: string } | null;
  lastError: { at: number; message: string } | null;
}

const SLOT_FREE_GRACE_MS = 900;
const PUBLISH_ACK_TIMEOUT_MS = 2500;

class MobileMdnsRegistry {
  private zc: any | null = null;

  /** Everything that mutates the native slot goes through this queue. */
  private opQueue: Promise<void> = Promise.resolve();

  /** What WE think occupies the native registration slot right now. */
  private active: (MdnsPublishRequest & { at: number }) | null = null;
  /** Name the native side acked via RNZeroconfServiceRegistered — the ONLY
   *  name `NsdManager` will accept for unregister. */
  private confirmedName: string | null = null;

  /** Set after the first publish sweeps stale native registrations. A fresh
   *  registry JS instance (reload / Fast Refresh) can meet a native slot still
   *  owned by the previous session's registration — Android rejects a new one
   *  with FAILURE_ALREADY_ACTIVE and Java's onRegistrationFailed stays silent.
   *  We clear every device-derived name once per JS lifetime. */
  private firstSweepDone = false;

  private hubRequest: MdnsPublishRequest | null = null;
  private hubDesired = false;

  /** Service type(s) the discovery slot is scanning for ('shega-pos', ...). */
  private activeBrowse: string | null = null;

  private lastPublish: DiscoveryDiagnostics['lastPublish'] = null;
  private lastError: DiscoveryDiagnostics['lastError'] = null;

  // Slot-free waiting: `unregIssued` is true between unpublishService() and the
  // RNZeroconfServiceUnregistered ack; waiters are resolved on that ack.
  private unregIssued = false;
  private unregWaiters = new Set<() => void>();

  private warnedMissing = false;
  private changeListeners = new Set<() => void>();

  // Event fan-out to consumers (mdnsDiscovery, pairing radar, screens).
  private subs = new Map<string, Set<(data: any) => void>>();

  constructor() {
    if (!this.nativePresent) return;
    try {
      if (!ZeroconfCtor) throw new Error('react-native-zeroconf exports no constructor');
      this.zc = new ZeroconfCtor();
    } catch (e: any) {
      console.warn('[Discovery] registry: zeroconf init failed:', e?.message);
      this.zc = null;
      return;
    }
    this.zc.on?.('resolved', (service: any) => this.notify('resolved', service));
    this.zc.on?.('remove', (name: any) => this.notify('remove', typeof name === 'string' ? { name } : name));
    this.zc.on?.('error', (err: any) => this.notify('error', err));
    this.zc.on?.('published', (service: any) => {
      if (service?.name) {
        this.confirmedName = service.name;
        console.log(`[Discovery] mDNS native registration acked: "${service.name}"`);
      }
      this.notify('published', service);
      this.changed();
    });
    this.zc.on?.('unpublished', (service: any) => {
      if (service?.name) {
        const was = this.active;
        if (was && (this.confirmedName ?? was.name) === service.name) {
          console.log(`[Discovery] mDNS native slot freed: "${service.name}"`);
        }
      }
      for (const waiter of [...this.unregWaiters]) waiter();
      this.unregWaiters.clear();
      this.notify('unpublished', service);
      this.changed();
    });
    console.log('[Discovery] registry owning the single native NSD slot');
  }

  // ── Publish / unpublish (the "one writer" policy) ─────────────────────────

  /** Request an advertisement. Serialized; the pairing beacon preempts the hub ad. */
  publish(req: MdnsPublishRequest, force = false): Promise<void> {
    this.opQueue = this.opQueue
      .then(() => this.doPublish(req, force))
      .catch((e: any) => console.warn('[Discovery] registry publish error:', e?.message));
    return this.opQueue;
  }

  /** Stop advertising `kind`; restores the hub ad after a pair beacon stops. */
  unregister(kind: MdnsKind): Promise<void> {
    this.opQueue = this.opQueue
      .then(() => this.doUnregister(kind))
      .catch((e: any) => console.warn('[Discovery] registry unregister error:', e?.message));
    return this.opQueue;
  }

  private async doPublish(req: MdnsPublishRequest, force = false): Promise<void> {
    if (req.kind === 'hub') {
      this.hubRequest = req;
      this.hubDesired = true;
      if (!force && this.active?.kind === 'hub' && this.active.name === req.name) return; // already up
      if (this.active?.kind === 'pair') {
        // The beacon owns the slot — hub stays "wanted", restored on stop.
        console.log('[Discovery] hub ad deferred: pairing beacon owns the NSD slot');
        return;
      }
    }
    // Free the slot FIRST and wait for the native ack, otherwise the next
    // registerService hits FAILURE_ALREADY_ACTIVE (and Java stays silent).
    await this.unregisterSlot();
    if (!this.zc) {
      this.warnNativeMissing();
      return;
    }

    this.lastError = null;
    this.lastPublish = { at: Date.now(), kind: req.kind, name: req.name };
    this.active = { ...req, at: this.lastPublish.at };
    this.confirmedName = null;
    this.changed();

    // A freshly-instantiated registry (JS reload / Fast Refresh) may find the
    // single native NSD slot still occupied by a registration from the previous
    // JS lifetime. We cannot know which one it was, but every ad we ever issue
    // has a name derived from device_id — unpublish them ALL so the next
    // registerService cannot be rejected with FAILURE_ALREADY_ACTIVE.
    if (!this.firstSweepDone) {
      await this.sweepStaleRegistrations(req);
      this.firstSweepDone = true;
    }

    try {
      this.zc.publishService(req.serviceType, 'tcp', 'local.', req.name, req.port, req.txt);
      await this.waitForPublishedAck();
    } catch (e: any) {
      this.lastError = { at: Date.now(), message: e?.message ?? String(e) };
      console.warn('[Discovery] publish failed:', e?.message);
      this.active = null;
    }
    if (!this.confirmedName) {
      // Java's onRegistrationFailed is an empty stub, so a missing ack is our
      // only signal the slot was rejected. The sweep above is meant to prevent
      // this; if we still see it, retry once more — something re-registered
      // between the sweep and our publish, or the stale name used a shape this
      // registry version doesn't know.
      this.lastError = {
        at: Date.now(),
        message: `No native registration ack for "${req.name}" (silent rejection — slot conflict or NSD error)`,
      };
      console.warn(`[Discovery] ${this.lastError.message}`);
      await this.retryAfterStaleSlot(req);
    }
    console.log(
      `[Discovery] mDNS ${this.confirmedName ? 'registered' : 'publish issued'}: ${req.kind} "${req.name}" on ${req.port}`,
    );
    this.changed();
  }

  private async doUnregister(kind: MdnsKind): Promise<void> {
    if (this.active?.kind !== kind) {
      // Nothing of this kind occupies the slot, but the module's intent flag
      // cleanup still applies (e.g. hub withdrawn while the pair beacon owns
      // the slot — clear the "wanted" flag so no stale hub ad returns later).
      if (kind === 'hub') {
        this.hubDesired = false;
        this.hubRequest = null;
      }
      return;
    }
    await this.unregisterSlot();
    if (kind === 'hub') {
      this.hubDesired = false;
      this.hubRequest = null;
      return;
    }
    // Pair beacon stopped — restore the hub ad if something still wants it.
    if (this.hubDesired && this.hubRequest) {
      console.log('[Discovery] pairing beacon stopped — re-publishing hub advertisement');
      await this.doPublish(this.hubRequest);
    }
  }

  /**
   * Unregister whatever occupies the slot and wait until the native ack says it
   * is really free — Android rejects a new registration otherwise.
   */
  private async unregisterSlot(): Promise<void> {
    const current = this.active;
    this.active = null;
    this.changed();
    if (!current || !this.zc) return;

    // Use the name Android actually registered (it may have de-duplicated it).
    const name = this.confirmedName ?? current.name;
    this.confirmedName = null;
    this.unregIssued = true;
    const wait = this.waitForSlotFree();
    try {
      this.zc.unpublishService(name);
    } catch {
      // Not in NsdServiceImpl.mPublishedServices (failed registration) — the
      // slot is free as far as Android is concerned; nothing to wait for.
      this.unregIssued = false;
    }
    await wait;
    this.unregIssued = false;
    console.log(`[Discovery] slot released (was: ${current.kind} "${current.name}")`);
  }

  private waitForSlotFree(): Promise<void> {
    if (!this.unregIssued) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.unregWaiters.clear();
        resolve();
      }, SLOT_FREE_GRACE_MS);
      this.unregWaiters.add(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  private waitForPublishedAck(): Promise<void> {
    return new Promise((resolve) => {
      const startedAt = Date.now();
      const tick = () => {
        if (this.confirmedName) return resolve();
        if (Date.now() - startedAt >= PUBLISH_ACK_TIMEOUT_MS) return resolve();
        setTimeout(tick, 120);
      };
      tick();
    });
  }

  /**
   * Recovery pass for a registration that got no native ack. The most common
   * cause is a stale NsdManager registration left behind by a JS reload: our
   * name tracking reset to null, so we never issued the matching unpublish and
   * Android rejects the new registerService silently. Free every device-derived
   * name directly, then register once more.
   */
  private async retryAfterStaleSlot(req: MdnsPublishRequest): Promise<void> {
    if (!this.zc) return;
    try {
      await this.sweepStaleRegistrations(req);
    } catch { /* sweep is best-effort */ }
    try {
      this.zc.publishService(req.serviceType, 'tcp', 'local.', req.name, req.port, req.txt);
      await this.waitForPublishedAck();
    } catch (e: any) {
      this.lastError = { at: Date.now(), message: `retry publish failed: ${e?.message ?? String(e)}` };
      console.warn('[Discovery] retry publish failed:', e?.message);
      return;
    }
    if (this.confirmedName) {
      this.lastError = null;
      console.log(`[Discovery] mDNS slot recovered after stale-registration retry: "${req.name}"`);
    } else {
      console.warn(`[Discovery] retry also unacked — NSD slot still busy for "${req.name}"`);
    }
    this.changed();
  }

  /**
   * Unpublish EVERY registration name this device is ever known to issue, so a
   * stale native slot (surviving a JS reload via Fast Refresh / dev-menu
   * reload) can always be freed. Every ad name is derivable from the beacon TOT
   * TXT `device_id`: the pairing beacon (`Shega Pair — <8>`) and the POS hub
   * (`Shega Mobile Hub (<8>)`). Unpublishing a never-registered name is a safe
   * no-op in react-native-zeroconf.
   */
  private async sweepStaleRegistrations(req: MdnsPublishRequest): Promise<void> {
    if (!this.zc) return;
    const deviceShort = String(req.txt?.device_id ?? '').slice(0, 8);
    const names = new Set<string>([req.name]);
    if (deviceShort) {
      names.add(`Shega Pair — ${deviceShort}`);
      names.add(`Shega Mobile Hub (${deviceShort})`);
    }
    for (const name of names) {
      try {
        this.zc.unpublishService(name);
      } catch {
        // Name was never registered in this native lifetime — nothing to free.
        this.unregIssued = false;
        continue;
      }
      this.unregIssued = true;
      const wait = this.waitForSlotFree();
      await Promise.race([wait, new Promise((r) => setTimeout(r, SLOT_FREE_GRACE_MS))]);
      this.unregIssued = false;
      console.log(`[Discovery] swept stale native registration: "${name}"`);
    }
  }

  // ── Browsing (ONE active discovery on Android) ────────────────────────────

  /** Ask NSD to browse the given service type(s). The newest call owns the
   *  discovery slot; callers that temporarily preempt the default `shega-pos`
   *  browse must call `restoreDefaultBrowse()` when they finish. */
  browse(serviceTypes: string | string[]): void {
    if (!this.zc) {
      this.warnNativeMissing();
      return;
    }
    // Android's NSD manager supports one active discovery listener per
    // Zeroconf instance. Calling scan() repeatedly does not create multiple
    // listeners; the later call replaces or silently breaks the first one.
    // Select one canonical service for this mode instead of pretending both
    // scans are active. Legacy `_shega-pos` pairing records are still handled
    // by the LAN fallback and by desktop Bonjour discovery.
    const requested = Array.isArray(serviceTypes) ? serviceTypes : [serviceTypes];
    const type = requested.includes('shega-pair') ? 'shega-pair' : requested[0];
    if (!type) return;
    try {
      this.zc.scan(type, 'tcp');
    } catch (e: any) {
      this.lastError = { at: Date.now(), message: `browse ${type} failed: ${e?.message}` };
      console.warn('[Discovery] browse failed:', e?.message);
    }
    this.activeBrowse = type;
    console.log(`[Discovery] browsing for: ${this.activeBrowse}`);
    this.changed();
  }

  /** Bring back the boot-time hub browse (used when the pairing radar closes). */
  restoreDefaultBrowse(): void {
    if (this.activeBrowse === 'shega-pos') return;
    this.browse('shega-pos');
  }

  /** Re-issue the current browse (e.g. after the app returns to the foreground
   *  or Wi-Fi drops/reconnects — mDNS state can go stale). */
  refreshBrowse(): void {
    if (!this.activeBrowse) return;
    this.browse(this.activeBrowse);
  }

  isBrowsing(type: string): boolean {
    return this.activeBrowse?.split(',').includes(type) ?? false;
  }

  /**
   * Re-arm the whole mDNS state after a network handover / app-foreground /
   * connectivity-restored event: Android drops NSD state when the interface
   * changes, so re-issue the browse and force a fresh registration of whatever
   * is currently advertised (or would be, if a hub is still wanted).
   */
  reassert(): void {
    const hadState = this.activeBrowse != null || this.active != null || this.hubDesired;
    if (!hadState) return;
    if (this.activeBrowse) this.browse(this.activeBrowse.split(','));
    const current = this.active;
    if (current) {
      this.publish({ ...current }, true);
    } else if (this.hubDesired && this.hubRequest) {
      this.publish(this.hubRequest, true);
    }
    if (hadState) this.logDiagnostics();
  }

  // ── Consumer events ───────────────────────────────────────────────────────

  /** Subscribe to the shared instance's events. Returns an unsubscribe fn. */
  on(event: string, cb: (data: any) => void): () => void {
    const set = this.subs.get(event) ?? new Set();
    set.add(cb);
    this.subs.set(event, set);
    return () => {
      set.delete(cb);
      if (set.size === 0) this.subs.delete(event);
    };
  }

  private notify(event: string, data?: any): void {
    for (const cb of [...(this.subs.get(event) ?? [])]) {
      try {
        cb(data);
      } catch (e: any) {
        console.warn(`[Discovery] listener for "${event}" threw:`, e?.message);
      }
    }
  }

  /** Cached resolved services, keyed by instance name. */
  getServices(): Record<string, any> {
    return this.zc?.getServices?.() ?? {};
  }

  // ── Diagnostics ───────────────────────────────────────────────────────────

  get nativePresent(): boolean {
    return NativeModules?.RNZeroconf != null;
  }

  isActive(kind: MdnsKind): boolean {
    return this.active?.kind === kind;
  }

  getSnapshot(): DiscoveryDiagnostics {
    return {
      nativePresent: this.nativePresent,
      zcCreated: this.zc != null,
      activeKind: this.active?.kind ?? null,
      activeName: this.active?.name ?? null,
      activeSince: this.active?.at ?? null,
      confirmed: this.confirmedName != null,
      hubDesired: this.hubDesired,
      activeBrowse: this.activeBrowse,
      lastPublish: this.lastPublish,
      lastError: this.lastError,
    };
  }

  /** Tagged one-line summary for consoles / log viewers / support screens. */
  logDiagnostics(): void {
    const d = this.getSnapshot();
    console.log(
      '[Discovery] diag: ' +
        `native=${d.nativePresent} zc=${d.zcCreated} ` +
        `reg=${d.activeKind ? `${d.activeKind}(${d.activeName})` : 'none'}` +
        `${d.activeKind ? (d.confirmed ? '' : ' [unconfirmed]') : ''} ` +
        `hubWanted=${d.hubDesired} browse=${d.activeBrowse ?? 'none'} ` +
        `lastPublish=${d.lastPublish ? new Date(d.lastPublish.at).toLocaleTimeString() : 'never'} ` +
        `lastError=${d.lastError ? `${new Date(d.lastError.at).toLocaleTimeString()} "${d.lastError.message}"` : 'none'}`,
    );
  }

  /** Subscribe to any registry state change (diagnostics refresh). */
  onChange(cb: () => void): () => void {
    this.changeListeners.add(cb);
    return () => { this.changeListeners.delete(cb); };
  }

  private changed(): void {
    for (const cb of [...this.changeListeners]) {
      try { cb(); } catch { /* a listener must not break the registry */ }
    }
  }

  private warnNativeMissing(): void {
    if (this.warnedMissing) return;
    this.warnedMissing = true;
    console.warn('[Discovery] react-native-zeroconf unavailable (native module missing — run `npx expo run:android` to re-link; Expo Go has no NSD).');
  }
}

/** App singleton — the ONLY holder of a live Zeroconf object. */
export const mdnsRegistry = new MobileMdnsRegistry();