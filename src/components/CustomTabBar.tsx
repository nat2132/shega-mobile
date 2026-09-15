import React, { useEffect, useCallback, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform, LayoutChangeEvent } from 'react-native';
type BottomTabBarProps = {
  state: { index: number; routes: any[] };
  descriptors: Record<string, any>;
  navigation: any;
};
import Animated, {
  useAnimatedStyle,
  withSpring,
  withSequence,
  useSharedValue,
} from 'react-native-reanimated';
import { Home, Store, Warehouse, Settings as SettingsIcon } from 'lucide-react-native';
import { useSettings } from '@/context/SettingsContext';
import { AppText } from '@/components/ui';
import { addScrollVisibilityListener, forceScrollVisibility } from '@/utils/scroll-visibility';

const TAB_BAR_PADDING = 20;
const TAB_BAR_INNER_PADDING = 8;
const TAB_HEIGHT = 72;
const PILL_HEIGHT = 44;
const SPRING_CFG = { damping: 20, stiffness: 260, mass: 0.8 };
const HIDE_OFFSET = 160;

type TabBarItemProps = {
  state: any;
  descriptors: any;
  navigation: any;
  route: any;
  index: number;
  onTabLayout: (index: number, x: number, w: number) => void;
};

const TabBarItem: React.FC<TabBarItemProps> = ({
  state,
  descriptors,
  navigation,
  route,
  index,
  onTabLayout,
}) => {
  const isFocused = state.index === index;
  const { colors, t } = useSettings();
  const { options } = descriptors[route.key];
  const displayName = route.name.replace('(tabs)/', '').replace('-hub', '');
  const label = isFocused
    ? t(`tabs.${displayName}`)
    : (options.tabBarLabel ?? options.title ?? route.name);

  const scale = useSharedValue(1);

  const onPress = () => {
    scale.value = withSequence(
      withSpring(0.92, { damping: 12, stiffness: 400 }),
      withSpring(1, { damping: 12, stiffness: 400 }),
    );

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
    const sw = isFocused ? 2.5 : 2;
    const size = 24;
    if (route.name.includes('dashboard')) return <Home size={size} color={color} strokeWidth={sw} />;
    if (route.name.includes('sales')) return <Store size={size} color={color} strokeWidth={sw} />;
    if (route.name.includes('inventory')) return <Warehouse size={size} color={color} strokeWidth={sw} />;
    if (route.name.includes('settings')) return <SettingsIcon size={size} color={color} strokeWidth={sw} />;
    return <Home size={size} color={color} strokeWidth={sw} />;
  };

  return (
    <Animated.View style={[styles.tabItemWrapper, containerAnimatedStyle]} onLayout={handleLayout}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        accessibilityLabel={options.tabBarAccessibilityLabel}
        testID={options.tabBarTestID}
        onPress={onPress}
        style={styles.tabItem}
        activeOpacity={0.7}
      >
        <View style={styles.iconContainer}>{getIcon()}</View>
        <AppText
          variant="caption"
          weight={isFocused ? 'semibold' : 'medium'}
          shrink={false}
          style={[styles.tabText, { color: isFocused ? colors.tint : colors.textSecondary, opacity: isFocused ? 1 : 0.7 }]}
          numberOfLines={1}
        >
          {typeof label === 'string' ? label : 'Tab'}
        </AppText>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Main Tab Bar ───────────────────────────────────────────────

export const CustomTabBar = (props: BottomTabBarProps) => {
  const { colors } = useSettings();
  const layoutsRef = useRef<Record<number, { x: number; w: number }>>({});
  const pillReadyRef = useRef(false);
  const activeIndexRef = useRef(props.state.index);

  const routes = props.state.routes.filter(
    (r) => !['summary', 'orders', 'suppliers'].includes(r.name),
  );

  const pillX = useSharedValue(0);
  const pillW = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    return addScrollVisibilityListener((direction) => {
      translateY.value = direction === 'down' ? withSpring(HIDE_OFFSET, SPRING_CFG) : withSpring(0, SPRING_CFG);
    });
  }, [translateY]);

  useEffect(() => {
    forceScrollVisibility('up');
  }, [props.state.index]);

  // Store layout measurements — never writes to shared values
  const onTabLayout = useCallback((index: number, x: number, w: number) => {
    const prev = layoutsRef.current[index];
    if (prev && prev.x === x && prev.w === w) return;
    layoutsRef.current[index] = { x, w };
  }, []);

  // React to tab index changes — writes to shared values inside useEffect (safe)
  useEffect(() => {
    const idx = props.state.index;
    if (idx === activeIndexRef.current && pillReadyRef.current) return;
    activeIndexRef.current = idx;

    const lay = layoutsRef.current[idx];
    if (!lay) return;

    if (!pillReadyRef.current) {
      pillReadyRef.current = true;
      pillX.value = lay.x;
      pillW.value = lay.w;
    } else {
      pillX.value = withSpring(lay.x, SPRING_CFG);
      pillW.value = withSpring(lay.w, SPRING_CFG);
    }
  }, [props.state.index, pillX, pillW]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    width: pillW.value,
  }));

  const hideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.tabBarContainer, hideStyle]}>
      <View style={[styles.shadowWrapper, { shadowColor: colors.border }]}>
        <View style={[styles.tabBar, { backgroundColor: colors.tabBar }]}>
          <Animated.View style={[styles.activePill, { backgroundColor: colors.tint + '15' }, pillStyle]} />
          {routes.map((route) => {
            const idx = props.state.routes.indexOf(route);
            return (
              <TabBarItem
                key={route.key}
                state={props.state}
                descriptors={props.descriptors}
                navigation={props.navigation}
                route={route}
                index={idx}
                onTabLayout={onTabLayout}
              />
            );
          })}
        </View>
      </View>
    </Animated.View>
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
  tabItemWrapper: { flex: 1, zIndex: 1 },
  tabItem: { alignItems: 'center', justifyContent: 'center', height: '100%' },
  iconContainer: { marginBottom: 2, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 10, letterSpacing: 0.3 },
});
