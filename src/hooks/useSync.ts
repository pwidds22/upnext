import { useSyncContext } from '../contexts/SyncContext';

export function useSync() {
  const context = useSyncContext();

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
