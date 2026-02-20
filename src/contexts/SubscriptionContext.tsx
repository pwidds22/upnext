import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from './AuthContext';
import { subscriptionService } from '../services/subscription';
import type { SubscriptionPlan, SubscriptionPeriodType } from '../types';

interface SubscriptionContextType {
  isPremium: boolean;
  isLoading: boolean;
  plan: SubscriptionPlan | null;
  periodType: SubscriptionPeriodType | null;
  expiresDate: string | null;
  isTrialActive: boolean;
  trialDaysRemaining: number | null;
  restorePurchases: () => Promise<{ success: boolean; error: string | null }>;
  refreshStatus: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [periodType, setPeriodType] = useState<SubscriptionPeriodType | null>(null);
  const [expiresDate, setExpiresDate] = useState<string | null>(null);

  const mountedRef = useRef(true);

  // Derived state
  const isTrialActive = periodType === 'TRIAL' && isPremium;
  const trialDaysRemaining = useMemo(() => {
    if (periodType !== 'TRIAL' || !expiresDate) return null;
    const diff = new Date(expiresDate).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [periodType, expiresDate]);

  // Core status refresh
  const refreshStatus = useCallback(async () => {
    try {
      const status = await subscriptionService.checkPremiumStatus();
      if (!mountedRef.current) return;
      setIsPremium(status.isPremium);
      setPlan(status.plan);
      setPeriodType(status.periodType);
      setExpiresDate(status.expiresDate);
    } catch (e) {
      console.error('Failed to refresh subscription status:', e);
    }
  }, []);

  // Initialize RevenueCat on mount
  useEffect(() => {
    async function init() {
      try {
        await subscriptionService.configure();
        if (mountedRef.current) {
          await refreshStatus();
        }
      } catch (e) {
        console.error('Failed to initialize subscriptions:', e);
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      mountedRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Identify/reset user when auth state changes
  useEffect(() => {
    async function syncUser() {
      if (user) {
        await subscriptionService.identify(user.id);
        await refreshStatus();
      } else {
        await subscriptionService.reset();
        if (mountedRef.current) {
          setIsPremium(false);
          setPlan(null);
          setPeriodType(null);
          setExpiresDate(null);
        }
      }
    }

    syncUser();
  }, [user, refreshStatus]);

  // Listen for customer info updates (purchase, renewal, expiry)
  useEffect(() => {
    let cleanup: (() => void) | null = null;

    async function setupListener() {
      cleanup = await subscriptionService.addCustomerInfoListener(async () => {
        await refreshStatus();
      });
    }

    setupListener();

    return () => {
      if (cleanup) cleanup();
    };
  }, [refreshStatus]);

  // Refresh status when app comes to foreground
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        refreshStatus();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, [refreshStatus]);

  // Restore purchases
  const restorePurchases = useCallback(async () => {
    try {
      await subscriptionService.restorePurchases();
      await refreshStatus();
      return { success: true, error: null };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to restore purchases';
      return { success: false, error: message };
    }
  }, [refreshStatus]);

  const value = useMemo(
    () => ({
      isPremium,
      isLoading,
      plan,
      periodType,
      expiresDate,
      isTrialActive,
      trialDaysRemaining,
      restorePurchases,
      refreshStatus,
    }),
    [isPremium, isLoading, plan, periodType, expiresDate, isTrialActive, trialDaysRemaining, restorePurchases, refreshStatus]
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
