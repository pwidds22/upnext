import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { useFollowersList } from '../hooks/useFollows';
import { useFollowToggle } from '../hooks/useFollowToggle';
import UserRow from '../components/UserRow';
import { COLORS } from '../utils/constants';
import type { RootStackParamList, UserWithFollowStatus } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'Followers'>;

export default function FollowersScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const { userId } = route.params;
  const { user: currentUser } = useAuth();

  const { followers, loading, refresh } = useFollowersList(userId);
  const [refreshing, setRefreshing] = useState(false);
  const { handleFollowToggle, followLoadingIds } = useFollowToggle({
    currentUserId: currentUser?.id,
    onSuccess: refresh,
  });

  const isCurrentUser = currentUser?.id === userId;

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
        <Text style={styles.emptyTitle}>No Followers</Text>
        <Text style={styles.emptyText}>
          {isCurrentUser
            ? "You don't have any followers yet"
            : "This user doesn't have any followers yet"}
        </Text>
      </View>
    );
  };

  if (loading && followers.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={followers}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={followers.length === 0 ? styles.emptyList : undefined}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
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
