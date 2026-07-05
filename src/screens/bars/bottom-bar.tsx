import React from 'react';
import { View, TouchableOpacity, StyleSheet} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, TrendingUp, Package, Settings } from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import { AppText } from '@/components/ui';

const TABS = [
  { name: 'Home', icon: Home },
  { name: 'Sales', icon: TrendingUp },
  { name: 'Inventory', icon: Package },
  { name: 'Settings', icon: Settings },
];

interface BottomBarProps {
  activeTab?: string;
  onTabPress?: (tab: string) => void;
}

const BottomBar: React.FC<BottomBarProps> = ({ activeTab = 'Home', onTabPress }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useSettings();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 10 }]}>
      <View style={[styles.bar, { backgroundColor: colors.tabBar, borderColor: colors.border }]}>
        {TABS.map((tab) => {
          const isFocused = activeTab === tab.name;
          const IconComponent = tab.icon;
          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tabItem}
              onPress={() => onTabPress?.(tab.name)}
              activeOpacity={0.7}
            >
              <IconComponent
                size={24}
                color={isFocused ? colors.tint : colors.textSecondary}
                strokeWidth={isFocused ? 2.5 : 1.8}
              />
              <AppText
                variant="caption"
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[
                  styles.label,
                  { color: isFocused ? colors.tint : colors.textSecondary },
                  isFocused && styles.labelActive,
                ]}
              >
                {tab.name}
              </AppText>
              {isFocused && (
                <View style={[styles.activeDot, { backgroundColor: colors.tint }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    zIndex: 100,
  },
  bar: {
    flexDirection: 'row',
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    position: 'relative',
  },
  label: {
    fontWeight: '500',
  },
  labelActive: {
    fontWeight: '700',
  },
  activeDot: {
    position: 'absolute',
    bottom: -8,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});

export default BottomBar;
