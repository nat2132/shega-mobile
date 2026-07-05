import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import {
  Sparkles,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Clock,
  DollarSign,
  Users,
  CreditCard,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { AppText, AppNumber } from '@/components/ui';
import { useSettings } from '@/context/SettingsContext';
import { AssistantInsight } from '@/hooks/useBusinessAssistant';

const ICON_MAP: Record<string, React.ElementType> = {
  'alert-triangle': AlertTriangle,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  'bar-chart': BarChart3,
  'clock': Clock,
  'dollar-sign': DollarSign,
  'users': Users,
  'credit-card': CreditCard,
  'check-circle': CheckCircle,
};

const TYPE_COLORS = {
  alert: (c: any) => c.error,
  opportunity: (c: any) => c.success,
  info: (c: any) => c.tint,
  summary: (c: any) => c.primary,
};

interface BusinessAssistantProps {
  insights: AssistantInsight[];
  loading: boolean;
  onRefresh?: () => void;
  onAction?: (insight: AssistantInsight) => void;
}

export function BusinessAssistant({ insights, loading, onRefresh, onAction }: BusinessAssistantProps) {
  const { colors, t } = useSettings();
  const [expanded, setExpanded] = useState(true);

  const maxVisible = 3;
  const [showAll, setShowAll] = useState(false);
  const visibleInsights = showAll ? insights : insights.slice(0, maxVisible);

  if (loading) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.header}>
          <Sparkles size={18} color={colors.primary} />
          <AppText variant="body" weight="bold" style={{ color: colors.text, marginLeft: 8 }}>
            {t('assistant.title')}
          </AppText>
        </View>
        <View style={{ padding: 20, alignItems: 'center' }}>
          <RefreshCw size={20} color={colors.textSecondary} />
        </View>
      </View>
    );
  }

  if (insights.length === 0) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setExpanded(!expanded); }}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Sparkles size={18} color={colors.primary} />
          <AppText variant="body" weight="bold" style={{ color: colors.text, marginLeft: 8 }}>
            {t('assistant.title')}
          </AppText>
          <View style={[styles.countBadge, { backgroundColor: colors.primary + '15' }]}>
            <AppText variant="micro" weight="bold" style={{ color: colors.primary }}>
              {insights.length}
            </AppText>
          </View>
        </View>
        {expanded ? <ChevronUp size={16} color={colors.textSecondary} /> : <ChevronDown size={16} color={colors.textSecondary} />}
      </TouchableOpacity>

      {expanded && (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 8 }}
          >
            {visibleInsights.map((insight) => {
              const Icon = ICON_MAP[insight.icon] || AlertTriangle;
              const color = TYPE_COLORS[insight.type]?.(colors) || colors.primary;

              return (
                <TouchableOpacity
                  key={insight.id}
                  style={[styles.insightCard, { backgroundColor: color + '08', borderColor: color + '20' }]}
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    if (onAction) onAction(insight);
                  }}
                >
                  <View style={[styles.insightIcon, { backgroundColor: color + '15' }]}>
                    <Icon size={18} color={color} />
                  </View>
                  <AppText variant="micro" weight="bold" transform="uppercase" style={{ color, marginTop: 8 }}>
                    {t(`assistant.${insight.type}`)}
                  </AppText>
                  <AppText variant="body-sm" weight="bold" style={{ color: colors.text, marginTop: 4 }} numberOfLines={2}>
                    {insight.title}
                  </AppText>
                  <AppText variant="caption" weight="medium" style={{ color: colors.textSecondary, marginTop: 4 }} numberOfLines={3}>
                    {insight.description}
                  </AppText>
                  {insight.action && (
                    <AppText variant="caption" weight="bold" style={{ color, marginTop: 8 }}>
                      {insight.action} →
                    </AppText>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {insights.length > maxVisible && (
            <TouchableOpacity
              style={[styles.showMoreBtn, { borderTopColor: colors.border }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowAll(!showAll); }}
            >
              <AppText variant="caption" weight="bold" style={{ color: colors.primary }}>
                {showAll ? t('assistant.show_less') : t('assistant.show_all', { count: String(insights.length - maxVisible) })}
              </AppText>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  insightCard: {
    width: 200,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginRight: 10,
  },
  insightIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  showMoreBtn: {
    alignItems: 'center',
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 10,
  },
});
