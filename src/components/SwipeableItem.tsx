import React, { useRef } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Animated,
  PanResponder,
  Text,
  Dimensions,
} from 'react-native';
import { Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = -80;

interface SwipeableItemProps {
  children: React.ReactNode;
  onDelete: () => void | Promise<void>;
  itemTitle?: string;
  enabled?: boolean;
}

export const SwipeableItem: React.FC<SwipeableItemProps> = ({
  children,
  onDelete,
  itemTitle = 'this item',
  enabled = true,
}) => {
  const pan = useRef(new Animated.Value(0)).current;
  const isSwipingRef = useRef(false);

  const resetPosition = () => {
    Animated.spring(pan, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 8,
    }).start();
  };

  const confirmDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete ${itemTitle}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: resetPosition,
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Animated.timing(pan, {
              toValue: -SCREEN_WIDTH,
              duration: 200,
              useNativeDriver: true,
            }).start(() => {
              onDelete();
            });
          },
        },
      ]
    );
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        // Only capture horizontal swipes to the left
        // Must be moving left (dx < -10) and mostly horizontal
        return gestureState.dx < -10 && Math.abs(gestureState.dy) < Math.abs(gestureState.dx);
      },
      onMoveShouldSetPanResponderCapture: (_evt, gestureState) => {
        return gestureState.dx < -15 && Math.abs(gestureState.dy) < Math.abs(gestureState.dx) * 0.5;
      },
      onPanResponderGrant: () => {
        isSwipingRef.current = true;
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (gestureState.dx < 0) {
          // Add resistance after threshold
          let value = gestureState.dx;
          if (value < SWIPE_THRESHOLD) {
            value = SWIPE_THRESHOLD + (gestureState.dx - SWIPE_THRESHOLD) * 0.3;
          }
          pan.setValue(value);
        }
      },
      onPanResponderRelease: (_evt, gestureState) => {
        isSwipingRef.current = false;
        if (gestureState.dx < SWIPE_THRESHOLD) {
          // Snap to reveal delete button, then confirm
          Animated.spring(pan, {
            toValue: SWIPE_THRESHOLD,
            useNativeDriver: true,
            bounciness: 5,
          }).start(() => {
            confirmDelete();
          });
        } else {
          resetPosition();
        }
      },
      onPanResponderTerminate: () => {
        isSwipingRef.current = false;
        resetPosition();
      },
    })
  ).current;

  if (!enabled) return <>{children}</>;

  const deleteOpacity = pan.interpolate({
    inputRange: [SWIPE_THRESHOLD, -20, 0],
    outputRange: [1, 0.3, 0],
    extrapolate: 'clamp',
  });

  const deleteScale = pan.interpolate({
    inputRange: [SWIPE_THRESHOLD, -20, 0],
    outputRange: [1, 0.5, 0.3],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.outerContainer}>
      {/* Delete background */}
      <View style={styles.deleteBackground}>
        <Animated.View
          style={[
            styles.deleteContent,
            { opacity: deleteOpacity, transform: [{ scale: deleteScale }] },
          ]}
        >
          <Trash2 size={20} color="#FFF" />
          <Text style={styles.deleteText}>Delete</Text>
        </Animated.View>
      </View>

      {/* Swipeable foreground */}
      <Animated.View
        style={{ transform: [{ translateX: pan }] }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16,
    marginVertical: 6, // Managed spacing to prevent background bleed
  },
  deleteBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FF3B30',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 25,
  },
  deleteContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
});
