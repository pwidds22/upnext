import { useState, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { followsService } from '../services/supabase/follows';
import { UserWithFollowStatus } from '../types';

interface UseFollowToggleOptions {
  currentUserId: string | undefined;
  onSuccess?: () => void;
}

/**
 * Hook for managing follow/unfollow toggle logic with loading state and haptics.
 * Eliminates duplication across FollowersScreen, FollowingScreen, and UserSearchScreen.
 */
export function useFollowToggle({ currentUserId, onSuccess }: UseFollowToggleOptions) {
  const [followLoadingIds, setFollowLoadingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const handleFollowToggle = useCallback(
    async (targetUser: UserWithFollowStatus) => {
      if (!currentUserId) return;

      setError(null);
      setFollowLoadingIds((prev) => new Set([...prev, targetUser.id]));

      try {
        if (targetUser.isFollowing) {
          await followsService.unfollow(currentUserId, targetUser.id);
        } else {
          await followsService.follow(currentUserId, targetUser.id);
        }
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSuccess?.();
      } catch (e) {
        console.error('Failed to toggle follow:', e);
        setError(e instanceof Error ? e.message : 'Failed to update follow');
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        setFollowLoadingIds((prev) => {
          const next = new Set(prev);
          next.delete(targetUser.id);
          return next;
        });
      }
    },
    [currentUserId, onSuccess]
  );

  const isFollowLoading = useCallback(
    (userId: string) => followLoadingIds.has(userId),
    [followLoadingIds]
  );

  return {
    handleFollowToggle,
    followLoadingIds,
    isFollowLoading,
    error,
  };
}
