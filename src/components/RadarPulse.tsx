/**
 * RadarPulse — the single pairing visual shared by Join Mode and
 * Add Team / Add Device on mobile.
 *
 * A centered device icon inside soft pulsing rings, with this device's own name
 * underneath and a one-line status. Discovered peers appear beneath the radar
 * as tappable rows so the device can be picked without any code entry.
 *
 * Built on the plain RN Animated API with the native driver, so the rings stay
 * cheap on low-end phones and stop cleanly when the screen unmounts.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AlertTriangle, Check, Loader2, MonitorSmartphone, Radar, Smartphone } from 'lucide-react-native';
import { AppText } from '@/components/ui';

export type RadarTone = 'searching' | 'found' | 'connecting' | 'connected' | 'failed';

const TONE_COLOR: Record<RadarTone, string> = {
  searching: '#4A9DFF',
  found: '#2ECC71',
  connecting: '#FFB020',
  connected: '#2ECC71',
  failed: '#E74C3C',
};

export interface RadarPeer {
  id: string;
  name: string;
  platform?: string;
  detail?: string;
  disabled?: boolean;
}

interface Props {
  deviceName: string;
  status: string;
  tone: RadarTone;
  glass: any;
  compact?: boolean;
  peers?: RadarPeer[];
  onPickPeer?: (peer: RadarPeer) => void;
  emptyHint?: string;
}

export const RadarPulse: React.FC<Props> = ({
  deviceName,
  status,
  tone,
  glass,
  compact = false,
  peers = [],
  onPickPeer,
  emptyHint,
}) => {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const listFade = useRef(new Animated.Value(0)).current;
  const [, forceTick] = useState(0);

  const size = compact ? 104 : 148;
  const core = Math.round(size * 0.56);

  useEffect(() => {
    const rings = [ring1, ring2, ring3];
    const anims = rings.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 700),
          Animated.timing(v, {
            toValue: 1,
            duration: 2100,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
    );
    const coreAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    anims.forEach((a) => a.start());
    coreAnim.start();
    // Ticks the status dot/text refresh; animations themselves are native.
    const t = setInterval(() => forceTick((n) => n + 1), 2000);
    return () => {
      anims.forEach((a) => a.stop());
      coreAnim.stop();
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    Animated.timing(listFade, {
      toValue: peers.length > 0 ? 1 : 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [peers.length, listFade]);

  const ringStyle = (v: Animated.Value) => ({
    position: 'absolute' as const,
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.border,
    opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.5, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1.6] }) }],
  });

  const ToneIcon =
    tone === 'connecting' ? Loader2 : tone === 'failed' ? AlertTriangle : tone === 'searching' ? Radar : Check;

  return (
    <View style={styles.wrap}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={ringStyle(ring1)} />
        <Animated.View style={ringStyle(ring2)} />
        <Animated.View style={ringStyle(ring3)} />
        <Animated.View
          style={{
            width: core,
            height: core,
            borderRadius: core / 2,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: glass.glassCard,
            borderWidth: 1,
            borderColor: glass.glassBorder,
            transform: [{ scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }],
          }}
        >
          <MonitorSmartphone size={compact ? 24 : 30} color={glass.textGlassStrong ?? glass.fg} />
        </Animated.View>
      </View>

      <View style={{ alignItems: 'center', marginTop: 14 }}>
        <AppText variant="body" weight="bold" align="center" style={{ color: glass.fg, maxWidth: 260 }} numberOfLines={2}>
          {deviceName}
        </AppText>
        <View
          style={[
            styles.badge,
            { borderColor: TONE_COLOR[tone], backgroundColor: `${TONE_COLOR[tone]}1A` },
          ]}
        >
          <ToneIcon size={12} color={TONE_COLOR[tone]} />
          <AppText variant="micro" weight="bold" style={{ color: TONE_COLOR[tone], marginLeft: 6 }}>
            {status}
          </AppText>
        </View>
      </View>

      {peers.length > 0 && (
        <Animated.View style={{ width: '100%', marginTop: 16, opacity: listFade }}>
          {peers.map((p) => (
            <TouchableOpacity
              key={p.id}
              disabled={p.disabled}
              onPress={() => onPickPeer?.(p)}
              style={[
                styles.peerRow,
                { backgroundColor: glass.bgCard ?? glass.bg, borderColor: glass.border, opacity: p.disabled ? 0.55 : 1 },
              ]}
            >
              <View style={[styles.peerIcon, { backgroundColor: 'rgba(46,204,113,0.12)' }]}>
                {p.platform === 'desktop' ? (
                  <MonitorSmartphone size={15} color="#2ecc71" />
                ) : (
                  <Smartphone size={15} color="#2ecc71" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="body" weight="bold" style={{ color: glass.fg }} numberOfLines={1}>
                  {p.name}
                </AppText>
                <AppText variant="micro" weight="bold" style={{ color: glass.muted }} numberOfLines={1}>
                  {p.detail || 'Nearby device'}
                </AppText>
              </View>
            </TouchableOpacity>
          ))}
        </Animated.View>
      )}

      {peers.length === 0 && !!emptyHint && (
        <AppText
          variant="micro"
          weight="medium"
          align="center"
          style={{ color: glass.muted, marginTop: 14, paddingHorizontal: 12 }}
        >
          {emptyHint}
        </AppText>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', width: '100%' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 8,
  },
  peerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  peerIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});

export default RadarPulse;
