import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableWithoutFeedback, Dimensions, Modal, Platform } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, interpolate, runOnJS, Easing } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSidebar } from '@/context/SidebarContext';
import MyStoreMenu from '@/screens/bars/sidebar';

const { width } = Dimensions.get('window');
const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

export default function SidebarOverlay() {
  const { isOpen, closeSidebar } = useSidebar();
  // modalVisible stays true during the closing animation so the slide-out plays
  const [modalVisible, setModalVisible] = useState(false);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (isOpen) {
      // Show modal first, then animate in
      setModalVisible(true);
      progress.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.circle) });
    } else {
      // Animate out first, then hide modal
      progress.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.circle) }, (finished) => {
        if (finished) {
          runOnJS(setModalVisible)(false);
        }
      });
    }
  }, [isOpen]);

  const animatedDrawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-width, 0]) }],
  }));

  const animatedBackgroundStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={closeSidebar}
      statusBarTranslucent
    >
      <View style={StyleSheet.absoluteFill}>
        {/* Blurred / dimmed backdrop */}
        {Platform.OS === 'ios' ? (
          <AnimatedBlurView
            style={[StyleSheet.absoluteFill, animatedBackgroundStyle]}
            tint="dark"
            intensity={45}
          >
            <TouchableWithoutFeedback onPress={closeSidebar}>
              <View style={{ flex: 1 }} />
            </TouchableWithoutFeedback>
          </AnimatedBlurView>
        ) : (
          <Animated.View
            style={[StyleSheet.absoluteFill, animatedBackgroundStyle, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
          >
            <TouchableWithoutFeedback onPress={closeSidebar}>
              <View style={{ flex: 1 }} />
            </TouchableWithoutFeedback>
          </Animated.View>
        )}

        {/* Sidebar drawer — slides in from the left */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: width * 0.82,
              elevation: 20,
            },
            animatedDrawerStyle,
          ]}
        >
          <MyStoreMenu onClose={closeSidebar} />
        </Animated.View>
      </View>
    </Modal>
  );
}
