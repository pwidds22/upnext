import { useState, useEffect, useCallback } from 'react';
import { followsService } from '../services/supabase/follows';
import { useAuth } from '../contexts/AuthContext';
import type { ProfileVisibility } from '../types';

export function useProfileVisibility() {
  const { user } = useAuth();
  const [visibility, setVisibility] = useState<ProfileVisibility>({
    shows: true,
    activity: true,
    stats: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    async function loadVisibility() {
      try {
        setLoading(true);
        setError(null);
        const profile = await followsService.getUserProfile(user!.id);
        if (profile?.visibility) {
          setVisibility(profile.visibility);
        }
      } catch (e) {
        console.error('Failed to load visibility settings:', e);
        setError(e instanceof Error ? e.message : 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    }

    loadVisibility();
  }, [user]);

  const updateVisibility = useCallback(
    async (newVisibility: ProfileVisibility) => {
      if (!user) return;

      setSaving(true);
      setError(null);
      try {
        await followsService.updateVisibility(user.id, newVisibility);
        setVisibility(newVisibility);
      } catch (e) {
        console.error('Failed to update visibility:', e);
        setError(e instanceof Error ? e.message : 'Failed to save settings');
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [user]
  );

  return { visibility, loading, saving, error, updateVisibility };
}
