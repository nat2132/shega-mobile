import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, { useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Home, Store, Warehouse, Settings as SettingsIcon } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';
import { useSettings } from '@/context/SettingsContext';

const { width } = Dimensions.get('window');

type TabBarItemProps = {
  state: any;
  descriptors: any;
  navigation: any;
  route: any;
  index: number;
};

const TabBarItem: React.FC<TabBarItemProps> = ({ 
  state, 
  descriptors, 
  navigation, 
  route, 
  index 
}) => {
  const isFocused = state.index === index;
  const { colors, t } = useSettings();
  const { options } = descriptors[route.key];
  const displayName = route.name.replace('(tabs)/', '').replace('-hub', '');
  const label = isFocused || true // Always try to translate
    ? t(`tabs.${displayName}`)
    : (options.tabBarLabel !== undefined
      ? options.tabBarLabel
      : options.title !== undefined
        ? options.title
        : route.name);

  // Animation values
  const scale = useSharedValue(1);
  const dotScale = useSharedValue(0);

  useEffect(() => {
    if (isFocused) {
      dotScale.value = withSpring(1, { damping: 15, stiffness: 300 });
    } else {
      dotScale.value = withSpring(0, { damping: 15, stiffness: 300 });
    }
  }, [isFocused]);

  const onPress = () => {
    // Add a slight pop animation on press
    scale.value = withSpring(0.9, { damping: 10, stiffness: 400 }, () => {
      scale.value = withSpring(1, { damping: 10, stiffness: 400 });
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

  const dotAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: dotScale.value }],
    };
  });

  const containerAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const getIcon = () => {
    const color = isFocused ? colors.text : colors.textSecondary;
    const strokeWidth = isFocused ? 2.5 : 2;
    const size = 26;

    if (route.name.includes('dashboard')) return <Home size={size} color={color} strokeWidth={strokeWidth} />;
    if (route.name.includes('sales')) return <Store size={size} color={color} strokeWidth={strokeWidth} />;
    if (route.name.includes('inventory')) return <Warehouse size={size} color={color} strokeWidth={strokeWidth} />;
    if (route.name.includes('settings')) return <SettingsIcon size={size} color={color} strokeWidth={strokeWidth} />;
    
    return <Home size={size} color={color} strokeWidth={strokeWidth} />;
  };

  return (
    <Animated.View style={[styles.tabItemWrapper, containerAnimatedStyle]}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        accessibilityLabel={options.tabBarAccessibilityLabel}
        testID={options.tabBarTestID}
        onPress={onPress}
        style={styles.tabItem}
        activeOpacity={1}
      >
        <View style={styles.iconContainer}>
          {getIcon()}
        </View>
        <Text style={[styles.tabText, { color: isFocused ? colors.text : colors.textSecondary, fontFamily: isFocused ? Fonts.semibold : Fonts.medium }]}>
          {typeof label === 'string' ? label : 'Tab'}
        </Text>
        <View style={styles.dotContainer}>
          <Animated.View style={[styles.activeDot, { backgroundColor: isFocused ? colors.text : 'transparent' }, dotAnimatedStyle]} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

export const CustomTabBar = (props: BottomTabBarProps) => {
  const { theme, colors } = useSettings();
  
  return (
    <View style={styles.tabBarContainer}>
      <View style={styles.shadowWrapper}>
        <BlurView 
          intensity={80} 
          tint={theme !== 'light' ? 'dark' : 'light'} 
          style={[styles.tabBar, { backgroundColor: theme !== 'light' ? 'rgba(28, 28, 30, 0.8)' : 'rgba(255, 255, 255, 0.4)' }]}
        >
          {props.state.routes
            .filter(route => {
              const n = route.name;
              // Explicitly filter out auxiliary screens, keep everything else (dashboard, sales, inventory, settings)
              return !['expense', 'adjustment', 'summary'].includes(n);
            })
            .map((route) => {
              const index = props.state.routes.indexOf(route);
              return (
                <TabBarItem 
                  key={route.key} 
                  state={props.state} 
                  descriptors={props.descriptors} 
                  navigation={props.navigation} 
                  route={route} 
                  index={index} 
                />
              );
            })}
        </BlurView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    paddingHorizontal: 20,
    paddingBottom: 25, 
    paddingTop: 10,
    backgroundColor: 'transparent',
  },
  shadowWrapper: {
    borderRadius: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  tabBar: {
    flexDirection: 'row',
    height: 80,
    borderRadius: 40,
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 10,
    overflow: 'hidden',
  },
  tabItemWrapper: {
    flex: 1,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  iconContainer: {
    marginBottom: 4,
  },
  tabText: {
    fontSize: 12,
  },
  dotContainer: {
    height: 6,
    marginTop: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  }
});
