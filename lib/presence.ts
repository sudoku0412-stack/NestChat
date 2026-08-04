import { useEffect } from 'react';
import { AppState } from 'react-native';
import { supabase } from './supabase';

// Keeps users.is_online / last_seen_at roughly in sync with app foreground state.
// Lightweight heartbeat rather than a full presence channel — fine at household scale.
//
// `shareEnabled` is the user's own "Read receipts & online status" setting — when it's off we
// stop broadcasting presence entirely (and clear any stale is_online left over from before it
// was turned off), rather than writing it and just hiding it in the UI. Display-side mutual
// gating (app/(app)/chat/[id].tsx, contact-info/[id].tsx) still applies on top of this.
export function usePresenceHeartbeat(userId: string | null, shareEnabled: boolean) {
  useEffect(() => {
    if (!userId) return;

    if (!shareEnabled) {
      supabase.from('users').update({ is_online: false }).eq('id', userId).then(() => {});
      return;
    }

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
  }, [userId, shareEnabled]);
}
