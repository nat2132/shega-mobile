import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import { Heart, TrendingUp, AlertTriangle, CheckCircle, X, ArrowRight, Lightbulb } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { AppText, AppNumber } from '@/components/ui';
import { useSettings } from '@/context/SettingsContext';
import { HealthScoreResult, HealthFactor } from '@/hooks/useBusinessHealthScore';

const RATING_CONFIG = {
  excellent: { color: (c: any) => c.success, emoji: 'Excellent', icon: CheckCircle },
  good: { color: (c: any) => c.primary, emoji: 'Good', icon: TrendingUp },
  fair: { color: (c: any) => c.warning, emoji: 'Fair', icon: AlertTriangle },
  needs_attention: { color: (c: any) => c.error, emoji: 'Needs Attention', icon: AlertTriangle },
};

interface BusinessHealthCardProps {
  health: HealthScoreResult | null;
  loading: boolean;
  onRefresh?: () => void;
}

export function BusinessHealthCard({ health, loading, onRefresh }: BusinessHealthCardProps) {
  const { colors, t } = useSettings();
  const [showDetail, setShowDetail] = useState(false);

  if (loading) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.header}>
          <Heart size={18} color={colors.primary} />
          <AppText variant="body" weight="bold" style={{ color: colors.text, marginLeft: 8 }}>
            {t('health.title')}
          </AppText>
        </View>
        <View style={[styles.scoreRing, { borderColor: colors.border }]}>
          <AppText variant="title" weight="bold" style={{ color: colors.textSecondary }}>--</AppText>
        </View>
      </View>
    );
  }

  if (!health) return null;

  const ratingConf = RATING_CONFIG[health.rating];
  const RatingIcon = ratingConf.icon;

  const statusColor = (status: HealthFactor['status']) =>
    status === 'good' ? colors.success : status === 'warning' ? colors.warning : colors.error;

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowDetail(true); }}
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={styles.header}>
          <Heart size={18} color={ratingConf.color(colors)} />
          <AppText variant="body" weight="bold" style={{ color: colors.text, marginLeft: 8 }}>
            {t('health.title')}
          </AppText>
          <View style={[styles.badge, { backgroundColor: ratingConf.color(colors) + '18' }]}>
            <AppText variant="micro" weight="bold" style={{ color: ratingConf.color(colors) }}>
              {t(`health.${health.rating}`)}
            </AppText>
          </View>
        </View>

        <View style={styles.body}>
          <View style={[styles.scoreRing, { borderColor: ratingConf.color(colors) + '30' }]}>
            <AppText variant="heading-lg" weight="bold" style={{ color: ratingConf.color(colors) }}>
              {health.score}{t('common.percent')}
            </AppText>
          </View>

          <View style={styles.factorSummary}>
            {health.factors.slice(0, 4).map((f, i) => (
              <View key={i} style={styles.factorRow}>
                <View style={[styles.factorDot, { backgroundColor: statusColor(f.status) }]} />
                <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary, flex: 1 }} numberOfLines={1}>
                  {f.label}
                </AppText>
                <AppText variant="caption" weight="bold" style={{ color: statusColor(f.status) }}>
                  {f.score}
                </AppText>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary }}>
            {t('health.tap_details')}
          </AppText>
          <ArrowRight size={14} color={colors.textSecondary} />
        </View>
      </TouchableOpacity>

      <Modal visible={showDetail} animationType="slide" transparent>
        <View style={styles.overlay}>
          <Pressable style={styles.dismissArea} onPress={() => setShowDetail(false)} />
          <View style={[styles.detailSheet, { backgroundColor: colors.background }]}>
            <View style={styles.handleRow}>
              <View style={[styles.handle, { backgroundColor: colors.border }]} />
              <TouchableOpacity onPress={() => setShowDetail(false)} style={styles.closeBtn}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 24 }} showsVerticalScrollIndicator={false}>
              <View style={styles.detailHeader}>
                <RatingIcon size={24} color={ratingConf.color(colors)} />
                <AppText variant="heading" weight="bold" style={{ color: colors.text, marginLeft: 10 }}>
                  {t('health.title')}
                </AppText>
              </View>

              <View style={[styles.bigScore, { borderColor: ratingConf.color(colors) + '30' }]}>
                <AppText variant="hero" weight="black" style={{ color: ratingConf.color(colors) }}>
                  {health.score}{t('common.percent')}
                </AppText>
                <AppText variant="body" weight="bold" style={{ color: ratingConf.color(colors), marginTop: 4 }}>
                  {t(`health.${health.rating}`)}
                </AppText>
              </View>

              <View style={styles.factorsSection}>
                <AppText variant="title-sm" weight="bold" style={{ color: colors.text, marginBottom: 12 }}>
                  {t('health.factors')}
                </AppText>
                {health.factors.map((f, i) => {
                  const color = statusColor(f.status);
                  const pct = f.weight;
                  return (
                    <View key={i} style={[styles.factorDetail, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={styles.factorHeader}>
                        <View style={[styles.factorDot, { backgroundColor: color }]} />
                        <AppText variant="body" weight="bold" style={{ color: colors.text, flex: 1 }}>{f.label}</AppText>
                        <AppText variant="body" weight="bold" style={{ color }}>{f.score}</AppText>
                      </View>
                      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                        <View style={[styles.progressFill, { backgroundColor: color, width: `${f.score}%` }]} />
                      </View>
                      <AppText variant="micro" weight="medium" style={{ color: colors.textSecondary, marginTop: 2 }}>
                        {t('health.weight')}: {pct}%
                      </AppText>
                    </View>
                  );
                })}
              </View>

              {health.recommendations.length > 0 && (
                <View style={styles.recommendationsSection}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <Lightbulb size={18} color={colors.warning} />
                    <AppText variant="title-sm" weight="bold" style={{ color: colors.text, marginLeft: 8 }}>
                      {t('health.recommendations')}
                    </AppText>
                  </View>
                  {health.recommendations.map((rec, i) => (
                    <View key={i} style={[styles.recItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={[styles.recDot, { backgroundColor: colors.warning }]} />
                      <AppText variant="body-sm" weight="medium" style={{ color: colors.text, flex: 1 }}>
                        {rec}
                      </AppText>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  body: {
    flexDirection: 'row',
    gap: 16,
  },
  scoreRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  factorSummary: {
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  factorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 10,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  detailSheet: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
  },
  handleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 12,
    position: 'relative',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  closeBtn: {
    position: 'absolute',
    right: 20,
    top: 0,
    padding: 4,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  bigScore: {
    alignItems: 'center',
    paddingVertical: 24,
    borderRadius: 20,
    borderWidth: 2,
    marginBottom: 24,
  },
  factorsSection: {
    marginBottom: 24,
  },
  factorDetail: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  factorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  recommendationsSection: {
    marginBottom: 40,
  },
  recItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 2,
  },
});
