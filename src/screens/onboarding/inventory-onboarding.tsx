import { Fonts } from '@/constants/theme';
import {
  Dimensions,
  StyleSheet,
  Text as RNText,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { useEffect } from 'react';
import { MoveRight } from 'lucide-react-native';
import Animated, { 
  FadeInDown, 
  FadeInUp, 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withDelay,
  Easing 
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

interface OnboardingScreenProps {
  onNext?: () => void;
  onSkip?: () => void;
}

const InventoryOnboardingScreen: React.FC<OnboardingScreenProps> = ({ onNext, onSkip }) => {
  const boxY = useSharedValue(0);
  const overlayY = useSharedValue(0);

  useEffect(() => {
    boxY.value = withRepeat(
      withTiming(-8, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    overlayY.value = withDelay(500, withRepeat(
      withTiming(-12, { duration: 3500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    ));
  }, []);

  const animatedBoxStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: boxY.value }],
  }));

  const animatedOverlayStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: overlayY.value }],
  }));

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.skipContainer} onPress={onSkip}>
        <RNText style={styles.skipText}>SKIP</RNText>
      </TouchableOpacity>

      <View style={styles.mainContent}>
        <Animated.View entering={FadeInDown.duration(800)} style={styles.mediaContainer}>
          <View style={styles.mediaBox}>
            <View style={styles.imageStack}>
              <Animated.Image
                source={require('../../assets/images/inventory/Monochrome inventory box.png')}
                style={[styles.baseImage, animatedBoxStyle]}
                resizeMode="contain"
              />
              <Animated.Image
                source={require('../../assets/images/inventory/UI Layering Effect.png')}
                style={[styles.overlayImage, animatedOverlayStyle]}
                resizeMode="contain"
              />
            </View>
          </View>
          <View style={styles.mediaShadow} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(800)} style={styles.textNode}>
          <RNText style={styles.title}>Track Inventory</RNText>
          <RNText style={styles.subtitle}>
            Manage your stock in real-time{'\n'}with ease.
          </RNText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(800)} style={styles.pagination}>
          <View style={[styles.dot, styles.activeDot]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(600).duration(800)} style={styles.actionNode}>
          <TouchableOpacity 
            style={styles.nextBtn} 
            onPress={onNext}
            activeOpacity={0.8}
          >
            <RNText style={styles.nextText}>Next</RNText>
            <MoveRight size={20} color="#FFF" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  skipContainer: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    zIndex: 10,
  },
  skipText: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#000',
    letterSpacing: 1,
  },
  mainContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  mediaContainer: {
    marginBottom: 60,
    width: width * 0.75,
    height: width * 0.6,
    position: 'relative',
  },
  mediaBox: {
    width: '100%',
    height: '100%',
    backgroundColor: '#222222',
    borderRadius: 40,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  imageStack: {
    width: '80%',
    height: '80%',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  baseImage: {
    width: '100%',
    height: '100%',
    opacity: 0.9,
  },
  overlayImage: {
    position: 'absolute',
    width: '60%',
    height: '60%',
    right: -10,
    bottom: 0,
  },
  mediaShadow: {
    position: 'absolute',
    top: '10%',
    left: '10%',
    width: '80%',
    height: '80%',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    zIndex: 1,
    elevation: 20,
  },
  textNode: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 34,
    fontFamily: Fonts.extrabold,
    color: '#000',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    lineHeight: 28,
    fontFamily: Fonts.medium,
  },
  pagination: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 60,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
  activeDot: {
    width: 32,
    backgroundColor: '#000',
  },
  actionNode: {
    width: '100%',
    paddingBottom: 40,
  },
  nextBtn: {
    flexDirection: 'row',
    backgroundColor: '#000',
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
  },
  nextText: {
    color: '#FFF',
    fontSize: 18,
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
  },
});

export default InventoryOnboardingScreen;