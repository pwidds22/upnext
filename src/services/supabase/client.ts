import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Custom storage adapter using expo-secure-store
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    await SecureStore.deleteItemAsync(key);
  },
};

// Check if Supabase is configured (env vars present and URL is valid).
// Cached at module init — env vars are set at build time and never change at runtime.
const _isConfigured: boolean = (() => {
  if (!supabaseUrl || !supabaseAnonKey) return false;
  try {
    const url = new URL(supabaseUrl);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
})();

export const isSupabaseConfigured = (): boolean => _isConfigured;

// Sentinel error for "not configured" state
const NOT_CONFIGURED_ERROR = { message: 'Supabase is not configured', code: 'NOT_CONFIGURED' };

// Chainable no-op builder for queries when Supabase is not configured.
// Supports arbitrary chaining (e.g., .select().eq().single()) and resolves
// to { data: null, error: NOT_CONFIGURED_ERROR } when awaited.
function createNoOpBuilder(): unknown {
  const result = { data: null, error: NOT_CONFIGURED_ERROR };
  const promise = Promise.resolve(result);

  return new Proxy(promise, {
    get(target, prop) {
      if (prop === 'then' || prop === 'catch' || prop === 'finally') {
        return (target as any)[prop].bind(target);
      }
      // Any chained method returns a new no-op builder
      return () => createNoOpBuilder();
    },
  });
}

// No-op auth object matching Supabase auth interface
const noOpAuth = {
  getSession: () => Promise.resolve({ data: { session: null }, error: NOT_CONFIGURED_ERROR }),
  getUser: () => Promise.resolve({ data: { user: null }, error: NOT_CONFIGURED_ERROR }),
  signUp: () => Promise.resolve({ data: { user: null, session: null }, error: NOT_CONFIGURED_ERROR }),
  signInWithPassword: () => Promise.resolve({ data: { user: null, session: null }, error: NOT_CONFIGURED_ERROR }),
  signInWithOAuth: () => Promise.resolve({ data: { provider: null, url: null }, error: NOT_CONFIGURED_ERROR }),
  signInWithIdToken: () => Promise.resolve({ data: { user: null, session: null }, error: NOT_CONFIGURED_ERROR }),
  signOut: () => Promise.resolve({ error: NOT_CONFIGURED_ERROR }),
  resetPasswordForEmail: () => Promise.resolve({ data: {}, error: NOT_CONFIGURED_ERROR }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
};

// Lazy-initialize the Supabase client to prevent crash when env vars are missing.
// createClient() throws "supabaseUrl is required" if URL/key are empty strings,
// which would crash the app at module evaluation time before React renders.
let _supabaseClient: SupabaseClient | null = null;

function createSupabaseClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    // If not configured, return no-op implementations
    if (!isSupabaseConfigured()) {
      if (prop === 'auth') return noOpAuth;
      if (prop === 'from' || prop === 'rpc') return () => createNoOpBuilder();
      // Return chainable no-op for unknown properties (storage, functions, realtime, etc.)
      return new Proxy({}, { get() { return () => createNoOpBuilder(); } });
    }

    // Lazily create real client on first access
    if (!_supabaseClient) {
      try {
        _supabaseClient = createSupabaseClient();
      } catch (e) {
        console.error('Failed to initialize Supabase client:', e);
        // Fall back to no-op mode so the app doesn't crash
        if (prop === 'auth') return noOpAuth;
        if (prop === 'from' || prop === 'rpc') return () => createNoOpBuilder();
        return new Proxy({}, { get() { return () => createNoOpBuilder(); } });
      }
    }
    return _supabaseClient[prop as keyof SupabaseClient];
  },
});
