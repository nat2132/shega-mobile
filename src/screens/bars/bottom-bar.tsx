import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, TrendingUp, Package, Settings } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';

/**
 * BottomBar — Reference component showing the 4-tab layout.
 * The active tab bar used in the app is CustomTabBar.tsx (powered by Expo Router).
 * This component can be used as a standalone bottom navigation if needed.
 */

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
  const { colors, theme } = useSettings();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 10 }]}>
      <BlurView
        intensity={80}
        tint={theme !== 'light' ? 'dark' : 'light'}
        style={[
          styles.blurBar,
          {
            backgroundColor:
              theme !== 'light' ? 'rgba(28,28,30,0.85)' : 'rgba(255,255,255,0.85)',
            borderColor: colors.border,
          },
        ]}
      >
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
                color={isFocused ? colors.text : colors.textSecondary}
                strokeWidth={isFocused ? 2.5 : 1.8}
              />
              <Text
                style={[
                  styles.label,
                  { color: isFocused ? colors.text : colors.textSecondary },
                  isFocused && styles.labelActive,
                ]}
              >
                {tab.name}
              </Text>
              {isFocused && (
                <View style={[styles.activeDot, { backgroundColor: colors.text }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </BlurView>
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
  blurBar: {
    flexDirection: 'row',
    borderRadius: 35,
    borderWidth: 1,
    overflow: 'hidden',
    paddingVertical: 12,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    position: 'relative',
  },
  label: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    fontWeight: '500',
  },
  labelActive: {
    fontFamily: Fonts.bold,
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