import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { metadataRefreshService, RefreshResult } from '../services/metadataRefresh';

interface MetadataRefreshContextType {
  isRefreshing: boolean;
  refreshKey: number;
  forceRefresh: () => Promise<void>;
}

const MetadataRefreshContext = createContext<MetadataRefreshContextType>({
  isRefreshing: false,
  refreshKey: 0,
  forceRefresh: async () => {},
});

export function MetadataRefreshProvider({ children }: { children: React.ReactNode }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const appStateRef = useRef(AppState.currentState);

  // Listen for refresh completion
  useEffect(() => {
    const unsubscribe = metadataRefreshService.onComplete((result: RefreshResult) => {
      setIsRefreshing(false);
      if (result.showsRefreshed > 0 || result.moviesRefreshed > 0) {
        setRefreshKey(k => k + 1);
      }
    });
    return unsubscribe;
  }, []);

  // Foreground detection + initial check on mount
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        setIsRefreshing(true);
        metadataRefreshService.refreshIfStale().then(result => {
          if (result === null) setIsRefreshing(false);
        }).catch(() => setIsRefreshing(false));
      }
      appStateRef.current = nextState;
    });

    // Initial check on app open
    setIsRefreshing(true);
    metadataRefreshService.refreshIfStale().then(result => {
      if (result === null) setIsRefreshing(false);
    }).catch(() => setIsRefreshing(false));

    return () => subscription.remove();
  }, []);

  const forceRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await metadataRefreshService.refreshAll();
    } catch {
      setIsRefreshing(false);
    }
  }, []);

  const value = useMemo(() => ({
    isRefreshing,
    refreshKey,
    forceRefresh,
  }), [isRefreshing, refreshKey, forceRefresh]);

  return (
    <MetadataRefreshContext.Provider value={value}>
      {children}
    </MetadataRefreshContext.Provider>
  );
}

export function useMetadataRefresh() {
  return useContext(MetadataRefreshContext);
}
