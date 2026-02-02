import { useState, useEffect, useCallback } from 'react';
import { EpisodeReaction, EpisodeReactionType } from '../types';
import { storageService } from '../services/storage';
import { useSync } from './useSync';

export function useEpisodeReactions(showTmdbId: number) {
  const [reactions, setReactions] = useState<Map<string, EpisodeReactionType>>(new Map());
  const [loading, setLoading] = useState(true);

  // Sync integration - useSync returns undefined if SyncProvider is not available
  const syncContext = useSync();
  const sync = syncContext?.sync;
  const isOnline = syncContext?.isOnline ?? true;

  const loadReactions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await storageService.getReactionsForShow(showTmdbId);
      const map = new Map(
        data.map((r) => [`${r.seasonNumber}-${r.episodeNumber}`, r.reaction])
      );
      setReactions(map);
    } catch (e) {
      console.error('Failed to load episode reactions:', e);
    } finally {
      setLoading(false);
    }
  }, [showTmdbId]);

  useEffect(() => {
    loadReactions();
  }, [loadReactions]);

  const triggerSyncIfOnline = useCallback(() => {
    if (sync && isOnline) {
      sync().catch(console.error);
    }
  }, [sync, isOnline]);

  // Get reaction for a specific episode
  const getReaction = useCallback(
    (seasonNumber: number, episodeNumber: number): EpisodeReactionType | null => {
      return reactions.get(`${seasonNumber}-${episodeNumber}`) ?? null;
    },
    [reactions]
  );

  // Set reaction for an episode
  const setReaction = useCallback(
    async (seasonNumber: number, episodeNumber: number, reaction: EpisodeReactionType) => {
      await storageService.setReaction(showTmdbId, seasonNumber, episodeNumber, reaction);
      setReactions((prev) => {
        const next = new Map(prev);
        next.set(`${seasonNumber}-${episodeNumber}`, reaction);
        return next;
      });
      triggerSyncIfOnline();
    },
    [showTmdbId, triggerSyncIfOnline]
  );

  // Remove reaction for an episode
  const removeReaction = useCallback(
    async (seasonNumber: number, episodeNumber: number) => {
      await storageService.removeReaction(showTmdbId, seasonNumber, episodeNumber);
      setReactions((prev) => {
        const next = new Map(prev);
        next.delete(`${seasonNumber}-${episodeNumber}`);
        return next;
      });
      triggerSyncIfOnline();
    },
    [showTmdbId, triggerSyncIfOnline]
  );

  // Toggle reaction: tap same reaction to remove, tap different to change
  const toggleReaction = useCallback(
    async (seasonNumber: number, episodeNumber: number, reaction: EpisodeReactionType) => {
      const current = getReaction(seasonNumber, episodeNumber);
      if (current === reaction) {
        await removeReaction(seasonNumber, episodeNumber);
      } else {
        await setReaction(seasonNumber, episodeNumber, reaction);
      }
    },
    [getReaction, setReaction, removeReaction]
  );

  return {
    reactions,
    loading,
    refresh: loadReactions,
    getReaction,
    setReaction,
    removeReaction,
    toggleReaction,
  };
}
