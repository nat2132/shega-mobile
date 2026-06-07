import { Fonts } from '@/constants/theme';
import {
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { useEffect } from 'react';
import { MoveLeft, MoveRight, CircleCheckBig } from 'lucide-react-native';
import { AppText } from '@/components/ui';
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
  onBack?: () => void;
  onSkip?: () => void;
}

const SalesOnboardingScreen: React.FC<OnboardingScreenProps> = ({ onNext, onBack, onSkip }) => {
  const moneyY = useSharedValue(0);
  const receiptY = useSharedValue(0);
  const checkY = useSharedValue(0);

  useEffect(() => {
    moneyY.value = withRepeat(
      withTiming(-10, { duration: 2800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    receiptY.value = withDelay(400, withRepeat(
      withTiming(-15, { duration: 3200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    ));
    checkY.value = withDelay(800, withRepeat(
      withTiming(-6, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    ));
  }, [moneyY, receiptY, checkY]);

  const animatedMoneyStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: moneyY.value }],
  }));

  const animatedReceiptStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: receiptY.value }],
  }));

  const animatedCheckStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: checkY.value }],
  }));

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.skipContainer} onPress={onSkip}>
        <AppText style={styles.skipText} variant="caption" weight="bold" transform="uppercase" numberOfLines={1}>SKIP</AppText>
      </TouchableOpacity>

      <View style={styles.mainContent}>
        <Animated.View entering={FadeInDown.duration(800)} style={styles.mediaContainer}>
          <View style={styles.mediaBox}>
            <View style={styles.cardStack}>
              <Image
                source={require('../../assets/images/sales/list.png')}
                style={styles.listCard}
                resizeMode="contain"
              />
              <Animated.View style={[styles.iconOverlayTop, animatedMoneyStyle]}>
                <View style={styles.iconCircle}>
                  <Image
                    source={require('../../assets/images/sales/money.png')}
                    style={styles.floatingIcon}
                    resizeMode="contain"
                  />
                </View>
              </Animated.View>
              <Animated.View style={[styles.iconOverlayBottomLeft, animatedReceiptStyle]}>
                <View style={styles.iconCircle}>
                  <Image
                    source={require('../../assets/images/sales/reciept.png')}
                    style={styles.floatingIcon}
                    resizeMode="contain"
                  />
                </View>
              </Animated.View>
              <Animated.View style={[styles.iconOverlayBottomRight, animatedCheckStyle]}>
                <View style={styles.checkCircle}>
                  <CircleCheckBig size={32} color="#000" />
                </View>
              </Animated.View>
            </View>
          </View>
          <View style={styles.mediaShadow} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(800)} style={styles.textNode}>
          <AppText style={styles.title} variant="heading-lg" weight="bold" numberOfLines={2}>Record Sales</AppText>
          <AppText style={styles.subtitle} variant="body-lg" weight="medium" numberOfLines={3}>
            Easily track every transaction{'\n'}as it happens.
          </AppText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(800)} style={styles.pagination}>
          <View style={styles.dot} />
          <View style={[styles.dot, styles.activeDot]} />
          <View style={styles.dot} />
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(600).duration(800)} style={styles.actionRow}>
          <TouchableOpacity 
            style={styles.backBtn} 
            onPress={onBack}
            activeOpacity={0.7}
          >
            <MoveLeft size={24} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.nextBtn} 
            onPress={onNext}
            activeOpacity={0.8}
          >
            <AppText style={styles.nextText} variant="body" weight="bold" numberOfLines={1}>Next</AppText>
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
    right: 30,
    zIndex: 10,
  },
  skipText: {
    fontFamily: Fonts.bold,
    color: '#000',
    letterSpacing: 1,
  },
  mainContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 40,
  },
  mediaContainer: {
    marginBottom: 60,
    width: width * 0.75,
    height: width * 0.9,
    position: 'relative',
  },
  mediaBox: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
    overflow: 'visible',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  cardStack: {
    width: '100%',
    height: '100%',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listCard: {
    width: '100%',
    height: '100%',
  },
  iconOverlayTop: {
    position: 'absolute',
    top: 50,
    right: -20,
  },
  iconOverlayBottomLeft: {
    position: 'absolute',
    bottom: 120,
    left: -20,
  },
  iconOverlayBottomRight: {
    position: 'absolute',
    bottom: 110,
    right: 40,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(50, 50, 50, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  checkCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  floatingIcon: {
    width: '50%',
    height: '50%',
  },
  mediaShadow: {
    position: 'absolute',
    top: '15%',
    left: '15%',
    width: '70%',
    height: '70%',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 30 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    zIndex: 1,
    elevation: 25,
  },
  textNode: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontFamily: Fonts.extrabold,
    color: '#000',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    color: '#777',
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
  actionRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 40,
  },
  backBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#A0A0A0',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  nextBtn: {
    flexDirection: 'row',
    backgroundColor: '#000',
    height: 64,
    borderRadius: 32,
    paddingHorizontal: 32,
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
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
  },
});

export default SalesOnboardingScreen;