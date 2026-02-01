import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useAuth } from './AuthContext';
import { syncService } from '../services/supabase/sync';
import { storageService } from '../services/storage';
import type { SyncState } from '../types';

interface SyncContextType {
  syncState: SyncState;
  isOnline: boolean;
  pendingChangesCount: number;
  lastSyncedAt: string | null;
  syncError: string | null;
  triggerSync: () => Promise<void>;
  triggerFullSync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

const SYNC_POLL_INTERVAL = 5000; // 5 seconds

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [isOnline, setIsOnline] = useState(true);
  const [pendingChangesCount, setPendingChangesCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const wasOfflineRef = useRef(false);
  const initialSyncDoneRef = useRef(false);
  const syncInProgressRef = useRef(false);

  // Load last sync time on mount
  useEffect(() => {
    syncService.getLastSyncTime().then(setLastSyncedAt);
  }, []);

  // Network monitoring
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const nowOnline = state.isConnected === true && state.isInternetReachable !== false;

      // Track if we were offline
      if (!isOnline && nowOnline) {
        wasOfflineRef.current = true;
      }

      setIsOnline(nowOnline);
    });

    return () => unsubscribe();
  }, [isOnline]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (wasOfflineRef.current && isOnline && user && !syncInProgressRef.current) {
      wasOfflineRef.current = false;
      triggerSync();
    }
  }, [isOnline, user]);

  // Initial sync on user sign-in
  useEffect(() => {
    if (user && !initialSyncDoneRef.current && isOnline) {
      initialSyncDoneRef.current = true;
      triggerFullSync();
    }

    // Reset when user signs out
    if (!user) {
      initialSyncDoneRef.current = false;
      setLastSyncedAt(null);
      setSyncError(null);
      setSyncState('idle');
    }
  }, [user, isOnline]);

  // Poll pending changes count
  useEffect(() => {
    const updatePendingCount = async () => {
      try {
        const count = await storageService.getSyncQueueCount();
        setPendingChangesCount(count);
      } catch {
        // Ignore errors
      }
    };

    updatePendingCount();
    const interval = setInterval(updatePendingCount, SYNC_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const triggerSync = useCallback(async () => {
    if (!user || syncInProgressRef.current || !isOnline) return;

    syncInProgressRef.current = true;
    setSyncState('syncing');
    setSyncError(null);

    try {
      const result = await syncService.sync(user.id);

      if (!result.success && result.errors.length > 0) {
        setSyncError(result.errors.join(', '));
        setSyncState('error');
      } else {
        setSyncState('idle');
        setLastSyncedAt(new Date().toISOString());
      }

      // Update pending count
      const count = await storageService.getSyncQueueCount();
      setPendingChangesCount(count);
    } catch (error) {
      setSyncError((error as Error).message);
      setSyncState('error');
    } finally {
      syncInProgressRef.current = false;
    }
  }, [user, isOnline]);

  const triggerFullSync = useCallback(async () => {
    if (!user || syncInProgressRef.current) return;

    syncInProgressRef.current = true;
    setSyncState('syncing');
    setSyncError(null);

    try {
      const result = await syncService.sync(user.id, { fullSync: true });

      if (!result.success && result.errors.length > 0) {
        setSyncError(result.errors.join(', '));
        setSyncState('error');
      } else {
        setSyncState('idle');
        setLastSyncedAt(new Date().toISOString());
      }

      // Update pending count
      const count = await storageService.getSyncQueueCount();
      setPendingChangesCount(count);
    } catch (error) {
      setSyncError((error as Error).message);
      setSyncState('error');
    } finally {
      syncInProgressRef.current = false;
    }
  }, [user]);

  const value = useMemo(
    () => ({
      syncState,
      isOnline,
      pendingChangesCount,
      lastSyncedAt,
      syncError,
      triggerSync,
      triggerFullSync,
    }),
    [syncState, isOnline, pendingChangesCount, lastSyncedAt, syncError, triggerSync, triggerFullSync]
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSyncContext() {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSyncContext must be used within a SyncProvider');
  }
  return context;
}

// Optional version that returns null when outside SyncProvider
// Use this when sync is optional (e.g., hooks that may be used outside the main app)
export function useSyncOptional() {
  return useContext(SyncContext);
}
