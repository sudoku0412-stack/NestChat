import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { UsersRow } from './database.types';

interface AuthContextValue {
  session: Session | null;
  profile: UsersRow | null;
  loading: boolean;
  needsOnboarding: boolean;
  continueWithPhone: (phone: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UsersRow | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    const { data } = await supabase.from('users').select('*').eq('id', userId).single();
    setProfile((data as UsersRow) ?? null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) {
        loadProfile(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next) {
        loadProfile(next.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      needsOnboarding: !!profile && !profile.onboarding_completed,
      // No OTP: signs in anonymously (free, instant, no SMS provider), then stamps
      // the typed-in phone number onto the resulting profile. Unverified — see the
      // tradeoff noted in supabase/migrations/0001_init.sql.
      async continueWithPhone(phone: string) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) return error.message;
        if (!data.user) return 'Could not start a session. Try again.';

        const { error: updateError } = await supabase
          .from('users')
          .update({ phone })
          .eq('id', data.user.id);
        if (updateError) {
          return updateError.code === '23505'
            ? 'That phone number is already registered to another account.'
            : updateError.message;
        }

        setSession(data.session);
        await loadProfile(data.user.id);
        return null;
      },
      async signOut() {
        await supabase.auth.signOut();
      },
      async refreshProfile() {
        if (session) await loadProfile(session.user.id);
      },
    }),
    [session, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
