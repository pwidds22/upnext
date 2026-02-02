import { useSyncOptional } from '../contexts/SyncContext';

/**
 * Hook for accessing sync state and actions.
 * Returns undefined if SyncProvider is not available.
 */
export function useSync() {
  const context = useSyncOptional();

  // Return undefined if no SyncProvider - caller must handle this
  if (!context) {
    return undefined;
  }

  return {
    // State
    status: context.syncState,
    isOnline: context.isOnline,
    pendingChanges: context.pendingChangesCount,
    lastSynced: context.lastSyncedAt,
    error: context.syncError,

    // Actions
    sync: context.triggerSync,
    fullSync: context.triggerFullSync,

    // Computed helpers
    isSyncing: context.syncState === 'syncing',
    hasError: context.syncState === 'error',
    hasPendingChanges: context.pendingChangesCount > 0,
    needsSync: context.pendingChangesCount > 0 && context.isOnline,
  };
}
