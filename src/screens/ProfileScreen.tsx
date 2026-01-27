import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { ratingsService, UserRatingRow } from '../services/supabase/ratings';
import { storageService } from '../services/storage';
import { COLORS } from '../utils/constants';
import { RootStackParamList, TrackedShow } from '../types';
import StarRating, { formatRating } from '../components/StarRating';
import ShowPoster from '../components/ShowPoster';
import SignInScreen from './auth/SignInScreen';
import SignUpScreen from './auth/SignUpScreen';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Extended rating with show info for display
interface RatingWithShowInfo extends UserRatingRow {
  showTitle?: string;
  posterPath?: string | null;
}

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, isConfigured, signOut } = useAuth();
  const [authScreen, setAuthScreen] = useState<'signIn' | 'signUp' | null>(null);
  const [ratings, setRatings] = useState<RatingWithShowInfo[]>([]);
  const [ratingsLoading, setRatingsLoading] = useState(false);

  // Load user's ratings
  useEffect(() => {
    async function loadRatings() {
      if (!user) {
        setRatings([]);
        return;
      }

      setRatingsLoading(true);
      try {
        const userRatings = await ratingsService.getUserShowRatings(user.id);

        // Enrich with show info from local storage
        const enrichedRatings: RatingWithShowInfo[] = await Promise.all(
          userRatings.map(async (rating) => {
            const show = await storageService.getShow(rating.tmdb_id);
            return {
              ...rating,
              showTitle: show?.title,
              posterPath: show?.posterPath,
            };
          })
        );

        setRatings(enrichedRatings);
      } catch (e) {
        console.error('Failed to load ratings:', e);
      } finally {
        setRatingsLoading(false);
      }
    }

    loadRatings();
  }, [user]);

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleRatingPress = async (rating: RatingWithShowInfo) => {
    // Get full show info from storage
    const show = await storageService.getShow(rating.tmdb_id);
    if (show) {
      navigation.navigate('ShowDetail', { show });
    }
  };

  // Show auth screen if user is not signed in and wants to sign in
  if (authScreen === 'signIn') {
    return (
      <SignInScreen
        onNavigateToSignUp={() => setAuthScreen('signUp')}
        onSkip={() => setAuthScreen(null)}
      />
    );
  }

  if (authScreen === 'signUp') {
    return (
      <SignUpScreen
        onNavigateToSignIn={() => setAuthScreen('signIn')}
        onSkip={() => setAuthScreen(null)}
      />
    );
  }

  // User is signed in
  if (user) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarTextLarge}>
              {user.email?.[0].toUpperCase() || 'U'}
            </Text>
          </View>
          <Text style={styles.email}>{user.email}</Text>
          <View style={styles.syncBadge}>
            <Ionicons name="cloud-done" size={14} color={COLORS.primary} />
            <Text style={styles.syncBadgeText}>Synced</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="sync-outline" size={22} color={COLORS.text} />
            <Text style={styles.menuItemText}>Sync Settings</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="notifications-outline" size={22} color={COLORS.text} />
            <Text style={styles.menuItemText}>Notifications</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* My Ratings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Ratings</Text>

          {ratingsLoading ? (
            <ActivityIndicator color={COLORS.primary} style={{ padding: 20 }} />
          ) : ratings.length === 0 ? (
            <View style={styles.emptyRatings}>
              <Ionicons name="star-outline" size={32} color={COLORS.textSecondary} />
              <Text style={styles.emptyRatingsText}>No ratings yet</Text>
              <Text style={styles.emptyRatingsHint}>Rate shows to see them here</Text>
            </View>
          ) : (
            <View style={styles.ratingsGrid}>
              {ratings.slice(0, 6).map((rating) => (
                <TouchableOpacity
                  key={rating.id}
                  style={styles.ratingCard}
                  onPress={() => handleRatingPress(rating)}
                >
                  <ShowPoster path={rating.posterPath ?? null} size="small" width={50} height={75} />
                  <View style={styles.ratingCardInfo}>
                    <Text style={styles.ratingCardTitle} numberOfLines={2}>
                      {rating.showTitle || `Show #${rating.tmdb_id}`}
                    </Text>
                    <StarRating value={rating.rating} size={14} readonly />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {ratings.length > 6 && (
            <TouchableOpacity style={styles.seeAllButton}>
              <Text style={styles.seeAllText}>See All ({ratings.length})</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App</Text>

          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="information-circle-outline" size={22} color={COLORS.text} />
            <Text style={styles.menuItemText}>About</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={22} color={COLORS.error} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // User is not signed in - show prompt
  return (
    <View style={styles.container}>
      <View style={styles.notSignedInContainer}>
        <Ionicons name="cloud-offline-outline" size={64} color={COLORS.textSecondary} />
        <Text style={styles.notSignedInTitle}>Not Signed In</Text>
        <Text style={styles.notSignedInText}>
          Sign in to sync your shows across devices and access social features.
        </Text>

        {!isConfigured && (
          <View style={styles.warningContainer}>
            <Ionicons name="warning-outline" size={20} color={COLORS.warning} />
            <Text style={styles.warningText}>
              Cloud sync is not configured. Your data is stored locally only.
            </Text>
          </View>
        )}

        {isConfigured && (
          <>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={() => setAuthScreen('signIn')}
            >
              <Text style={styles.buttonText}>Sign In</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={() => setAuthScreen('signUp')}
            >
              <Text style={styles.secondaryButtonText}>Create Account</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={styles.localOnlyNote}>
        <Ionicons name="phone-portrait-outline" size={18} color={COLORS.textSecondary} />
        <Text style={styles.localOnlyText}>
          Your data is currently stored locally on this device.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarTextLarge: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: '600',
  },
  email: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '500',
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.primary}20`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
    gap: 4,
  },
  syncBadgeText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  section: {
    paddingTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  menuItemText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    marginHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  signOutText: {
    color: COLORS.error,
    fontSize: 16,
    fontWeight: '500',
  },
  notSignedInContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  notSignedInTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '600',
    marginTop: 8,
  },
  notSignedInText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.warning}20`,
    padding: 12,
    borderRadius: 10,
    marginTop: 16,
    gap: 8,
  },
  warningText: {
    color: COLORS.warning,
    fontSize: 14,
    flex: 1,
  },
  button: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    marginTop: 24,
  },
  secondaryButton: {
    backgroundColor: COLORS.surface,
  },
  buttonText: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '500',
  },
  localOnlyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  localOnlyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  emptyRatings: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    gap: 8,
  },
  emptyRatingsText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '500',
  },
  emptyRatingsHint: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  ratingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  ratingCard: {
    width: '47%',
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    overflow: 'hidden',
    gap: 10,
  },
  ratingCardInfo: {
    flex: 1,
    paddingVertical: 8,
    paddingRight: 8,
    justifyContent: 'center',
    gap: 4,
  },
  ratingCardTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '500',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
    gap: 4,
  },
  seeAllText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '500',
  },
});
