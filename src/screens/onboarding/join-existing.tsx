import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, CheckCircle2, ShieldAlert } from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/context/ToastContext';
import { AppText } from '@/components/ui';
import { RadarPulse } from '@/components/RadarPulse';
import { getGlass } from './glass-theme';
import { wsSyncClient } from '@/services/wsSyncClient';
import { validateInviteCode, submitJoinRequest, restoreBusinessFromJoin, resolveJoinDeviceId } from '@/services/invitationService';
import { directDeviceHello, directResolveInvite, directSubmitJoin, directJoinStatus, desktopHttpResolveInvite, isHubReachable } from '@/services/directJoinClient';
import { mobilePairingBeacon, getThisDeviceName } from '@/services/mobilePairingBeacon';
import { mdnsDiscovery } from '@/services/mdnsDiscovery';
import { getThisDeviceId } from '@/services/businessService';
import { getHubUrl, setHubToken, setHubUrl } from '@/services/syncService';
import { acceptPairing, lookupPairingInvite, pairingStatus, type PairingStatus } from '@/services/pairingService';
import { fetchMyMemberships } from '@/services/api';
import { ensureRemoteBusinessSeeded } from '@/services/businessService';
import { setJoinResumeDone } from '@/services/postAuthRouter';
import { safeBackOrFallback } from '@/services/navigation';

type Stage = 'idle' | 'resolved' | 'sent';

export default function JoinExistingScreen() {
  const { colors } = useSettings();
  const G = getGlass(colors);
  const { showToast } = useToast();
  // C10 guard: auto-poll and the manual "Check Approval Status" can both fire
  // before state settles — navigate to /initial-sync exactly once.
  const doneRef = useRef(false);
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [name, setName] = useState('');
  const [resolved, setResolved] = useState<{
    businessId: string;
    code: string;
    businessName?: string;
    role?: string;
    name?: string;
    source?: 'lan' | 'cloud';
    kind?: 'join' | 'shg' | 'direct';
  } | null>(null);
  const [cloudInvitationId, setCloudInvitationId] = useState<string | null>(null);
  const [decision, setDecision] = useState<{ status: string; role?: string; joinerUser?: string; name?: string } | null>(null);
  const [checking, setChecking] = useState(false);
  // Bluetooth-style discovery: nearby owners broadcasting pairing beacons.
  const [nearby, setNearby] = useState<Array<{ businessId: string; businessName: string; code: string; role?: string; ownerPlatform?: string; ownerName?: string; host?: string; port?: number }>>([]);
  // Join Mode is a waiting/radar screen: no code entry. 'connecting' while a
  // discovered business is being resolved + requested, 'notfound' after the
  // search window elapses with nothing on the network.
  const [joinPhase, setJoinPhase] = useState<'searching' | 'connecting' | 'notfound'>('searching');
  const [selfName] = useState(getThisDeviceName());
  const resolvedRef = useRef<typeof resolved>(null);
  const autoTriedRef = useRef<Set<string>>(new Set());
  const connectingRef = useRef(false);
  const preferredTargetRef = useRef<{ host: string; port: number; http?: boolean } | null>(null);

  // Network check & multi-method discovery pipeline
  const [netCheck, setNetCheck] = useState<{
    hasLan: boolean;
    hasInternet: boolean;
    checked: boolean;
  }>({ hasLan: true, hasInternet: true, checked: false });

  const inspectNetwork = async () => {
    try {
      const { canSweepLan } = require('@/services/lanSweep');
      const { checkInternetConnection } = require('@/services/connectivity');
      const [lan, internet] = await Promise.all([
        canSweepLan().catch(() => false),
        checkInternetConnection(true).catch(() => false),
      ]);
      setNetCheck({ hasLan: lan, hasInternet: internet, checked: true });
    } catch {
      setNetCheck({ hasLan: true, hasInternet: true, checked: true });
    }
  };

  useEffect(() => {
    inspectNetwork();
    const interval = setInterval(inspectNetwork, 6000);
    return () => clearInterval(interval);
  }, []);

  const retryDiscovery = () => {
    autoTriedRef.current.clear();
    setJoinPhase('searching');
    inspectNetwork();
    try {
      mobilePairingBeacon.startBrowsing();
      mobilePairingBeacon.setDiscoverable(true, 'Shega', 'team');
    } catch { /* ignore */ }
  };

  // Auto-discovery: entering Joining Mode makes this device both search for
  // nearby owners AND become visible to them (mutual discoverability), and
  // keeps a live discovery list refreshed without pressing any button.
  useEffect(() => {
    let onTargetFound: any = null;
    try {
      mobilePairingBeacon.startBrowsing();
      mobilePairingBeacon.setDiscoverable(true, 'Shega', 'team');
      const { connectionManager } = require('@/services/connectionManager');
      connectionManager.startDiscovery(code);

      onTargetFound = (target: any) => {
        refreshNearbyList();
        if (target?.host && stage === 'idle') {
          const isDesktop = target.platform === 'desktop' || target.port === 5757;
          resolveCodeLessHub({
            host: target.host,
            port: target.port,
            businessId: target.businessId,
            businessName: target.businessName || target.deviceName,
            role: target.role || 'cashier',
            ownerPlatform: isDesktop ? 'desktop' : 'mobile',
          });
        }
      };
      connectionManager.on('targetFound', onTargetFound);
    } catch { /* native mDNS unavailable — manual code entry still works */ }

    const refreshNearbyList = () => {
      try {
        setNearby(mobilePairingBeacon.getNearbyOwners().map(({ beacon, host }) => ({
          businessId: beacon.businessId,
          businessName: beacon.businessName,
          code: beacon.code,
          role: beacon.role,
          ownerPlatform: beacon.owner?.platform,
          ownerName: beacon.owner?.deviceName,
          host,
          port: beacon.owner?.platform === 'mobile' ? 5759 : 5757,
        })));
      } catch { /* ignore */ }
    };

    const sub = mobilePairingBeacon.onFound(refreshNearbyList);
    const nearbyInterval = setInterval(refreshNearbyList, 1200);
    return () => {
      sub();
      clearInterval(nearbyInterval);
      if (onTargetFound) {
        try {
          const { connectionManager } = require('@/services/connectionManager');
          connectionManager.off('targetFound', onTargetFound);
        } catch { /* ignore */ }
      }
      try { mobilePairingBeacon.setDiscoverable(false); } catch { /* ignore */ }
      try { mobilePairingBeacon.stopBrowsing(); } catch { /* ignore */ }
      try {
        const { connectionManager } = require('@/services/connectionManager');
        connectionManager.stopDiscovery();
      } catch { /* ignore */ }
    };
  }, []);

  /** Resolve a discovered invite and send the join request — no typing. */
  const connectWithCode = async (rawCode: string) => {
    if (connectingRef.current) return;
    connectingRef.current = true;
    setJoinPhase('connecting');
    try {
      setCode(rawCode.toUpperCase());
      await resolve(rawCode);
      const info = resolvedRef.current;
      if (info) await submit(info);
      else setJoinPhase('searching');
    } finally {
      connectingRef.current = false;
    }
  };

  /**
   * The device entry in the radar is ALWAYS selectable — that is the point of
   * "no QR, no pairing code". Tapping a nearby device opens the joiner's
   * built-in resolution path (auto-discovered invite code, LAN hub, desktop
   * HTTP fallback, cloud). When the owner has not yet opened an invite for that
   * business, the joiner still selects the device; the resolution steps will
   // surface a clear, actionable message instead of silently dropping the tap.
   *
   * This is the fix for "I can see the device but tapping it does nothing /
   * says No invite code".
   */
  const pickNearby = async (b: { businessName: string; code: string; ownerName?: string; ownerPlatform?: string; role?: string; host?: string; port?: number }) => {
    let targetCode = b.code;
    if (!targetCode && b.host) {
      preferredTargetRef.current = {
        host: b.host,
        port: b.port || (b.ownerPlatform === 'mobile' ? 5759 : 5757),
        http: b.ownerPlatform !== 'mobile',
      };
      try {
        if (b.ownerPlatform === 'mobile') {
          const info = await directDeviceHello({ host: b.host, port: b.port || 5759 });
          if (info?.inviteCode) targetCode = String(info.inviteCode);
        } else {
          const res = await fetch(`http://${b.host}:${b.port || 5757}/sync/info`);
          if (res.ok) {
            const info = await res.json();
            if (info?.inviteCode) targetCode = String(info.inviteCode);
          }
        }
      } catch { /* proceed to toast fallback */ }
    }

    if (targetCode) {
      void connectWithCode(targetCode);
      return;
    }

    // Direct Radar-Tap Join (code-less connect to target host)
    if (b.host) {
      void resolveCodeLessHub(b);
      return;
    }

    preferredTargetRef.current = null;
    showToast(
      `${b.businessName} is visible but unreachable. Ensure both devices are on the same Wi-Fi or hotspot.`,
      'info',
    );
  };

  const params = useLocalSearchParams<{ resume?: string; code?: string }>();
  const resumeId = params.resume;
  // Scanning the owner's invitation QR lands here with the code prefilled and
  // auto-connects — no typing. autoCode guards the auto-discovery fallback so
  // a stray nearby beacon cannot hijack a code that was explicitly scanned.
  const autoCode = typeof params.code === 'string' ? params.code.trim().toUpperCase() : '';
  const usedParamRef = useRef(false);

  // Apply a scanned invitation code immediately (and only once), before the
  // auto-discovery effect below can auto-connect a different nearby beacon.
  useEffect(() => {
    if (!autoCode || usedParamRef.current) return;
    usedParamRef.current = true;
    void connectWithCode(autoCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCode]);

  // Applies a cloud pairing-status record to the UI. Shared by the resume
  // restore, the manual "Check Approval Status" button and the 4s auto-poll,
  // so a request that resolves while the app is closed (or this screen is
  // open) transitions exactly once. Terminal outcomes are flagged so a later
  // restart does not keep re-hijacking startup onto this screen.
  const applyStatus = async (rec: PairingStatus, opts?: { personName?: string; quiet?: boolean }) => {
    if (rec.status === 'pending' || rec.status === 'used') {
      setDecision({ status: 'pending' });
      if (!opts?.quiet) showToast('Still waiting for the owner to approve.', 'info');
      return;
    }
    void setJoinResumeDone(String(rec.id));
    if (rec.status === 'approved') {
      if (doneRef.current) return;
      const personName = (opts?.personName || name.trim() || resolved?.name || 'New Member').trim();
      const bizName = await seedJoinedBusiness(personName);
      doneRef.current = true;
      setDecision({ status: 'approved', role: rec.role || resolved?.role, name: personName });
      showToast(`You're in! Welcome to ${bizName}.`, 'success');
      router.replace({ pathname: '/initial-sync', params: { business: bizName, role: rec.role || resolved?.role || 'cashier', device: 'This Device' } } as any);
      return;
    }
    setDecision({ status: 'rejected', role: rec.role });
    if (!opts?.quiet) showToast('Request declined.', 'info');
  };

  // Resume after restart: the request lives on the backend, so on mount we
  // restore Waiting for Approval (pending/used), or jump straight to the
  // terminal outcome (approved/rejected/expired) that happened while closed.
  useEffect(() => {
    if (!resumeId) return;
    let cancelled = false;
    (async () => {
      try {
        const rec = await pairingStatus(resumeId);
        if (cancelled) return;
        if (rec.status === 'pending' || rec.status === 'used') {
          setResolved({
            businessId: rec.business_id,
            code: '',
            businessName: rec.business_name,
            role: rec.role,
            name: rec.employee_name ?? undefined,
            source: 'cloud',
          });
          setCloudInvitationId(resumeId);
          setStage('sent');
        } else {
          await applyStatus(rec, { personName: rec.employee_name ?? undefined, quiet: true });
        }
      } catch (e: any) {
        if (!cancelled) showToast(e?.message || 'Could not restore your request. Try the invitation code again.', 'error');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeId]);

  // Auto-approval while Waiting: poll the backend pairing record every 4s so
  // the join completes as soon as the owner approves — no manual check needed.
  useEffect(() => {
    if (stage !== 'sent' || !cloudInvitationId || resolved?.source !== 'cloud') return;
    if (decision?.status === 'approved' || decision?.status === 'rejected') return;
    const timer = setInterval(() => {
      (async () => {
        try {
          const rec = await pairingStatus(cloudInvitationId);
          await applyStatus(rec, { quiet: true });
        } catch {
          /* keep polling; transient network noise must not kill the wait */
        }
      })();
    }, 4000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, cloudInvitationId, resolved, decision?.status, name]);

  // LAN path (C7/C10): the hub neither pushes the decision nor has a cloud
  // record to poll, so poll the record the manual button checks every 2s until
  // a terminal outcome. doneRef makes concurrent polls idempotent.
  useEffect(() => {
    if (!resolved || resolved.source !== 'lan') return;
    if (decision?.status === 'approved' || decision?.status === 'rejected') return;
    const timer = setInterval(() => {
      (async () => {
        try {
          await checkStatus(true);
        } catch {
          /* keep polling; transient LAN noise must not kill the wait */
        }
      })();
    }, 2000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, resolved, decision?.status, name, code]);

  const resolve = async (overrideCode?: string) => {
    const trimmed = (overrideCode ?? code).trim();
    resolvedRef.current = null;
    if (!trimmed) { showToast('Enter the invitation code', 'error'); return; }

    // 1) LAN hub is the fastest path when it is on the same network.
    //    Desktop user-invites (SHG-…) are a different request family — they
    //    live in user_invites, not invitations — so a failed join resolve on an
    //    SHG-… code falls through to the dedicated user-invite query below.
    const isShg = /^SHG-/i.test(trimmed);
    let inviteInfo: { businessId: string; code: string; businessName?: string; role?: string; name?: string; source?: 'lan' | 'cloud'; kind?: 'join' | 'shg' | 'direct' } | null = null;
    if (wsSyncClient.isConnected) {
      try {
        const res = await wsSyncClient.resolveInvitation(trimmed);
        const inv = res?.invitation;
        if (inv) {
          inviteInfo = {
            businessId: inv.businessId,
            code: inv.code,
            businessName: inv.businessName ?? undefined,
            role: inv.role ?? undefined,
            name: inv.name ?? undefined,
            source: 'lan',
          };
        }
      } catch (e: any) {
        if (String(e?.message).includes('INVITE_INVALID')) {
          // The existing WS connection may belong to a different hub. Keep
          // searching the selected/direct LAN targets before declaring the
          // invitation unavailable.
        }
      }
      if (!inviteInfo && isShg) {
        try {
          const invRes = await wsSyncClient.getHubInviteStatus(trimmed);
          const inv = invRes?.invite;
          if (inv) {
            if (inv.status === 'pending') { showToast('This invitation was already claimed by another device.', 'error'); return; }
            if (inv.status !== 'open') { showToast(inv.status === 'approved' ? 'This invitation was already approved.' : 'This invitation is no longer available.', 'error'); return; }
            inviteInfo = {
              businessId: String(inv.businessId),
              code: trimmed,
              businessName: inv.businessName,
              role: inv.suggestedRole ?? undefined,
              source: 'lan',
              kind: 'shg',
            };
          }
        } catch { /* fall through to the generic not-found */ }
      }
    }
    // 2) Direct hub reach (no pairing yet): probe the nearby beacons/discovered
    //    hubs and the mobile POS hub for the code — this is how a joiner finds an
    //    owner who just created the business on their phone, with no cloud at all.
    if (!inviteInfo) {
      const targets: Array<{ host: string; port: number; http?: boolean }> = [];
      if (preferredTargetRef.current) targets.push(preferredTargetRef.current);
      try {
        for (const { beacon, host, addresses } of mobilePairingBeacon.getNearbyOwners() as any[]) {
          if (beacon.code?.toUpperCase() === trimmed.toUpperCase()) {
            const h = host || addresses?.[0];
            if (h) {
              const mobile = beacon.owner?.platform === 'mobile';
              targets.push({ host: h, port: mobile ? 5759 : 5757, http: !mobile });
            }
          }
        }
      } catch { /* beacon module unavailable */ }
      try {
        for (const hub of mdnsDiscovery.getDiscoveredHubs()) {
          const h = hub.addresses?.[0] || hub.host;
          if (h) {
            const mobile = hub.platform === 'mobile' || hub.port === 5759;
            targets.push({
              host: h,
              port: hub.port || (mobile ? 5759 : 5757),
              http: !mobile,
            });
          }
        }
      } catch { /* discovery unavailable */ }
      for (const target of targets) {
        try {
          if (!(await isHubReachable(target))) continue;
          const inv = target.http
            ? await desktopHttpResolveInvite(`http://${target.host}:${target.port}`, trimmed)
            : await directResolveInvite(target, trimmed);
          if (inv) {
            inviteInfo = {
              businessId: inv.businessId,
              code: inv.code,
              businessName: inv.businessName ?? undefined,
              role: inv.role ?? undefined,
              name: inv.name ?? undefined,
              source: 'lan',
              kind: 'direct',
            };
            (inviteInfo as any).directTarget = target;
            break;
          }
        } catch { /* try the next target */ }
      }
      // Desktop hub HTTP fallback (joiner finds a desktop owner without WS).
      if (!inviteInfo) {
        try {
          const { getDiscoveredServices } = require('@/services/mdnsDiscovery') as any;
          void getDiscoveredServices; // desktop hubs come through mdnsDiscovery below
        } catch { /* ignore */ }
        for (const hub of mdnsDiscovery.getDiscoveredHubs()) {
          const h = hub.addresses?.[0] || hub.host;
          if (!h) continue;
          const baseUrl = `http://${h}:5757`;
          const inv = await desktopHttpResolveInvite(baseUrl, trimmed);
          if (inv) {
            inviteInfo = {
              businessId: inv.businessId,
              code: inv.code ?? trimmed,
              businessName: inv.businessName ?? undefined,
              role: inv.role ?? undefined,
              name: inv.name ?? undefined,
              source: 'lan',
              kind: 'direct',
            };
            (inviteInfo as any).directTarget = { host: h, port: 5757, http: true };
            break;
          }
        }
      }
    }
    if (!inviteInfo) {
      const local = validateInviteCode(trimmed);
      if (local) {
        inviteInfo = { businessId: local.business_id, code: local.code, role: local.role ?? undefined, name: local.name ?? undefined, source: 'lan' };
      } else {
        try {
          const cloud = await lookupPairingInvite({ code: trimmed });
          inviteInfo = {
            businessId: cloud.business_id,
            code: trimmed,
            businessName: cloud.business_name,
            role: cloud.role ?? undefined,
            name: cloud.employee_name ?? undefined,
            source: 'cloud',
          };
        } catch (e: any) {
          const msg = String(e?.message || '');
          if (/already used|used|approved|rejected|cancelled|revoked|expired|not found|no longer open/i.test(msg)) {
            showToast(msg, 'error');
            return;
          }
        }
      }
    }
    if (!inviteInfo) {
      showToast("Can't find that invitation. Connect to your business LAN network and try again.", 'error');
      return;
    }
    setResolved(inviteInfo);
    resolvedRef.current = inviteInfo;
    setStage('resolved');
  };

  const submit = async (override?: typeof resolved) => {
    const invite = override ?? resolved;
    if (!invite) return;
    const personName = (name.trim() || invite.name || 'New Member').trim();
    try {
      if (invite.source === 'cloud') {
        // Cloud path: accept directly against the backend. The device + membership
        // become pending; the owner approves from their BusinessManagement screen.
        const acceptRes = await acceptPairing({
          code: invite.code,
          deviceName: `My ${Platform.OS}`,
          platform: 'mobile',
        });
        if (acceptRes.status === 'active') {
          await seedJoinedBusiness(personName);
          setDecision({ status: 'approved', role: invite.role, joinerUser: personName });
          router.replace({ pathname: '/initial-sync', params: { business: invite.businessName || 'Your Business', role: invite.role || 'cashier', device: 'This Device' } } as any);
        } else {
          setCloudInvitationId(acceptRes.invitation_id);
          setStage('sent');
          showToast('Request sent. Waiting for the owner to approve.', 'success');
        }
        return;
      }
      if (invite.kind === 'direct') {
        // Direct hub path: submit straight over TCP/HTTP to the owner's hub.
        const target = (invite as any).directTarget;
        if (!target) { showToast('Lost the connection — searching again.', 'error'); return; }
        const payload = {
          businessId: invite.businessId,
          code: invite.code,
          joinerDeviceId: resolveJoinDeviceId(),
          joinerName: 'My Device',
          joinerModel: Platform.OS,
          joinerUser: personName,
          role: invite.role ?? 'cashier',
          platform: 'mobile',
        };
        if (target.http) {
          // Connect persistent WebSocket to Desktop Hub for instant real-time approval push
          const wsUrl = `http://${target.host}:5758`;
          setHubUrl(`http://${target.host}:5757`);
          try {
            void wsSyncClient.connect({
              hubUrl: wsUrl,
              deviceId: resolveJoinDeviceId(),
            });
          } catch { /* best-effort */ }

          const res = await fetch(`http://${target.host}:5757/sync/join/submit`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Join request rejected by the hub');
        } else {
          await directSubmitJoin(target, payload);
        }
        setStage('sent');
        showToast('Request sent. Waiting for the owner to approve.', 'success');
        return;
      }
      if (invite.kind === 'shg') {
        // Desktop user-invite: claim it with our name + persistent device id;
        // the owner approves from Teams on the desktop.
        await wsSyncClient.claimHubInvite(invite.code, personName, resolveJoinDeviceId());
        setStage('sent');
        showToast('Request sent. Waiting for the owner to approve.', 'success');
        return;
      }
      await submitJoinRequest({
        businessId: invite.businessId,
        code: invite.code,
        joinerName: 'My Device',
        joinerModel: Platform.OS,
        joinerUser: personName,
        role: invite.role ?? 'cashier',
        platform: 'mobile',
      });
      setStage('sent');
      showToast('Request sent. Waiting for the owner to approve.', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Could not send request', 'error');
    }
  };

  // Radar-tap admission: the OWNER admitted this joiner by tapping it on the
  // radar — there is no invite code the joiner typed, so we resolve a LAN
  // hub that published NO beacon code and let the existing code-less
  // checkStatus poll pick up the owner's approval purely by joiner device id.
  const resolveCodeLessHub = async (b: { host?: string; port?: number; businessId?: string; businessName?: string; role?: string; ownerPlatform?: string }) => {
    if (!b.host || connectingRef.current) return;
    connectingRef.current = true;
    const isDesktop = b.ownerPlatform === 'desktop' || b.port === 5757;
    const directTarget = { host: b.host, port: b.port ?? (isDesktop ? 5757 : 5759), http: isDesktop };
    const resolvedObj: any = {
      businessId: b.businessId ?? undefined,
      code: '',
      businessName: b.businessName ?? b.host,
      role: b.role ?? 'cashier',
      source: 'lan',
      kind: 'direct',
      directTarget,
    };
    resolvedRef.current = resolvedObj;
    setResolved(resolvedObj);
    setJoinPhase('connecting');

    if (isDesktop) {
      setHubUrl(`http://${b.host}:5757`);
      try {
        void wsSyncClient.connect({
          hubUrl: `http://${b.host}:5758`,
          deviceId: resolveJoinDeviceId(),
        });
      } catch { /* best-effort */ }
    }

    console.log(`[pair] Resolved hub ${b.host}:${directTarget.port} (code-less), submitting join request...`);
    try {
      await submit(resolvedObj);
    } catch {
      void checkStatus(true);
    } finally {
      connectingRef.current = false;
    }
  };

  // Auto-connect: the first discovered business with an open invite is joined
  // with no further input. Each code is attempted once so failures don't loop.
  // A code that arrived via a scanned QR wins over beacon discovery.
  //
  // Radar-tap auto-admission (code-less): the OWNER admits this joiner by
  // tapping the radar — there is no invite code at all. The joiner instead
  // auto-polls every discovered hub that advertised NO code, keyed purely on
  // its joiner device id, so approval from the owner's radar tap resolves
  // without the joiner ever typing anything. Hubs already tried (by host) are
  // skipped so a satisfied admission never spam-loops.
  useEffect(() => {
    if (stage !== 'idle') return;
    if (usedParamRef.current) return;
    const withInvite = nearby.find((n) => !!n.code && !autoTriedRef.current.has(n.code));
    if (withInvite) {
      autoTriedRef.current.add(withInvite.code);
      void connectWithCode(withInvite.code);
      return;
    }
    const codeLess = nearby.find((n) => !n.code && n.host && !autoTriedRef.current.has(`hub:${n.host}`));
    if (codeLess) {
      autoTriedRef.current.add(`hub:${codeLess.host}`);
      void resolveCodeLessHub(codeLess);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearby, stage]);

  // Search window: after the first 30s pass with nothing found, show the
  // 'notfound' hint ONCE, but keep the discovery loop running until the user
  // leaves the screen or a device is found. Do not stop the search at the first
  // empty scan — that is the "it stopped saying No device found nearby" fix.
  useEffect(() => {
    if (stage !== 'idle' && stage !== 'resolved') return;
    if (resolvedRef.current !== null) return;
    let cancelled = false;
    let windowTimer: ReturnType<typeof setTimeout> | null = null;
    const searchWindow = () => {
      windowTimer = setTimeout(() => {
        if (cancelled || resolvedRef.current !== null) return;
        setJoinPhase((p) => (p === 'connecting' ? p : 'notfound'));
      }, 30_000);
    };
    searchWindow();
    // Re-arm the window whenever a connect attempt finishes without success,
    // so a failed resolution restarts the clock instead of pinning 'notfound'.
    const rearm = setInterval(() => {
      if (cancelled || joinPhase === 'connecting' || resolvedRef.current !== null) return;
      if (stage !== 'idle') { searchWindow(); }
    }, 30_000);
    return () => {
      cancelled = true;
      if (windowTimer) clearTimeout(windowTimer);
      clearInterval(rearm);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, joinPhase]);


  const seedJoinedBusiness = async (personName: string) => {
    // Post-approval adoption: the account's memberships now include the joined
    // business, so seed a local cache row the same way a second-install does.
    const memberships = await fetchMyMemberships();
    const seeded = ensureRemoteBusinessSeeded({
      owned: memberships.owned.map((o) => ({ business_name: o.business_name, name: o.name })),
      memberships: memberships.memberships.map((m) => ({ business_name: m.business_name, role: m.role })),
    });
    if (seeded) {
      setResolved((r) => (r ? { ...r, businessName: seeded.name } : r));
      return seeded.name;
    }
    return resolved?.businessName ?? personName;
  };

  // Post-approval: an admitted device receives the hub's LAN pairing credential
  // so it can actually pair + sync — a bare join can't complete otherwise.
  // Best-effort: surfacing the business still succeeds if pairing hiccups.
  const reconnectWithGrantedToken = async (token: string | null | undefined, deviceId: string) => {
    if (!token || !token.trim()) return;
    try {
      setHubToken(token.trim());
      // The joiner knows exactly which host it submitted the request to — pin
      // the hub URL to that host so sync works even when mDNS discovery is
      // blocked (guest Wi-Fi / AP isolation) and performDiscoveryCycle never
      // auto-adopts a peer. Only desktop hubs speak HTTP/WS (5757/5758); a
      // mobile owner hub is reached over TCP 5759 and needs no hubUrl.
      const directTarget: { host: string; port?: number; http?: boolean } | undefined =
        (resolved as any)?.directTarget ?? (resolvedRef.current as any)?.directTarget
          ?? (preferredTargetRef.current?.http ? preferredTargetRef.current : undefined);
      if (directTarget?.host && directTarget.http !== false) {
        const lanUrl = `http://${directTarget.host}:${directTarget.port || 5757}`;
        if (!getHubUrl() || getHubUrl() !== lanUrl) {
          console.log(`[Join] Adopting LAN hub URL from the join target: ${lanUrl}`);
          setHubUrl(lanUrl);
        }
      }
      const hubUrl = getHubUrl();
      const device = getThisDeviceId() ?? deviceId;
      if (hubUrl && device) {
        try {
          await wsSyncClient.disconnect();
          await wsSyncClient.connect({
            hubUrl: hubUrl.replace(':5757', ':5758'),
            hubToken: token.trim(),
            deviceId: device,
          });
        } catch { /* sync session re-pairing is not required to enter the business */ }
      }
    } catch { /* token grant is best-effort too */ }
  };

  const handleApprovedTransition = async (rec: any, token: string | undefined, deviceId: string) => {
    if (doneRef.current) return;
    doneRef.current = true;
    console.log(`[pair] Join request approved by owner! Role: ${rec?.role || resolved?.role}`);
    if (token) await reconnectWithGrantedToken(token, deviceId);
    const personName = (rec?.assignedName || rec?.joinerUser || name.trim() || resolved?.name || 'New Member').trim();
    const restored = restoreBusinessFromJoin({
      businessId: rec?.businessId || resolved?.businessId,
      name: rec?.businessName || resolved?.businessName || 'My Business',
      joinerUser: personName,
      assignedName: rec?.assignedName ?? null,
      assignedAvatar: rec?.assignedAvatar ?? null,
      assignedPermissions: rec?.assignedPermissions ?? null,
      role: rec?.role || resolved?.role || 'cashier',
      joinerName: rec?.joinerName || 'My Device',
    });
    setDecision({ status: 'approved' });
    showToast(`You're in! Welcome to ${restored.name}.`, 'success');
    router.replace({
      pathname: '/initial-sync',
      params: { business: restored.name || 'Your Business', role: rec?.role || resolved?.role || 'cashier', device: 'This Device' },
    } as any);
  };

  const checkStatus = async (quiet = false) => {
    if (!resolved) return;
    setChecking(true);
    const deviceId = resolveJoinDeviceId();

    try {
      // 1. Direct Target Probe (HTTP 5757 or TCP 5759)
      const directTarget: { host: string; port?: number; http?: boolean } | undefined =
        (resolved as any)?.directTarget ?? (resolvedRef.current as any)?.directTarget
          ?? (preferredTargetRef.current?.http ? preferredTargetRef.current : undefined);

      if (directTarget?.host) {
        try {
          const payload = directTarget.http
            ? await (async () => {
                const res = await fetch(`http://${directTarget.host}:${directTarget.port || 5757}/sync/join/status`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ code: resolved.code, joinerDeviceId: deviceId }),
                });
                return res.ok ? await res.json() : null;
              })()
            : await directJoinStatus({ host: directTarget.host, port: directTarget.port || 5759 }, resolved.code, deviceId);

          if (payload?.handshake?.ok && (!payload?.record || payload?.record?.status === 'pending')) {
            setJoinPhase('connecting');
            setStage('sent');
          }

          const rec = payload?.record;
          if (rec?.status === 'approved') {
            await handleApprovedTransition(rec, payload?.pairingToken, deviceId);
            return;
          } else if (rec?.status === 'rejected') {
            setDecision({ status: 'rejected' });
            if (!quiet) showToast('Request declined.', 'info');
            return;
          }
        } catch { /* proceed to other probes */ }
      }

      // 2. Discovered Nearby Hub Probes (mDNS / UDP / LAN)
      const nearbyHubs = mobilePairingBeacon.getNearbyOwners();
      for (const h of nearbyHubs) {
        if (!h.host) continue;
        try {
          const isDesktop = h.beacon?.owner?.platform === 'desktop';
          const target = { host: h.host, port: isDesktop ? 5757 : 5759, http: isDesktop };
          const payload = isDesktop
            ? await (async () => {
                const res = await fetch(`http://${h.host}:5757/sync/join/status`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ code: resolved.code, joinerDeviceId: deviceId }),
                });
                return res.ok ? await res.json() : null;
              })()
            : await directJoinStatus(target, resolved.code, deviceId);

          if (payload?.record?.status === 'approved') {
            await handleApprovedTransition(payload.record, payload?.pairingToken, deviceId);
            return;
          }
        } catch { /* try next hub */ }
      }

      // 3. WebSocket Hub Probe (if connected)
      if (wsSyncClient.isConnected && resolved.code) {
        try {
          const res = await wsSyncClient.checkDeviceJoinStatus(resolved.code, deviceId);
          if (res?.record?.status === 'approved') {
            await handleApprovedTransition(res.record, res?.pairingToken, deviceId);
            return;
          } else if (res?.record?.status === 'rejected') {
            setDecision({ status: 'rejected' });
            if (!quiet) showToast('Request declined.', 'info');
            return;
          }
        } catch { /* proceed */ }
      }

      // 4. Cloud API Probe (if cloudInvitationId present)
      if (cloudInvitationId || resolved.source === 'cloud') {
        try {
          const idToUse = cloudInvitationId || resolved.code;
          const rec = await pairingStatus(idToUse);
          if (rec?.status === 'approved') {
            await handleApprovedTransition({
              requestId: rec.id,
              businessId: rec.business_id,
              role: rec.role || resolved.role,
              assignedName: rec.employee_name || name.trim() || resolved.name,
            }, (rec as any)?.pairingToken, deviceId);
            return;
          } else if (rec?.status === 'rejected') {
            setDecision({ status: 'rejected' });
            if (!quiet) showToast('Request declined.', 'info');
            return;
          }
        } catch { /* proceed */ }
      }

      // Still pending
      setDecision({ status: 'pending' });
      if (!quiet) showToast('Still waiting for the owner to approve.', 'info');
    } catch (e: any) {
      if (!quiet) showToast(e?.message || 'Could not check approval status', 'error');
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: G.bg }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>
          <TouchableOpacity onPress={() => safeBackOrFallback('/setup-wizard')} style={styles.back}>
            <ArrowLeft size={20} color={G.fg} />
            <AppText variant="body" weight="bold" style={{ color: G.fg }}>Back</AppText>
          </TouchableOpacity>

          <View style={styles.header}>
            <AppText variant="display" weight="bold" align="center" style={{ color: G.fg }}>Join Existing Business</AppText>
            <AppText variant="body" weight="medium" align="center" style={{ color: G.muted }}>
              Stay on this screen — Shega finds your business automatically.
            </AppText>
          </View>

          {(stage === 'idle' || stage === 'sent') && (() => {
            const isNoNetwork = netCheck.checked && !netCheck.hasLan && !netCheck.hasInternet;
            const radarTone = decision?.status === 'approved'
              ? 'connected'
              : decision?.status === 'pending' || joinPhase === 'connecting' || stage === 'sent'
                ? 'connecting'
                : (isNoNetwork || joinPhase === 'notfound')
                  ? 'failed'
                  : 'searching';

            const radarStatus = decision?.status === 'approved'
              ? 'Approved — Welcome!'
              : decision?.status === 'pending' || joinPhase === 'connecting' || stage === 'sent'
                ? 'Connected — waiting for owner approval…'
                : isNoNetwork
                  ? "You're not connected to a network."
                  : joinPhase === 'notfound'
                    ? 'No device found nearby or online.'
                    : 'Waiting for connection…';

            const emptyHint = isNoNetwork
              ? 'Turn on Wi-Fi or connect to the internet to find nearby or online devices.'
              : joinPhase === 'notfound'
                ? `Checked methods: ${[netCheck.hasLan && 'Wi-Fi/LAN', 'P2P discovery', netCheck.hasInternet && 'Internet Cloud'].filter(Boolean).join(', ')}. Ensure the owner has opened "Add Team" or an open invite code.`
                : 'Keep this phone on the same Wi-Fi or internet connection and open Add Team on the other device — it will appear here by itself.';

            return (
              <View style={[styles.card, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]}>
                <RadarPulse
                  glass={G}
                  deviceName={selfName}
                  tone={radarTone}
                  status={radarStatus}
                  peers={nearby.map((o, idx) => ({
                    id: o.host ? `host:${o.host}:${o.port}` : `${o.businessId || 'biz'}-${o.code || 'nocode'}-${idx}`,
                    name: o.businessName || o.ownerName || 'Shega Business',
                    platform: o.ownerPlatform,
                    detail: `${o.role === 'team' ? 'Team' : 'Owner'} · ${o.ownerName || 'device'} · tap to join`,
                    disabled: false,
                  }))}
                  onPickPeer={(p) => {
                    const hit = nearby.find((o, idx) => {
                      const peerId = o.host ? `host:${o.host}:${o.port}` : `${o.businessId || 'biz'}-${o.code || 'nocode'}-${idx}`;
                      return peerId === p.id;
                    });
                    if (hit) pickNearby(hit);
                  }}
                  emptyHint={emptyHint}
                />

                {/* Fallback & Retry actions */}
                {(joinPhase === 'notfound' || isNoNetwork) && (
                  <View style={{ marginTop: 18 }}>
                    <TouchableOpacity onPress={retryDiscovery} style={[styles.primaryBtn, { backgroundColor: G.fg, marginBottom: 12 }]}>
                      <AppText variant="body" weight="bold" style={{ color: G.bg }}>Retry Search</AppText>
                    </TouchableOpacity>

                    <AppText variant="micro" weight="medium" align="center" style={{ color: G.muted, marginBottom: 10 }}>
                      You can also enter an invitation code directly:
                    </AppText>
                    <TextInput
                      style={[styles.input, { borderColor: G.border, color: G.fg, backgroundColor: G.bg, textAlign: 'center', letterSpacing: 2 }]}
                      placeholder="INVITATION CODE"
                      placeholderTextColor={G.muted}
                      value={code}
                      onChangeText={(t) => setCode(t.toUpperCase())}
                      autoCapitalize="characters"
                      autoCorrect={false}
                    />
                    <TouchableOpacity onPress={() => void connectWithCode(code)} disabled={!code.trim()} style={[styles.primaryBtn, { backgroundColor: G.fg, opacity: code.trim() ? 1 : 0.5, marginTop: 8 }]}>
                      <AppText variant="body" weight="bold" style={{ color: G.bg }}>Connect with Code</AppText>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })()}

          {stage === 'resolved' && resolved && (
            <View style={[styles.card, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]}>
              <View style={styles.row}>
                <CheckCircle2 size={20} color="#2ecc71" />
                <AppText variant="heading-lg" weight="bold" style={{ color: G.fg, marginLeft: 8 }}>Invitation found</AppText>
              </View>
              <View style={styles.infoRow}>
                <AppText variant="caption" weight="bold" style={{ color: G.muted }}>Business</AppText>
                <AppText variant="body" weight="bold" style={{ color: G.fg }}>{resolved.businessName ?? 'ABC Shop'}</AppText>
              </View>
              {resolved.role && (
                <View style={styles.infoRow}>
                  <AppText variant="caption" weight="bold" style={{ color: G.muted }}>Requested role</AppText>
                  <AppText variant="body" weight="bold" style={{ color: G.fg }}>{resolved.role}</AppText>
                </View>
              )}
              <AppText variant="micro" weight="bold" transform="uppercase" style={{ color: G.muted, marginTop: 14, marginBottom: 8 }}>Your name</AppText>
              <TextInput
                style={[styles.input, { borderColor: G.border, color: G.fg, backgroundColor: G.bg }]}
                placeholder="e.g. Hana"
                placeholderTextColor={G.muted}
                value={name}
                onChangeText={setName}
              />
              <TouchableOpacity onPress={() => void submit()} style={[styles.primaryBtn, { backgroundColor: G.fg }]}>
                <AppText variant="body" weight="bold" style={{ color: G.bg }}>Request to Join</AppText>
              </TouchableOpacity>
            </View>
          )}

          {stage === 'sent' && (
            <View style={[styles.card, { backgroundColor: G.glassCard, borderColor: G.glassBorder }]}>
              {decision?.status === 'approved' ? (
                <>
                  <View style={styles.row}>
                    <CheckCircle2 size={24} color="#2ecc71" />
                    <AppText variant="heading-lg" weight="bold" style={{ color: G.fg, marginLeft: 8 }}>{`Approved — you're in!`}</AppText>
                  </View>
                  <AppText variant="body" weight="medium" style={{ color: G.muted, marginVertical: 12 }}>
                    Your device is now active on this business.
                  </AppText>
                  <TouchableOpacity onPress={() => router.replace('/')} style={[styles.primaryBtn, { backgroundColor: G.fg, marginTop: 16 }]}>
                    <AppText variant="body" weight="bold" style={{ color: G.bg }}>Open Business</AppText>
                  </TouchableOpacity>
                </>
              ) : decision?.status === 'rejected' ? (
                <>
                  <View style={styles.row}>
                    <ShieldAlert size={24} color="#e74c3c" />
                    <AppText variant="heading-lg" weight="bold" style={{ color: G.fg, marginLeft: 8 }}>Request declined</AppText>
                  </View>
                  <AppText variant="body" weight="medium" style={{ color: G.muted, marginVertical: 12 }}>
                    The owner declined your request. Ask them to approve it or generate a new invitation.
                  </AppText>
                  <TouchableOpacity onPress={() => { setDecision(null); setStage('idle'); setCode(''); doneRef.current = false; }} style={[styles.primaryBtn, { backgroundColor: G.fg, marginTop: 16 }]}>
                    <AppText variant="body" weight="bold" style={{ color: G.bg }}>Try another code</AppText>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.row}>
                    <CheckCircle2 size={24} color="#2ecc71" />
                    <AppText variant="heading-lg" weight="bold" style={{ color: G.fg, marginLeft: 8 }}>Request sent</AppText>
                  </View>
                  <AppText variant="body" weight="medium" style={{ color: G.muted, marginVertical: 12 }}>
                    Your device has requested to join. The owner will review and approve it shortly.
                  </AppText>
                  <View style={[styles.infoCard, { backgroundColor: G.accentGlass, borderColor: G.border }]}>
                    <ShieldAlert size={18} color={G.fg} />
                    <AppText variant="caption" weight="medium" style={{ color: G.fg, flex: 1, marginLeft: 8 }}>
                      {`You'll get full access once the owner approves your device.`}
                    </AppText>
                  </View>
                  <TouchableOpacity onPress={() => checkStatus()} disabled={checking} style={[styles.primaryBtn, { backgroundColor: G.fg, marginTop: 16, opacity: checking ? 0.6 : 1 }]}>
                    <AppText variant="body" weight="bold" style={{ color: G.bg }}>{checking ? 'Checking…' : 'Check Approval Status'}</AppText>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => router.replace('/setup-wizard')} style={[styles.primaryBtn, { backgroundColor: G.accentGlass, marginTop: 10 }]}>
                    <AppText variant="body" weight="bold" style={{ color: G.fg }}>Continue Later</AppText>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingVertical: 20 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24 },
  header: { alignItems: 'center', marginBottom: 28 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginBottom: 16 },
  card: { borderRadius: 22, padding: 22, borderWidth: 1, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  input: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, fontSize: 16, borderWidth: 1, marginBottom: 14 },
  primaryBtn: { alignItems: 'center', paddingVertical: 15, borderRadius: 999 },
  nearbyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderRadius: 12, borderStyle: 'dashed',
    paddingVertical: 11, marginBottom: 10,
  },
  nearbyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 8,
  },
  nearbyIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth, opacity: 0.5 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  infoCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 14, borderWidth: 1 },
});
