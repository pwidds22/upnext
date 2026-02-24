import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { authService } from '../services/supabase/auth';
import { isSupabaseConfigured } from '../services/supabase/client';
import { syncService } from '../services/supabase/sync';
import { storageService } from '../services/storage';
import { followsService } from '../services/supabase/follows';
import type { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, username?: string) => Promise<{ error: string | null }>;
  signInWithApple: () => Promise<{ error: string | null }>;
  signInWithGoogleToken: (idToken: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  refreshProfile: (userId?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isConfigured = isSupabaseConfigured();

  const refreshProfile = useCallback(async (userId?: string) => {
    const id = userId || user?.id;
    if (!id) return;
    try {
      const data = await followsService.getUserProfile(id);
      setProfile(data);
    } catch (e) {
      console.error('Failed to refresh profile:', e);
    }
  }, [user]);

  // Load profile when user changes
  useEffect(() => {
    if (user) {
      refreshProfile();
    } else {
      setProfile(null);
    }
  }, [user, refreshProfile]);

  useEffect(() => {
    if (!isConfigured) {
      setIsLoading(false);
      return;
    }

    // Get initial session
    authService.getSession().then((session) => {
      setSession(session);
      setUser(session?.user ?? null);
    }).catch(async (e) => {
      console.warn('Failed to get session:', e);
      // Clear stale session (e.g. expired/revoked refresh token)
      try {
        await authService.signOut();
      } catch { /* ignore signOut errors during cleanup */ }
      // Clear orphaned local data from the previous session
      try {
        await storageService.clearAllData();
      } catch { /* ignore storage errors during cleanup */ }
      setSession(null);
      setUser(null);
    }).finally(() => {
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = authService.onAuthStateChange((user, session) => {
      setUser(user);
      setSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isConfigured]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await authService.signIn(email, password);
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(async (email: string, password: string, username?: string) => {
    const { user: newUser, error } = await authService.signUp(email, password, username);
    if (!error && newUser) {
      // Refresh profile after signUp completes — the automatic refresh from
      // onAuthStateChange races with the profile update and loads stale data
      await refreshProfile(newUser.id);
    }
    return { error: error?.message ?? null };
  }, [refreshProfile]);

  const signInWithApple = useCallback(async () => {
    const { error } = await authService.signInWithApple();
    return { error: error?.message ?? null };
  }, []);

  const signInWithGoogleToken = useCallback(async (idToken: string) => {
    const { error } = await authService.signInWithGoogleToken(idToken);
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    // Flush pending sync queue before clearing local data
    if (user) {
      try {
        await syncService.pushChanges(user.id);
      } catch (e) {
        console.warn('Failed to flush sync queue on sign-out:', e);
      }
    }
    await authService.signOut();
    setProfile(null);
    // Clear local data to prevent data bleeding between accounts
    await storageService.clearAllData();
  }, [user]);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await authService.resetPassword(email);
    return { error: error?.message ?? null };
  }, []);

  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      isLoading,
      isConfigured,
      signIn,
      signUp,
      signInWithApple,
      signInWithGoogleToken,
      signOut,
      resetPassword,
      refreshProfile,
    }),
    [user, session, profile, isLoading, isConfigured, signIn, signUp, signInWithApple, signInWithGoogleToken, signOut, resetPassword, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
