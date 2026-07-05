import React, { useEffect, useState, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions, Platform, LayoutChangeEvent } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, { SharedValue, useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';
import { Home, Store, Warehouse, Settings as SettingsIcon } from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import { AppText } from '@/components/ui';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_BAR_PADDING = 20;
const TAB_BAR_INNER_PADDING = 8;
const TAB_HEIGHT = 72;
const PILL_HEIGHT = 44;

type TabBarItemProps = {
  state: any;
  descriptors: any;
  navigation: any;
  route: any;
  index: number;
  activePillX: SharedValue<number>;
  activePillWidth: SharedValue<number>;
  onTabLayout: (index: number, x: number, w: number) => void;
};

const TabBarItem: React.FC<TabBarItemProps> = ({
  state,
  descriptors,
  navigation,
  route,
  index,
  activePillX,
  activePillWidth,
  onTabLayout,
}) => {
  const isFocused = state.index === index;
  const { colors, t } = useSettings();
  const { options } = descriptors[route.key];
  const displayName = route.name.replace('(tabs)/', '').replace('-hub', '');
  const label = isFocused || true
    ? t(`tabs.${displayName}`)
    : (options.tabBarLabel !== undefined
      ? options.tabBarLabel
      : options.title !== undefined
        ? options.title
        : route.name);

  const scale = useSharedValue(1);

  useEffect(() => {
    if (isFocused) {
      // pill position is driven by onTabLayout measurements
    }
  }, [isFocused]);

  const onPress = () => {
    scale.value = withSpring(0.92, { damping: 12, stiffness: 400 }, () => {
      scale.value = withSpring(1, { damping: 12, stiffness: 400 });
    });

    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });

    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate({ name: route.name, merge: true });
    }
  };

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    onTabLayout(index, x, width);
  }, [index, onTabLayout]);

  const getIcon = () => {
    const color = isFocused ? colors.tint : colors.textSecondary;
    const strokeWidth = isFocused ? 2.5 : 2;
    const size = 24;

    if (route.name.includes('dashboard')) return <Home size={size} color={color} strokeWidth={strokeWidth} />;
    if (route.name.includes('sales')) return <Store size={size} color={color} strokeWidth={strokeWidth} />;
    if (route.name.includes('inventory')) return <Warehouse size={size} color={color} strokeWidth={strokeWidth} />;
    if (route.name.includes('settings')) return <SettingsIcon size={size} color={color} strokeWidth={strokeWidth} />;

    return <Home size={size} color={color} strokeWidth={strokeWidth} />;
  };

  return (
    <Animated.View
      style={[styles.tabItemWrapper, containerAnimatedStyle]}
      onLayout={handleLayout}
    >
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        accessibilityLabel={options.tabBarAccessibilityLabel}
        testID={options.tabBarTestID}
        onPress={onPress}
        style={styles.tabItem}
        activeOpacity={0.7}
      >
        <View style={styles.iconContainer}>
          {getIcon()}
        </View>
        <AppText
          variant="caption"
          weight={isFocused ? 'semibold' : 'medium'}
          shrink={false}
          style={[
            styles.tabText,
            {
              color: isFocused ? colors.tint : colors.textSecondary,
              opacity: isFocused ? 1 : 0.7,
            },
          ]}
          numberOfLines={1}
        >
          {typeof label === 'string' ? label : 'Tab'}
        </AppText>
      </TouchableOpacity>
    </Animated.View>
  );
};

export const CustomTabBar = (props: BottomTabBarProps) => {
  const { colors } = useSettings();
  const [tabLayouts, setTabLayouts] = useState<Record<number, { x: number; w: number }>>({});

  const routes = props.state.routes.filter(route => {
    const n = route.name;
    return !['expense', 'adjustment', 'summary', 'contacts', 'orders', 'budget'].includes(n);
  });

  const activePillX = useSharedValue(0);
  const activePillWidth = useSharedValue(0);

  const handleTabLayout = useCallback((index: number, x: number, w: number) => {
    setTabLayouts(prev => {
      const next = { ...prev, [index]: { x, w } };
      return next;
    });
  }, []);

  // Update pill position when active tab changes or layouts are measured
  useEffect(() => {
    const activeIndex = props.state.index;
    const layout = tabLayouts[activeIndex];
    if (layout) {
      activePillX.value = withSpring(layout.x, {
        damping: 20,
        stiffness: 260,
        mass: 0.8,
      });
      activePillWidth.value = withSpring(layout.w, {
        damping: 20,
        stiffness: 260,
        mass: 0.8,
      });
    }
  }, [props.state.index, tabLayouts, activePillX, activePillWidth]);

  const pillAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: activePillX.value }],
    width: activePillWidth.value,
  }));

  return (
    <View style={styles.tabBarContainer}>
      <View style={[styles.shadowWrapper, { shadowColor: colors.border }]}>
        <View
          style={[
            styles.tabBar,
            { backgroundColor: colors.tabBar },
          ]}
        >
          <Animated.View
            style={[
              styles.activePill,
              { backgroundColor: colors.tint + '15' },
              pillAnimatedStyle,
            ]}
          />
          {routes.map((route) => {
            const index = props.state.routes.indexOf(route);
            return (
              <TabBarItem
                key={route.key}
                state={props.state}
                descriptors={props.descriptors}
                navigation={props.navigation}
                route={route}
                index={index}
                activePillX={activePillX}
                activePillWidth={activePillWidth}
                onTabLayout={handleTabLayout}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    paddingHorizontal: TAB_BAR_PADDING,
    paddingBottom: Platform.OS === 'ios' ? 28 : 18,
    paddingTop: 8,
  },
  shadowWrapper: {
    borderRadius: 36,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  tabBar: {
    flexDirection: 'row',
    height: TAB_HEIGHT,
    borderRadius: 36,
    alignItems: 'center',
    paddingHorizontal: TAB_BAR_INNER_PADDING,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  activePill: {
    position: 'absolute',
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    top: (TAB_HEIGHT - PILL_HEIGHT) / 2,
    left: 0,
  },
  tabItemWrapper: {
    flex: 1,
    zIndex: 1,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  iconContainer: {
    marginBottom: 2,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 10,
    letterSpacing: 0.3,
  },
});
