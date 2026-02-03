import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { ratingsService, UserRatingRow } from '../services/supabase/ratings';
import { followsService } from '../services/supabase/follows';
import { useDataExport } from '../hooks/useDataExport';
import { storageService } from '../services/storage';
import { useFollowCounts } from '../hooks/useFollows';
import { useProfileVisibility } from '../hooks/useProfileVisibility';
import { COLORS } from '../utils/constants';
import { validateUsername, cleanUsername, USERNAME_MIN_LENGTH } from '../utils/validation';
import { RootStackParamList, TrackedShow, UserProfile } from '../types';
import StarRating, { formatRating } from '../components/StarRating';
import ShowPoster from '../components/ShowPoster';
import ProfileVisibilitySheet from '../components/ProfileVisibilitySheet';
import SignInScreen from './auth/SignInScreen';
import SignUpScreen from './auth/SignUpScreen';

// Edit Profile Modal Component
interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  currentProfile: UserProfile | null;
  userId: string;
  onSave: (updated: UserProfile) => void;
}

function EditProfileModal({
  visible,
  onClose,
  currentProfile,
  userId,
  onSave,
}: EditProfileModalProps) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<
    'idle' | 'available' | 'taken' | 'unchanged'
  >('idle');
  const [error, setError] = useState<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize form when modal opens, cleanup on close/unmount
  useEffect(() => {
    if (visible && currentProfile) {
      setUsername(currentProfile.username || '');
      setDisplayName(currentProfile.displayName || '');
      setBio(currentProfile.bio || '');
      setUsernameStatus('unchanged');
      setError(null);
    }
    return () => {
      // Clear debounce timer on close or unmount
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [visible, currentProfile]);

  // Check username availability with debounce
  const checkAvailability = useCallback(
    async (value: string) => {
      if (
        value.toLowerCase() === currentProfile?.username?.toLowerCase()
      ) {
        setUsernameStatus('unchanged');
        return;
      }

      const validationError = validateUsername(value);
      if (validationError) {
        setUsernameStatus('idle');
        return;
      }

      setCheckingUsername(true);
      try {
        const available = await followsService.isUsernameAvailable(value);
        setUsernameStatus(available ? 'available' : 'taken');
      } catch (e) {
        console.error('Failed to check username:', e);
        setUsernameStatus('idle');
      } finally {
        setCheckingUsername(false);
      }
    },
    [currentProfile?.username]
  );

  const handleUsernameChange = useCallback(
    (value: string) => {
      // Only allow valid characters while typing
      const cleaned = cleanUsername(value);
      setUsername(cleaned);

      // Clear previous debounce timer FIRST (before any early returns)
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Check if unchanged from original
      if (cleaned.toLowerCase() === currentProfile?.username?.toLowerCase()) {
        setUsernameStatus('unchanged');
        return;
      }

      setUsernameStatus('idle');

      // Debounce the availability check
      if (cleaned.length >= USERNAME_MIN_LENGTH) {
        debounceTimerRef.current = setTimeout(() => checkAvailability(cleaned), 500);
      }
    },
    [currentProfile?.username, checkAvailability]
  );

  const handleSave = async () => {
    // Validate username format
    const usernameError = validateUsername(username);
    if (usernameError) {
      setError(usernameError);
      return;
    }

    // Check if taken
    if (usernameStatus === 'taken') {
      setError('Username is already taken');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Final availability check if username changed
      if (username.toLowerCase() !== currentProfile?.username?.toLowerCase()) {
        const available = await followsService.isUsernameAvailable(username);
        if (!available) {
          setError('Username is already taken');
          setUsernameStatus('taken');
          setSaving(false);
          return;
        }
      }

      await followsService.updateProfile(userId, {
        username,
        displayName: displayName || undefined,
        bio: bio || undefined,
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSave({
        id: userId,
        username: username.toLowerCase(),
        displayName: displayName || null,
        avatarUrl: currentProfile?.avatarUrl || null,
        bio: bio || null,
      });
      onClose();
    } catch (e) {
      console.error('Failed to update profile:', e);
      setError('Failed to update profile. Please try again.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  const getStatusIcon = () => {
    if (checkingUsername) {
      return <ActivityIndicator size="small" color={COLORS.textSecondary} />;
    }
    if (usernameStatus === 'available') {
      return <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />;
    }
    if (usernameStatus === 'taken') {
      return <Ionicons name="close-circle" size={20} color={COLORS.error} />;
    }
    if (usernameStatus === 'unchanged') {
      return <Ionicons name="checkmark-circle" size={20} color={COLORS.textSecondary} />;
    }
    return null;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalHeaderButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Edit Profile</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={styles.modalHeaderButton}
          >
            {saving ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Text style={styles.saveText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          {error && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color={COLORS.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Username</Text>
            <View style={styles.inputWithIcon}>
              <Ionicons name="at" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.textInput}
                value={username}
                onChangeText={handleUsernameChange}
                placeholder="username"
                placeholderTextColor={COLORS.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {getStatusIcon()}
            </View>
            <Text style={styles.inputHint}>
              3-20 characters, letters, numbers, and underscores only
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Display Name</Text>
            <View style={styles.inputWithIcon}>
              <Ionicons name="person-outline" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.textInput}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Display Name (optional)"
                placeholderTextColor={COLORS.textTertiary}
                maxLength={50}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Bio</Text>
            <TextInput
              style={[styles.textInput, styles.bioInput]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us about yourself (optional)"
              placeholderTextColor={COLORS.textTertiary}
              multiline
              numberOfLines={3}
              maxLength={160}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{bio.length}/160</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [visibilitySheetVisible, setVisibilitySheetVisible] = useState(false);

  // Profile visibility settings
  const { visibility, updateVisibility } = useProfileVisibility();

  // Data export
  const { isExporting, exportData } = useDataExport();

  // Follow counts for signed-in user
  const { followers, following, loading: followCountsLoading } = useFollowCounts(
    user?.id ?? ''
  );

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

  // Load user's profile
  useEffect(() => {
    async function loadProfile() {
      if (!user) {
        setProfile(null);
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);
      try {
        const data = await followsService.getUserProfile(user.id);
        setProfile(data);
      } catch (e) {
        console.error('Failed to load profile:', e);
      } finally {
        setProfileLoading(false);
      }
    }

    loadProfile();
  }, [user]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    try {
      const data = await followsService.getUserProfile(user.id);
      setProfile(data);
    } catch (e) {
      console.error('Failed to refresh profile:', e);
    }
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

  const handleShare = async () => {
    if (!profile?.username) {
      Alert.alert(
        'Set Username',
        'Please set a username in Edit Profile before sharing your profile.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      await Share.share({
        message: `Check out my TV tracking profile on UpNext! upnext://profile/${profile.username}`,
      });
    } catch (e) {
      console.error('Failed to share profile:', e);
      Alert.alert(
        'Share Failed',
        'Unable to share your profile. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleExportData = () => {
    Alert.alert(
      'Export Data',
      'Export all your shows, movies, watch history, and ratings to a JSON file.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export',
          onPress: async () => {
            try {
              const result = await exportData();
              // Only show success haptic if user actually shared (not cancelled)
              if (result === 'shared') {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } catch (e) {
              console.error('Failed to export data:', e);
              Alert.alert(
                'Export Failed',
                'Unable to export your data. Please try again.',
                [{ text: 'OK' }]
              );
            }
          },
        },
      ]
    );
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
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarTextLarge}>
              {(profile?.displayName?.[0] || profile?.username?.[0] || user.email?.[0] || 'U').toUpperCase()}
            </Text>
          </View>
          {profileLoading ? (
            <ActivityIndicator color={COLORS.textSecondary} style={{ marginVertical: 8 }} />
          ) : (
            <>
              <Text style={styles.displayName}>
                {profile?.displayName || profile?.username || user.email?.split('@')[0]}
              </Text>
              {profile?.username && (
                <Text style={styles.username}>@{profile.username}</Text>
              )}
            </>
          )}
          <Text style={styles.email}>{user.email}</Text>
          <View style={styles.syncBadge}>
            <Ionicons name="cloud-done" size={14} color={COLORS.primary} />
            <Text style={styles.syncBadgeText}>Synced</Text>
          </View>

          {/* Profile Actions */}
          <View style={styles.profileActions}>
            <TouchableOpacity
              style={styles.profileActionButton}
              onPress={handleShare}
            >
              <Ionicons name="share-outline" size={20} color={COLORS.primary} />
              <Text style={styles.profileActionText}>Share</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.profileActionButton}
              onPress={() => setVisibilitySheetVisible(true)}
            >
              <Ionicons name="eye-outline" size={20} color={COLORS.primary} />
              <Text style={styles.profileActionText}>Privacy</Text>
            </TouchableOpacity>
          </View>

          {/* Follow Stats */}
          <View style={styles.statsRow}>
            <TouchableOpacity
              style={styles.statItem}
              onPress={() =>
                navigation.navigate('Followers', {
                  userId: user.id,
                  username: profile?.username || user.email?.split('@')[0],
                })
              }
            >
              <Text style={styles.statNumber}>
                {followCountsLoading ? '-' : followers}
              </Text>
              <Text style={styles.statLabel}>Followers</Text>
            </TouchableOpacity>

            <View style={styles.statDivider} />

            <TouchableOpacity
              style={styles.statItem}
              onPress={() =>
                navigation.navigate('Following', {
                  userId: user.id,
                  username: profile?.username || user.email?.split('@')[0],
                })
              }
            >
              <Text style={styles.statNumber}>
                {followCountsLoading ? '-' : following}
              </Text>
              <Text style={styles.statLabel}>Following</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Social</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('UserSearch')}
          >
            <Ionicons name="people-outline" size={22} color={COLORS.text} />
            <Text style={styles.menuItemText}>Find People</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setEditModalVisible(true)}
          >
            <Ionicons name="person-outline" size={22} color={COLORS.text} />
            <Text style={styles.menuItemText}>Edit Profile</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
          </TouchableOpacity>

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

          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleExportData}
            disabled={isExporting}
          >
            <Ionicons name="download-outline" size={22} color={COLORS.text} />
            <Text style={styles.menuItemText}>Export Data</Text>
            {isExporting ? (
              <ActivityIndicator size="small" color={COLORS.textSecondary} />
            ) : (
              <Ionicons name="chevron-forward" size={20} color={COLORS.textTertiary} />
            )}
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

        <EditProfileModal
          visible={editModalVisible}
          onClose={() => setEditModalVisible(false)}
          currentProfile={profile}
          userId={user.id}
          onSave={(updated) => {
            setProfile(updated);
            refreshProfile();
          }}
        />

        <ProfileVisibilitySheet
          visible={visibilitySheetVisible}
          onClose={() => setVisibilitySheetVisible(false)}
          visibility={visibility}
          onSave={updateVisibility}
        />
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
  scrollContent: {
    paddingBottom: 40,
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
  displayName: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 2,
  },
  username: {
    color: COLORS.textSecondary,
    fontSize: 15,
    marginBottom: 4,
  },
  email: {
    color: COLORS.textTertiary,
    fontSize: 13,
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
  profileActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  profileActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${COLORS.primary}15`,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  profileActionText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.border,
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
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalHeaderButton: {
    minWidth: 60,
  },
  cancelText: {
    color: COLORS.text,
    fontSize: 16,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '600',
  },
  saveText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.error}20`,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    flex: 1,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  textInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
    paddingVertical: 12,
  },
  inputHint: {
    color: COLORS.textTertiary,
    fontSize: 12,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  bioInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
    minHeight: 80,
  },
  charCount: {
    color: COLORS.textTertiary,
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
});
