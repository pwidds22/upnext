import { supabase } from './client';
import type { User, Session, AuthError } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

// Google OAuth client IDs - these need to be configured in Google Cloud Console
// and added as environment variables
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
export const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';
export const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '';

export interface AuthResult {
  user: User | null;
  session: Session | null;
  error: AuthError | null;
}

export const authService = {
  // Get current session
  async getSession(): Promise<Session | null> {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  // Get current user
  async getUser(): Promise<User | null> {
    const { data } = await supabase.auth.getUser();
    return data.user;
  },

  // Sign up with email and password (optionally with username)
  async signUp(email: string, password: string, username?: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    // If signup successful and username provided, update the profile
    if (!error && data.user && username) {
      // Small delay to ensure profile trigger has completed
      await new Promise((resolve) => setTimeout(resolve, 500));

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          username: username.toLowerCase(),
          display_name: username,
        })
        .eq('id', data.user.id);

      if (profileError) {
        console.error('Failed to update profile with username:', profileError);
      }
    }

    return {
      user: data.user,
      session: data.session,
      error,
    };
  },

  // Sign in with email and password
  async signIn(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return {
      user: data.user,
      session: data.session,
      error,
    };
  },

  // Sign in with Apple (iOS only)
  async signInWithApple(): Promise<AuthResult> {
    if (Platform.OS !== 'ios') {
      return {
        user: null,
        session: null,
        error: { message: 'Apple Sign-In is only available on iOS', status: 400 } as AuthError,
      };
    }

    try {
      // Check if Apple Sign-In is available on this device
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        return {
          user: null,
          session: null,
          error: { message: 'Apple Sign-In is not available on this device', status: 400 } as AuthError,
        };
      }

      // Generate a secure nonce for the request
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );

      // Request credentials from Apple
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) {
        return {
          user: null,
          session: null,
          error: { message: 'No identity token received from Apple', status: 400 } as AuthError,
        };
      }

      // Exchange Apple credential for Supabase session
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce,
      });

      // If successful and we have name info, update the profile
      if (!error && data.user && credential.fullName) {
        const displayName = [credential.fullName.givenName, credential.fullName.familyName]
          .filter(Boolean)
          .join(' ');

        if (displayName) {
          // Small delay to ensure profile trigger has completed
          await new Promise((resolve) => setTimeout(resolve, 500));

          await supabase
            .from('profiles')
            .update({ display_name: displayName })
            .eq('id', data.user.id);
        }
      }

      return {
        user: data.user,
        session: data.session,
        error,
      };
    } catch (e) {
      // Handle user cancellation
      if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') {
        return {
          user: null,
          session: null,
          error: null, // User cancelled, not an error
        };
      }

      return {
        user: null,
        session: null,
        error: { message: e instanceof Error ? e.message : 'Apple Sign-In failed', status: 500 } as AuthError,
      };
    }
  },

  // Exchange Google ID token for Supabase session
  // Called after Google OAuth flow completes in the component
  async signInWithGoogleToken(idToken: string): Promise<AuthResult> {
    try {
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      return {
        user: data.user,
        session: data.session,
        error,
      };
    } catch (e) {
      return {
        user: null,
        session: null,
        error: { message: e instanceof Error ? e.message : 'Google Sign-In failed', status: 500 } as AuthError,
      };
    }
  },

  // Delete account permanently — calls a SECURITY DEFINER DB function
  // that deletes from auth.users, cascading to all user data
  async deleteAccount(): Promise<{ error: string | null }> {
    const { error } = await supabase.rpc('delete_user_account');
    if (error) {
      return { error: error.message };
    }
    // Sign out locally to clear session
    await supabase.auth.signOut();
    return { error: null };
  },

  // Sign out
  async signOut(): Promise<{ error: AuthError | null }> {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  // Send password reset email
  async resetPassword(email: string): Promise<{ error: AuthError | null }> {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error };
  },

  // Listen to auth state changes
  onAuthStateChange(callback: (user: User | null, session: Session | null) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(session?.user ?? null, session);
    });
  },
};
