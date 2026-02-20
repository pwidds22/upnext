import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CachedPremiumStatus, SubscriptionPlan, SubscriptionPeriodType } from '../types';

// Lazy-load Purchases to avoid top-level SDK initialization crash
// (same pattern as supabase/client.ts — DON'T call SDK initializers at module top-level)
let _purchasesModule: typeof import('react-native-purchases') | null = null;
let _isConfigured = false;

const PREMIUM_CACHE_KEY = '@upnext_premium_status';
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

async function getPurchasesClass() {
  if (!_purchasesModule) {
    _purchasesModule = await import('react-native-purchases');
  }
  return _purchasesModule.default; // Purchases is the default export
}

export const subscriptionService = {
  /**
   * Initialize RevenueCat SDK. Call once during app startup.
   * Must NOT be called at module top-level.
   */
  async configure(): Promise<void> {
    if (_isConfigured) return;

    const appleKey = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY || '';
    const googleKey = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY || '';

    const apiKey = Platform.OS === 'ios' ? appleKey : googleKey;
    if (!apiKey) {
      console.warn('RevenueCat API key not configured — subscriptions disabled');
      return;
    }

    try {
      const Purchases = await getPurchasesClass();

      if (__DEV__) {
        const { LOG_LEVEL } = await import('react-native-purchases');
        Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
      }

      Purchases.configure({ apiKey });
      _isConfigured = true;
    } catch (e) {
      console.error('Failed to initialize RevenueCat:', e);
    }
  },

  /** Whether RevenueCat is configured and ready */
  isConfigured(): boolean {
    return _isConfigured;
  },

  /**
   * Identify user with RevenueCat (call on sign-in).
   * Links RevenueCat anonymous ID with Supabase user ID.
   */
  async identify(userId: string): Promise<void> {
    if (!_isConfigured) return;
    try {
      const Purchases = await getPurchasesClass();
      await Purchases.logIn(userId);
    } catch (e) {
      console.error('Failed to identify user with RevenueCat:', e);
    }
  },

  /**
   * Reset RevenueCat user (call on sign-out).
   * Returns to anonymous user.
   */
  async reset(): Promise<void> {
    if (!_isConfigured) return;
    try {
      const Purchases = await getPurchasesClass();
      await Purchases.logOut();
    } catch (e) {
      console.error('Failed to reset RevenueCat user:', e);
    }
    await this.clearCache();
  },

  /**
   * Check if user has active premium entitlement.
   * Falls back to cached status if RevenueCat is unreachable.
   */
  async checkPremiumStatus(): Promise<{
    isPremium: boolean;
    plan: SubscriptionPlan | null;
    periodType: SubscriptionPeriodType | null;
    expiresDate: string | null;
  }> {
    const defaultStatus = {
      isPremium: false,
      plan: null as SubscriptionPlan | null,
      periodType: null as SubscriptionPeriodType | null,
      expiresDate: null as string | null,
    };

    if (!_isConfigured) {
      const cached = await this.getCachedStatus();
      if (cached) {
        return {
          isPremium: cached.isPremium,
          plan: cached.plan,
          periodType: null,
          expiresDate: cached.expiresDate,
        };
      }
      return defaultStatus;
    }

    try {
      const Purchases = await getPurchasesClass();
      const customerInfo = await Purchases.getCustomerInfo();
      const entitlement = customerInfo.entitlements.active['premium'];

      if (entitlement) {
        const plan = identifyPlan(entitlement.productIdentifier);
        const periodType = mapPeriodType(entitlement.periodType);
        const result = {
          isPremium: true,
          plan,
          periodType,
          expiresDate: entitlement.expirationDate || null,
        };

        await this.cacheStatus({
          isPremium: true,
          plan,
          expiresDate: result.expiresDate,
          checkedAt: new Date().toISOString(),
        });

        return result;
      }

      // Not premium — cache that too
      await this.cacheStatus({
        isPremium: false,
        plan: null,
        expiresDate: null,
        checkedAt: new Date().toISOString(),
      });
      return defaultStatus;
    } catch (e) {
      console.error('Failed to check premium status:', e);
      const cached = await this.getCachedStatus();
      if (cached) {
        return {
          isPremium: cached.isPremium,
          plan: cached.plan,
          periodType: null,
          expiresDate: cached.expiresDate,
        };
      }
      return defaultStatus;
    }
  },

  /**
   * Get available offerings (products/prices).
   * Used by the Paywall screen (Phase 4).
   */
  async getOfferings() {
    if (!_isConfigured) return null;
    try {
      const Purchases = await getPurchasesClass();
      return await Purchases.getOfferings();
    } catch (e) {
      console.error('Failed to get offerings:', e);
      return null;
    }
  },

  /**
   * Purchase a package. Returns updated customer info.
   * Used by the Paywall screen (Phase 4).
   */
  async purchasePackage(pkg: import('react-native-purchases').PurchasesPackage) {
    if (!_isConfigured) throw new Error('RevenueCat not configured');
    const Purchases = await getPurchasesClass();
    return await Purchases.purchasePackage(pkg);
  },

  /**
   * Restore purchases (e.g., after reinstall or device switch).
   */
  async restorePurchases() {
    if (!_isConfigured) throw new Error('RevenueCat not configured');
    const Purchases = await getPurchasesClass();
    return await Purchases.restorePurchases();
  },

  /**
   * Listen for customer info changes (purchase, renewal, expiry).
   * Returns a cleanup function to remove the listener.
   */
  async addCustomerInfoListener(
    listener: (info: import('react-native-purchases').CustomerInfo) => void
  ): Promise<() => void> {
    if (!_isConfigured) return () => {};
    const Purchases = await getPurchasesClass();
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      // RevenueCat SDK doesn't expose removeListener in RN,
      // but the listener is cleaned up when the SDK is reconfigured or the app restarts.
      // For our purposes, returning a no-op is safe since we only have one listener.
    };
  },

  // --- Cache helpers ---

  async cacheStatus(status: CachedPremiumStatus): Promise<void> {
    try {
      await AsyncStorage.setItem(PREMIUM_CACHE_KEY, JSON.stringify(status));
    } catch {
      // Ignore cache write errors
    }
  },

  async getCachedStatus(): Promise<CachedPremiumStatus | null> {
    try {
      const raw = await AsyncStorage.getItem(PREMIUM_CACHE_KEY);
      if (!raw) return null;
      const cached: CachedPremiumStatus = JSON.parse(raw);
      const age = Date.now() - new Date(cached.checkedAt).getTime();
      if (age > CACHE_MAX_AGE_MS) return null;
      return cached;
    } catch {
      return null;
    }
  },

  async clearCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(PREMIUM_CACHE_KEY);
    } catch {
      // Ignore
    }
  },
};

// --- Pure helpers (not on the service object to avoid `this` confusion) ---

function identifyPlan(productId: string): SubscriptionPlan {
  if (productId.includes('lifetime')) return 'lifetime';
  if (productId.includes('annual') || productId.includes('yearly')) return 'annual';
  return 'monthly';
}

function mapPeriodType(rcPeriodType: string): SubscriptionPeriodType {
  const upper = rcPeriodType.toUpperCase();
  if (upper === 'TRIAL') return 'TRIAL';
  if (upper === 'INTRO') return 'INTRO';
  return 'NORMAL';
}
