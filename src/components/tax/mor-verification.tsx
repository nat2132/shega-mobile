import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { RefreshCw, ShieldAlert, ShieldCheck, ShieldQuestion, ShieldX } from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import { AppText } from '@/components/ui';
import { getCachedVerification, verifyTin } from '@/services/taxVerification';
import { Fonts } from '@/constants/theme';
import {
  isMorVerified,
  isVerificationFresh,
  verificationAgeLabel,
  type MorVerification,
} from '@shega/shared';

const reasonText: Record<string, string> = {
  mor_integration_not_configured: 'No Ministry of Revenues integration is configured for Shega yet.',
  backend_link_required: 'Sign in to your Shega account to enable verification.',
  backend_unreachable: 'Shega backend is unreachable — showing the last cached answer.',
  invalid_tin: 'Enter a valid 8–12 digit TIN first.',
  mor_down: 'Ministry of Revenues is temporarily unavailable.',
};

function Chip({ verification }: { verification?: MorVerification | null }) {
  const { colors, t } = useSettings();
  if (!verification) {
    return (
      <View style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <ShieldQuestion size={14} color={colors.textSecondary} />
        <AppText variant="caption" weight="bold" shrink={false} style={[styles.chipText, { color: colors.textSecondary }]}>
          {t('mor.not_verified')}
        </AppText>
      </View>
    );
  }
  if (isMorVerified(verification)) {
    const stale = !isVerificationFresh(verification);
    return (
      <View style={[styles.chip, { borderColor: stale ? colors.warning : colors.success }]}>
        <ShieldCheck size={14} color={stale ? colors.warning : colors.success} />
        <AppText variant="caption" weight="bold" shrink={false} style={[styles.chipText, { color: stale ? colors.warning : colors.success }]}>
          {stale ? 'Verified · refresh recommended' : 'Verified by Ministry of Revenues'}
        </AppText>
      </View>
    );
  }
  if (verification.status === 'unavailable') {
    return (
      <View style={[styles.chip, { borderColor: colors.warning }]}>
        <ShieldAlert size={14} color={colors.warning} />
        <AppText variant="caption" weight="bold" shrink={false} style={[styles.chipText, { color: colors.warning }]}>
          {t('mor.unavailable')}
        </AppText>
      </View>
    );
  }
  if (verification.status === 'failed') {
    return (
      <View style={[styles.chip, { borderColor: colors.error }]}>
        <ShieldX size={14} color={colors.error} />
        <AppText variant="caption" weight="bold" shrink={false} style={[styles.chipText, { color: colors.error }]}>
          {t('mor.failed')}
        </AppText>
      </View>
    );
  }
  return (
    <View style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <ShieldX size={14} color={colors.textSecondary} />
      <AppText variant="caption" weight="bold" shrink={false} style={[styles.chipText, { color: colors.textSecondary }]}>
        {t('mor.no_match')}
      </AppText>
    </View>
  );
}

/**
 * Smart flow — Enter TIN → Verify with MoR → Review → Save.
 * Never mutates anything: reports the result upward so the caller controls the
 * review-before-save step. Statuses are honest: only a real Ministry answer can
 * render "Verified by Ministry of Revenues".
 */
export default function MorVerificationInline({
  tin,
  subTin,
  onVerified,
}: {
  tin: string;
  subTin?: string | null;
  onVerified?: (verification: MorVerification) => void;
}) {
  const { colors, t } = useSettings();
  const [verification, setVerification] = useState<MorVerification | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const loadCached = useCallback(() => {
    const flat = (tin || '').replace(/[\s-]/g, '');
    if (!flat) {
      setVerification(null);
      return;
    }
    setVerification(getCachedVerification(flat, subTin));
  }, [tin, subTin]);

  useEffect(() => { loadCached(); }, [loadCached]);

  const verify = async (force: boolean) => {
    const flat = (tin || '').replace(/[\s-]/g, '');
    if (!flat) return;
    setBusy(true);
    try {
      const res = await verifyTin(flat, subTin, force);
      setVerification(res);
      onVerified?.(res);
    } finally {
      setBusy(false);
    }
  };

  const fresh = verification ? isVerificationFresh(verification) : false;

  return (
    <View style={styles.container}>
      <Chip verification={verification} />
      {verification?.taxpayerName ? (
        <AppText variant="caption" style={[styles.name, { color: colors.textSecondary }]} numberOfLines={1}>
          {verification.taxpayerName}
        </AppText>
      ) : null}
      <TouchableOpacity
        onPress={() => verify(Boolean(verification))}
        disabled={busy || !(tin || '').trim()}
        style={[styles.btn, {
          backgroundColor: verification ? colors.card : colors.primary,
          borderColor: verification ? colors.border : colors.primary,
        }]}
        activeOpacity={0.8}
      >
        {busy ? (
          <ActivityIndicator size="small" color={verification ? colors.primary : '#FFF'} />
        ) : (
          <RefreshCw size={14} color={verification ? colors.primary : '#FFF'} />
        )}
        <AppText variant="caption" weight="bold" shrink={false} style={[styles.btnText, { color: verification ? colors.primary : '#FFF' }]}>
          {verification
            ? t('mor.refresh')
            : t('mor.verify')}
        </AppText>
      </TouchableOpacity>
      {verification && (
        <AppText variant="caption" style={[styles.hint, { color: colors.textSecondary }]} numberOfLines={2}>
          {verification.status === 'unavailable' || verification.status === 'failed'
            ? reasonText[verification.reason || ''] ?? verification.reason ?? ''
            : fresh
              ? `Cached ${verificationAgeLabel(verification.cachedAt)} from MoR`
              : t('mor.stale')}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontFamily: Fonts.bold, letterSpacing: 0.3 },
  name: { fontFamily: Fonts.medium },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 34,
  },
  btnText: { fontFamily: Fonts.semibold },
  hint: { fontFamily: Fonts.medium, opacity: 0.85 },
});