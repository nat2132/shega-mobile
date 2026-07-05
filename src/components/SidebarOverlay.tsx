import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableWithoutFeedback, Dimensions, Modal } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, interpolate, runOnJS, Easing } from 'react-native-reanimated';
import { useSidebar } from '@/context/SidebarContext';
import MyStoreMenu from '@/screens/bars/sidebar';

const { width } = Dimensions.get('window');

export default function SidebarOverlay() {
  const { isOpen, closeSidebar } = useSidebar();
  const [modalVisible, setModalVisible] = useState(false);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (isOpen) {
      setModalVisible(true);
      progress.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.circle) });
    } else {
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
        <Animated.View
          style={[StyleSheet.absoluteFill, animatedBackgroundStyle, { backgroundColor: 'rgba(0,0,0,0.50)' }]}
        >
          <TouchableWithoutFeedback onPress={closeSidebar}>
            <View style={{ flex: 1 }} />
          </TouchableWithoutFeedback>
        </Animated.View>

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
