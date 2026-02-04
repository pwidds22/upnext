import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { useFollowersList, useFollowingList } from '../hooks/useFollows';
import { useFollowToggle } from '../hooks/useFollowToggle';
import UserRow from '../components/UserRow';
import { COLORS } from '../utils/constants';
import type { RootStackParamList, UserWithFollowStatus } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type FollowersRouteProp = RouteProp<RootStackParamList, 'Followers'>;
type FollowingRouteProp = RouteProp<RootStackParamList, 'Following'>;

const EMPTY_TEXT = {
  followers: {
    title: 'No Followers',
    self: "You don't have any followers yet",
    other: "This user doesn't have any followers yet",
  },
  following: {
    title: 'Not Following Anyone',
    self: "You aren't following anyone yet",
    other: "This user isn't following anyone yet",
  },
};

export default function UserListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<FollowersRouteProp | FollowingRouteProp>();
  const { userId } = route.params;
  const { user: currentUser } = useAuth();

  const isFollowersMode = route.name === 'Followers';
  const followersList = useFollowersList(userId, isFollowersMode);
  const followingList = useFollowingList(userId, !isFollowersMode);
  const { followers, loading: followersLoading, refresh: refreshFollowers } = followersList;
  const { following, loading: followingLoading, refresh: refreshFollowing } = followingList;

  const users = isFollowersMode ? followers : following;
  const loading = isFollowersMode ? followersLoading : followingLoading;
  const refresh = isFollowersMode ? refreshFollowers : refreshFollowing;

  const [refreshing, setRefreshing] = useState(false);
  const { handleFollowToggle, followLoadingIds, error: followError } = useFollowToggle({
    currentUserId: currentUser?.id,
    onSuccess: refresh,
  });

  useEffect(() => {
    if (followError) {
      Alert.alert('Follow Error', followError);
    }
  }, [followError]);

  const isCurrentUser = currentUser?.id === userId;
  const emptyText = isFollowersMode ? EMPTY_TEXT.followers : EMPTY_TEXT.following;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleUserPress = useCallback(
    (targetUserId: string) => {
      navigation.push('UserProfile', { userId: targetUserId });
    },
    [navigation]
  );

  const renderItem = useCallback(
    ({ item }: { item: UserWithFollowStatus }) => (
      <UserRow
        user={item}
        onPress={() => handleUserPress(item.id)}
        onFollowPress={() => handleFollowToggle(item)}
        showFollowButton={!!currentUser}
        isCurrentUser={item.id === currentUser?.id}
        followLoading={followLoadingIds.has(item.id)}
      />
    ),
    [handleUserPress, handleFollowToggle, currentUser, followLoadingIds]
  );

  const renderEmpty = () => {
    if (loading) return null;

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="people-outline" size={48} color={COLORS.textSecondary} />
        <Text style={styles.emptyTitle}>{emptyText.title}</Text>
        <Text style={styles.emptyText}>
          {isCurrentUser ? emptyText.self : emptyText.other}
        </Text>
      </View>
    );
  };

  if (loading && users.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={users.length === 0 ? styles.emptyList : undefined}
        ItemSeparatorComponent={ItemSeparator}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
          />
        }
      />
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
    backgroundColor: COLORS.background,
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
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 16,
  },
});

const ItemSeparator = () => <View style={styles.separator} />;
