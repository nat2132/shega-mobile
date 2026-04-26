import { useEffect } from 'react';
import { Fonts } from '@/constants/theme';
import {
  Dimensions,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

const FirstOnboardingScreen: React.FC<{ onNext?: () => void }> = ({ onNext }) => {
  const player = useVideoPlayer(require('../../assets/videos/video.mp4'), player => {
    player.loop = false;
    player.play();
  });

  useEffect(() => {
    const subscription = player.addListener('playToEnd', () => {
      onNext?.();
    });
    return () => {
      subscription.remove();
    };
  }, [player, onNext]);

  return (
    <View style={styles.container}>
      <View style={styles.mainContent}>
        {/* Vertical Glow Column */}
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.4)', 'rgba(255,255,255,0)']}
          style={styles.glowColumn}
        >
          <View style={styles.brandingNode}>
            {/* Animated Video Slot (Replacing Icon) */}
            <Animated.View entering={FadeInDown.duration(1000)} style={styles.videoSlot}>
              <View style={styles.videoInner}>
                <VideoView
                  player={player}
                  style={styles.introVideo}
                  contentFit="cover"
                />
              </View>
            </Animated.View>

            {/* Animated Branding */}
            <Animated.View entering={FadeInDown.delay(400).duration(800)} style={styles.textNode}>
              <RNText style={styles.appName}>SHEGA</RNText>
              <Animated.View entering={FadeIn.delay(1000).duration(800)}>
                <RNText style={styles.slogan}>THE MONOCHROME CURATOR</RNText>
              </Animated.View>
            </Animated.View>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowColumn: {
    width: 280,
    height: height * 0.75,
    borderRadius: 140,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  brandingNode: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  videoSlot: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#000',
    overflow: 'hidden',
    marginBottom: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  videoInner: {
    width: '100%',
    height: '100%',
    borderRadius: 70,
    overflow: 'hidden',
  },
  introVideo: {
    width: '100%',
    height: '100%',
  },
  textNode: {
    alignItems: 'center',
  },
  appName: {
    fontSize: 28,
    fontFamily: Fonts.extrabold,
    color: '#FFF',
    letterSpacing: 6,
    marginBottom: 12,
  },
  slogan: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: '#AAA',
    textTransform: 'uppercase',
    letterSpacing: 4,
    opacity: 0.8,
  },
});

export default FirstOnboardingScreen;