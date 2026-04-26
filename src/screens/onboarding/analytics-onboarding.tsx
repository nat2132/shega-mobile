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
import { MoveLeft, MoveRight } from 'lucide-react-native';
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

const AnalyticsOnboardingScreen: React.FC<OnboardingScreenProps> = ({ onGetStarted, onBack, onSkip }) => {
  const graphY = useSharedValue(0);
  const metricY = useSharedValue(0);

  useEffect(() => {
    graphY.value = withRepeat(
      withTiming(-12, { duration: 3500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    metricY.value = withDelay(600, withRepeat(
      withTiming(-8, { duration: 2800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    ));
  }, []);

  const animatedGraphStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: graphY.value }],
  }));

  const animatedMetricStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: metricY.value }],
  }));

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backContainer} onPress={onBack}>
          <MoveLeft size={24} color="#E0E0E0" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.skipContainer} onPress={onSkip}>
          <RNText style={styles.skipText}>SKIP</RNText>
        </TouchableOpacity>
      </View>

      <View style={styles.mainContent}>
        <Animated.View entering={FadeInDown.duration(800)} style={styles.mediaContainer}>
          <View style={styles.mediaBox}>
            <Image
              source={require('../../assets/images/analytics/Background.png')}
              style={styles.gridBackground}
              resizeMode="cover"
            />
            <View style={styles.graphOverlay}>
              <Animated.Image
                source={require('../../assets/images/analytics/graph.png')}
                style={[styles.lineGraph, animatedGraphStyle]}
                resizeMode="contain"
              />
              <Animated.Image
                source={require('../../assets/images/analytics/metric-card.png')}
                style={[styles.metricCard, animatedMetricStyle]}
                resizeMode="contain"
              />
            </View>
          </View>
          <View style={styles.mediaShadow} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(800)} style={styles.textNode}>
          <RNText style={styles.title}>Get Insights</RNText>
          <RNText style={styles.subtitle}>
            Understand profits, losses, and trends{'\n'}at a glance.
          </RNText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(800)} style={styles.pagination}>
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={[styles.dot, styles.activeDot]} />
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(600).duration(800)} style={styles.actionNode}>
          <TouchableOpacity 
            style={styles.getStartedBtn} 
            onPress={onGetStarted}
            activeOpacity={0.8}
          >
            <RNText style={styles.getStartedText}>Get Started</RNText>
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
  topBar: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    zIndex: 10,
  },
  backContainer: {
    padding: 10,
  },
  skipContainer: {
    padding: 10,
  },
  skipText: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#999',
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
    height: width * 0.75,
    position: 'relative',
  },
  mediaBox: {
    width: '100%',
    height: '100%',
    backgroundColor: '#111',
    borderRadius: 50,
    overflow: 'hidden',
    zIndex: 2,
  },
  gridBackground: {
    width: '100%',
    height: '100%',
    opacity: 0.6,
  },
  graphOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lineGraph: {
    width: '80%',
    height: '40%',
    marginTop: 20,
  },
  metricCard: {
    position: 'absolute',
    top: '20%',
    right: '10%',
    width: '60%',
    height: '30%',
  },
  mediaShadow: {
    position: 'absolute',
    top: '15%',
    left: '15%',
    width: '70%',
    height: '70%',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 50,
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
    fontSize: 34,
    fontFamily: Fonts.extrabold,
    color: '#000',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 18,
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
  actionNode: {
    width: '100%',
    paddingBottom: 40,
  },
  getStartedBtn: {
    flexDirection: 'row',
    backgroundColor: '#000',
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  getStartedText: {
    color: '#FFF',
    fontSize: 18,
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
  },
});

export default AnalyticsOnboardingScreen;