import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList, ActivityItem as ActivityItemType, TrackedShow } from '../types';
import { useActivityFeed } from '../hooks/useActivityFeed';
import { useAuth } from '../contexts/AuthContext';
import ActivityItem from '../components/ActivityItem';
import { COLORS } from '../utils/constants';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ActivityFeedScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const { activities, loading, refreshing, hasMore, error, loadMore, refresh } = useActivityFeed();

  const handleShowPress = useCallback(
    (tmdbId: number, title: string, posterPath: string | null) => {
      // Create a minimal TrackedShow to navigate to ShowDetail
      const show: TrackedShow = {
        tmdbId,
        title,
        posterPath,
        status: 'watchlist',
        addedAt: new Date().toISOString(),
        totalSeasons: 0,
        totalEpisodes: 0,
        streamingServices: [],
      };
      navigation.navigate('ShowDetail', { show });
    },
    [navigation]
  );

  const handleUserPress = useCallback(
    (userId: string) => {
      navigation.navigate('UserProfile', { userId });
    },
    [navigation]
  );

  const renderItem = useCallback(
    ({ item }: { item: ActivityItemType }) => (
      <ActivityItem
        activity={item}
        onShowPress={handleShowPress}
        onUserPress={handleUserPress}
      />
    ),
    [handleShowPress, handleUserPress]
  );

  const renderEmpty = () => {
    if (loading) return null;

    if (!user) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="person-outline" size={64} color={COLORS.textSecondary} />
          <Text style={styles.emptyTitle}>Sign In to See Activity</Text>
          <Text style={styles.emptyText}>
            Sign in to see what your friends are watching
          </Text>
          <TouchableOpacity
            style={styles.signInButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.signInButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={COLORS.error} />
          <Text style={styles.emptyTitle}>Something Went Wrong</Text>
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refresh}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // User signed in but no activity
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="people-outline" size={64} color={COLORS.textSecondary} />
        <Text style={styles.emptyTitle}>No Activity Yet</Text>
        <Text style={styles.emptyText}>
          Follow some friends to see what they're watching
        </Text>
        <TouchableOpacity
          style={styles.findFriendsButton}
          onPress={() => navigation.navigate('UserSearch')}
        >
          <Ionicons name="person-add-outline" size={20} color={COLORS.text} />
          <Text style={styles.findFriendsButtonText}>Find Friends</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderFooter = () => {
    if (!hasMore || activities.length === 0) return null;

    return (
      <View style={styles.footerContainer}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {loading && activities.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={activities}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={COLORS.primary}
            />
          }
          contentContainerStyle={activities.length === 0 ? styles.emptyList : undefined}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyList: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 8,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  signInButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
    marginTop: 16,
  },
  signInButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  retryButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '500',
  },
  findFriendsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginTop: 16,
    gap: 8,
  },
  findFriendsButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  footerContainer: {
    paddingVertical: 20,
  },
});
