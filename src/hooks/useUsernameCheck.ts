import { useState, useCallback } from 'react';
import { followsService } from '../services/supabase/follows';

/**
 * Hook for checking username availability.
 * Wraps the followsService call with loading and error state management.
 */
export function useUsernameCheck() {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkAvailability = useCallback(async (username: string): Promise<boolean> => {
    setChecking(true);
    setError(null);
    try {
      return await followsService.isUsernameAvailable(username);
    } catch (e) {
      console.error('Failed to check username availability:', e);
      setError(e instanceof Error ? e.message : 'Failed to check username');
      return false;
    } finally {
      setChecking(false);
    }
  }, []);

  return { checkAvailability, checking, error };
}
