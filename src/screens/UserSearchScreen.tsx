import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../contexts/AuthContext';
import { useUserSearch } from '../hooks/useFollows';
import { followsService } from '../services/supabase/follows';
import UserRow from '../components/UserRow';
import { COLORS, SEARCH_DEBOUNCE_MS } from '../utils/constants';
import type { RootStackParamList, UserWithFollowStatus } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function UserSearchScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const { results, loading, error, search, clear } = useUserSearch();
  const [query, setQuery] = useState('');
  const [followLoadingIds, setFollowLoadingIds] = useState<Set<string>>(new Set());

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      clear();
      return;
    }

    const timer = setTimeout(() => {
      search(query);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, search, clear]);

  const handleFollowToggle = useCallback(
    async (targetUser: UserWithFollowStatus) => {
      if (!user) return;

      setFollowLoadingIds((prev) => new Set([...prev, targetUser.id]));

      try {
        if (targetUser.isFollowing) {
          await followsService.unfollow(user.id, targetUser.id);
        } else {
          await followsService.follow(user.id, targetUser.id);
        }
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        // Refresh search results to update follow status
        search(query);
      } catch (e) {
        console.error('Failed to toggle follow:', e);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        setFollowLoadingIds((prev) => {
          const next = new Set(prev);
          next.delete(targetUser.id);
          return next;
        });
      }
    },
    [user, query, search]
  );

  const handleUserPress = useCallback(
    (userId: string) => {
      navigation.navigate('UserProfile', { userId });
    },
    [navigation]
  );

  const renderItem = useCallback(
    ({ item }: { item: UserWithFollowStatus }) => (
      <UserRow
        user={item}
        onPress={() => handleUserPress(item.id)}
        onFollowPress={() => handleFollowToggle(item)}
        showFollowButton
        followLoading={followLoadingIds.has(item.id)}
      />
    ),
    [handleUserPress, handleFollowToggle, followLoadingIds]
  );

  const renderEmpty = () => {
    if (loading) return null;

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
          <Text style={styles.emptyTitle}>Search Error</Text>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      );
    }

    if (query && results.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={48} color={COLORS.textSecondary} />
          <Text style={styles.emptyTitle}>No Users Found</Text>
          <Text style={styles.emptyText}>No users found for "{query}"</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="people-outline" size={48} color={COLORS.textSecondary} />
        <Text style={styles.emptyTitle}>Find People</Text>
        <Text style={styles.emptyText}>Search for friends by username or name</Text>
      </View>
    );
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="log-in-outline" size={48} color={COLORS.textSecondary} />
          <Text style={styles.emptyTitle}>Sign In Required</Text>
          <Text style={styles.emptyText}>Sign in to find and follow people</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by username or name..."
          placeholderTextColor={COLORS.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Loading */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      )}

      {/* Results */}
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={results.length === 0 ? styles.emptyList : undefined}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
  },
  loadingContainer: {
    padding: 20,
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
