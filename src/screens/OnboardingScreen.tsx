import React, { useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  ViewToken,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { COLORS } from '../utils/constants';
import { onboardingService } from '../services/onboarding';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SlideData {
  key: string;
  title: string;
  subtitle: string;
}

const SLIDES: SlideData[] = [
  {
    key: 'track',
    title: 'Track Everything',
    subtitle: 'Keep tabs on every show, movie, and episode.\nNever lose your place.',
  },
  {
    key: 'social',
    title: 'Stats & Friends',
    subtitle: 'See your viewing stats, follow friends, and\ndiscover what they\u2019re watching.',
  },
];

// --- Icon Compositions ---

function TrackIllustration() {
  return (
    <View style={illustrationStyles.container}>
      {/* Outer decorative ring */}
      <View style={illustrationStyles.outerRing} />
      {/* Inner decorative ring */}
      <View style={illustrationStyles.innerRing} />

      {/* Floating accent icons — scattered around the composition */}
      <View style={[illustrationStyles.floatingIcon, { top: 20, left: 30 }]}>
        <Ionicons name="film-outline" size={22} color={COLORS.primary + '60'} />
      </View>
      <View style={[illustrationStyles.floatingIcon, { top: 40, right: 25 }]}>
        <Ionicons name="star" size={18} color={COLORS.warning + '50'} />
      </View>
      <View style={[illustrationStyles.floatingIcon, { bottom: 45, left: 20 }]}>
        <Ionicons name="time-outline" size={20} color={COLORS.textSecondary + '50'} />
      </View>
      <View style={[illustrationStyles.floatingIcon, { bottom: 30, right: 35 }]}>
        <Ionicons name="bookmark" size={18} color={COLORS.primary + '40'} />
      </View>
      <View style={[illustrationStyles.floatingIcon, { top: 75, left: 10 }]}>
        <Ionicons name="play" size={14} color={COLORS.primary + '35'} />
      </View>
      <View style={[illustrationStyles.floatingIcon, { top: 15, right: 70 }]}>
        <Ionicons name="checkmark" size={16} color={COLORS.primary + '45'} />
      </View>

      {/* Center icon cluster */}
      <View style={illustrationStyles.centerCluster}>
        {/* Glowing backdrop */}
        <View style={illustrationStyles.glowCircle} />
        {/* Primary icon with pill bg */}
        <View style={illustrationStyles.primaryIconBg}>
          <Ionicons name="tv" size={48} color={COLORS.text} />
        </View>
        {/* Secondary icons orbiting */}
        <View style={[illustrationStyles.orbitIcon, { top: -16, right: -16 }]}>
          <View style={illustrationStyles.orbitIconBg}>
            <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
          </View>
        </View>
        <View style={[illustrationStyles.orbitIcon, { bottom: -12, left: -20 }]}>
          <View style={illustrationStyles.orbitIconBgSmall}>
            <Ionicons name="videocam" size={20} color={COLORS.warning} />
          </View>
        </View>
      </View>
    </View>
  );
}

function SocialIllustration() {
  return (
    <View style={illustrationStyles.container}>
      {/* Outer decorative ring */}
      <View style={illustrationStyles.outerRing} />
      {/* Inner decorative ring */}
      <View style={illustrationStyles.innerRing} />

      {/* Floating accent icons */}
      <View style={[illustrationStyles.floatingIcon, { top: 25, left: 40 }]}>
        <Ionicons name="heart" size={20} color={COLORS.error + '50'} />
      </View>
      <View style={[illustrationStyles.floatingIcon, { top: 35, right: 30 }]}>
        <Ionicons name="chatbubble" size={18} color={COLORS.blue + '50'} />
      </View>
      <View style={[illustrationStyles.floatingIcon, { bottom: 50, left: 25 }]}>
        <Ionicons name="trending-up" size={22} color={COLORS.primary + '50'} />
      </View>
      <View style={[illustrationStyles.floatingIcon, { bottom: 35, right: 30 }]}>
        <Ionicons name="bar-chart" size={18} color={COLORS.warning + '45'} />
      </View>
      <View style={[illustrationStyles.floatingIcon, { top: 70, right: 10 }]}>
        <Ionicons name="ribbon" size={16} color={COLORS.primary + '40'} />
      </View>
      <View style={[illustrationStyles.floatingIcon, { top: 10, left: 75 }]}>
        <Ionicons name="flash" size={14} color={COLORS.warning + '40'} />
      </View>

      {/* Center icon cluster */}
      <View style={illustrationStyles.centerCluster}>
        <View style={illustrationStyles.glowCircle} />
        <View style={illustrationStyles.primaryIconBg}>
          <Ionicons name="people" size={48} color={COLORS.text} />
        </View>
        {/* Orbiting icons */}
        <View style={[illustrationStyles.orbitIcon, { top: -16, right: -16 }]}>
          <View style={illustrationStyles.orbitIconBg}>
            <Ionicons name="stats-chart" size={24} color={COLORS.primary} />
          </View>
        </View>
        <View style={[illustrationStyles.orbitIcon, { bottom: -12, left: -20 }]}>
          <View style={illustrationStyles.orbitIconBgSmall}>
            <Ionicons name="pulse" size={20} color={COLORS.blue} />
          </View>
        </View>
      </View>
    </View>
  );
}

// --- Main Screen ---

export default function OnboardingScreen() {
  const navigation = useNavigation<NavigationProp>();
  const flatListRef = useRef<FlatList<SlideData>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
    [],
  );

  const viewabilityConfig = useMemo(
    () => ({ viewAreaCoveragePercentThreshold: 50 }),
    [],
  );

  const handleComplete = useCallback(async () => {
    await onboardingService.markComplete();
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  }, [navigation]);

  const handleNext = useCallback(() => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      handleComplete();
    }
  }, [currentIndex, handleComplete]);

  const isLastSlide = currentIndex === SLIDES.length - 1;

  const renderSlide = useCallback(({ item }: { item: SlideData }) => (
    <View style={slideStyles.slide}>
      <View style={slideStyles.illustrationArea}>
        {item.key === 'track' ? <TrackIllustration /> : <SocialIllustration />}
      </View>
      <View style={slideStyles.textArea}>
        <Text style={slideStyles.title}>{item.title}</Text>
        <Text style={slideStyles.subtitle}>{item.subtitle}</Text>
      </View>
    </View>
  ), []);

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* Bottom controls — fixed */}
      <View style={styles.bottomSection}>
        {/* Dot indicators */}
        <View style={styles.dotsRow}>
          {SLIDES.map((slide, index) => (
            <View
              key={slide.key}
              style={[
                styles.dot,
                index === currentIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        {/* CTA button */}
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaText}>
            {isLastSlide ? 'Get Started' : 'Next'}
          </Text>
          {!isLastSlide && (
            <Ionicons name="arrow-forward" size={20} color={COLORS.text} />
          )}
        </TouchableOpacity>

        {/* Skip link — only on first slide */}
        {!isLastSlide ? (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleComplete}
            activeOpacity={0.7}
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.skipPlaceholder} />
        )}
      </View>
    </View>
  );
}

// --- Styles ---

const ILLUSTRATION_SIZE = Math.min(SCREEN_WIDTH * 0.7, 280);

const illustrationStyles = StyleSheet.create({
  container: {
    width: ILLUSTRATION_SIZE,
    height: ILLUSTRATION_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outerRing: {
    position: 'absolute',
    width: ILLUSTRATION_SIZE,
    height: ILLUSTRATION_SIZE,
    borderRadius: ILLUSTRATION_SIZE / 2,
    borderWidth: 1,
    borderColor: COLORS.border + '40',
  },
  innerRing: {
    position: 'absolute',
    width: ILLUSTRATION_SIZE * 0.7,
    height: ILLUSTRATION_SIZE * 0.7,
    borderRadius: (ILLUSTRATION_SIZE * 0.7) / 2,
    borderWidth: 1,
    borderColor: COLORS.primary + '20',
  },
  floatingIcon: {
    position: 'absolute',
  },
  centerCluster: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowCircle: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.primary + '12',
  },
  primaryIconBg: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  orbitIcon: {
    position: 'absolute',
  },
  orbitIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  orbitIconBgSmall: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
});

const slideStyles = StyleSheet.create({
  slide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  illustrationArea: {
    marginBottom: 48,
  },
  textArea: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 17,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 32,
    paddingBottom: 56,
    alignItems: 'center',
    gap: 16,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
    backgroundColor: COLORS.primary,
  },
  dotInactive: {
    width: 8,
    backgroundColor: COLORS.textTertiary,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 30,
    alignSelf: 'stretch',
  },
  ctaText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  skipText: {
    fontSize: 15,
    color: COLORS.textTertiary,
    fontWeight: '500',
  },
  skipPlaceholder: {
    height: 31,
  },
});
