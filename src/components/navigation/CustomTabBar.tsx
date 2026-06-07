import React, { useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';
import { Fonts } from '@/constants/theme';
import { AppText } from '@/components/ui';
const { width } = Dimensions.get('window');
const TAB_BAR_WIDTH = width - 40; // 20 margin on each side
const TAB_WIDTH = TAB_BAR_WIDTH / 4;

const CustomTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const translateX = useSharedValue(0);

  useEffect(() => {
    translateX.value = withSpring(state.index * TAB_WIDTH, {
      damping: 15,
      stiffness: 100,
    });
  }, [state.index]);

  return (
    <View style={styles.container}>
      <View style={styles.tabBarContainer}>
        {/* Animated Dot Indicator */}
        <Animated.View 
          style={[
            styles.dot, 
            useAnimatedStyle(() => ({
              transform: [{ translateX: translateX.value + (TAB_WIDTH / 2) - 3 }],
            }))
          ]} 
        />

        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.title !== undefined ? options.title : route.name;
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          let iconName: any;
          if (route.name === 'dashboard/index') iconName = isFocused ? 'home' : 'home-outline';
          else if (route.name === 'sales') iconName = isFocused ? 'storefront' : 'storefront-outline';
          else if (route.name === 'inventory') iconName = isFocused ? 'business' : 'business-outline';
          else if (route.name === 'settings') iconName = isFocused ? 'settings' : 'settings-outline';

          return (
            <TouchableOpacity
              key={index}
              onPress={onPress}
              style={styles.tabItem}
              activeOpacity={0.7}
            >
              <Animated.View style={useAnimatedStyle(() => {
                return {
                  transform: [{ scale: withSpring(isFocused ? 1.1 : 1) }]
                };
              })}>
                <Ionicons 
                  name={iconName} 
                  size={26} 
                  color={isFocused ? '#000000' : '#8E8E93'} 
                />
              </Animated.View>
              <AppText
                variant="caption"
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[
                  styles.label,
                  {
                    color: isFocused ? '#000000' : '#8E8E93',
                    fontFamily: isFocused ? Fonts.bold : Fonts.medium,
                    fontWeight: isFocused ? '700' : '500',
                  },
                ]}
              >
                {label}
              </AppText>
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
    bottom: Platform.OS === 'ios' ? 35 : 25,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  tabBarContainer: {
    flexDirection: 'row',
    width: TAB_BAR_WIDTH,
    height: 85,
    backgroundColor: '#F8F9FA',
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    // Shadow for Floating Effect
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
  },
  label: {
    marginTop: 4,
  },
  dot: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#000000',
  },
});

export default CustomTabBar;
