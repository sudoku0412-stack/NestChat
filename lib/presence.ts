import { useEffect } from 'react';
import { AppState } from 'react-native';
import { supabase } from './supabase';

// Keeps users.is_online / last_seen_at roughly in sync with app foreground state.
// Lightweight heartbeat rather than a full presence channel — fine at household scale.
export function usePresenceHeartbeat(userId: string | null) {
  useEffect(() => {
    if (!userId) return;

    const setOnline = (online: boolean) => {
      supabase
        .from('users')
        .update({ is_online: online, last_seen_at: new Date().toISOString() })
        .eq('id', userId)
        .then(() => {});
    };

    setOnline(true);

    const sub = AppState.addEventListener('change', (state) => {
      setOnline(state === 'active');
    });

    return () => {
      sub.remove();
      setOnline(false);
    };
  }, [userId]);
}
