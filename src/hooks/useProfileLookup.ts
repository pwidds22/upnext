import { useState, useCallback } from 'react';
import { followsService } from '../services/supabase/follows';

interface ProfileLookupResult {
  email: string;
  profileId: string;
}

/**
 * Hook for looking up a user profile by username and getting their email for sign-in.
 * Wraps the followsService calls with loading and error state management.
 */
export function useProfileLookup() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookupByUsername = useCallback(async (username: string): Promise<ProfileLookupResult | null> => {
    setLoading(true);
    setError(null);
    try {
      const profile = await followsService.getProfileByUsername(username);
      if (!profile) {
        setError('Username not found');
        return null;
      }
      const email = await followsService.getEmailByUserId(profile.id);
      if (!email) {
        setError('Could not find account for this username');
        return null;
      }
      return { email, profileId: profile.id };
    } catch (e) {
      console.error('Failed to look up profile:', e);
      setError(e instanceof Error ? e.message : 'Failed to look up profile');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { lookupByUsername, loading, error, clearError: () => setError(null) };
}
