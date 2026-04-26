import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableWithoutFeedback, Dimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, interpolate, runOnJS } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSidebar } from '@/context/SidebarContext';
import MyStoreMenu from '@/screens/bars/sidebar';

const { width } = Dimensions.get('window');
const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

export default function SidebarOverlay() {
  const { isOpen, closeSidebar } = useSidebar();
  const [shouldRender, setShouldRender] = useState(isOpen);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      progress.value = withSpring(1, { damping: 22, stiffness: 220 });
    } else {
      progress.value = withSpring(0, { damping: 22, stiffness: 220 }, (finished) => {
        if (finished) {
          runOnJS(setShouldRender)(false);
        }
      });
    }
  }, [isOpen]);

  const animatedDrawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-width, 0]) }]
  }));

  const animatedBackgroundStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  if (!shouldRender) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={isOpen ? 'auto' : 'none'}>
       {/* Background Blur mapped mathematically to progress */}
       <AnimatedBlurView 
         style={[StyleSheet.absoluteFill, animatedBackgroundStyle]} 
         tint="dark" 
         intensity={45} 
       >
         <TouchableWithoutFeedback onPress={closeSidebar}>
            <View style={{ flex: 1 }} />
         </TouchableWithoutFeedback>
       </AnimatedBlurView>

       {/* Interactive Sidebar translating perfectly over */}
       <Animated.View style={[{ width: width * 0.82, flex: 1, elevation: 20 }, animatedDrawerStyle]}>
         <MyStoreMenu onClose={closeSidebar} />
       </Animated.View>
    </View>
  );
}
