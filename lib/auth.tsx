import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { clearCryptoState, initializeCrypto } from './crypto';
import type { UsersRow } from './database.types';

export type PhoneStatus = { exists: boolean; hasPin: boolean };

interface AuthContextValue {
  session: Session | null;
  profile: UsersRow | null;
  loading: boolean;
  needsOnboarding: boolean;
  /** Pure lookup, no session created — reports whether `phone` already belongs to an account and whether that account has a recovery PIN. */
  checkPhone: (phone: string) => Promise<PhoneStatus | { error: string }>;
  /** Brand-new signup: creates a session only now, then claims `phone` + sets a recovery PIN on it. */
  claimPhone: (phone: string, pin: string) => Promise<string | null>;
  /**
   * Recovery: verifies `pin` against the account that owns `phone` *before* touching auth at
   * all. Only once verified does it create a session and migrate that account's data onto it.
   * If the matched account never had a PIN set (pre-feature, or an abandoned signup), any PIN is
   * accepted and becomes the account's new one. Returns null on success, an error message
   * otherwise.
   */
  recoverAccount: (phone: string, pin: string) => Promise<string | null>;
  /** Sets/changes the current user's own recovery PIN (e.g. from Settings). */
  setPin: (pin: string) => Promise<string | null>;
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
    // The session's user row doesn't exist (merged away by account recovery, removed by an
    // admin from a different device) or is tombstoned (deleted_at set -- the row is scrubbed
    // in place, not dropped, so removal/self-deletion never makes `data` itself go away) — it
    // will never load as a real account again. Clear the dead session locally instead of
    // leaving the app stuck on (or silently continuing with) a session with no live profile.
    if (!data || (data as UsersRow).deleted_at) {
      await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
      return;
    }
    setProfile(data as UsersRow);

    // Idempotent -- ensures a device identity key exists and is published on every profile load
    // (initial launch, claim, recovery, manual refresh), not just once at onboarding. This is
    // also what re-publishes a *new* public key after a reinstall (recoverAccount restores the
    // account's rows via its own RPC, but the local Keychain is gone, so ensureIdentityKeyPair
    // generates a fresh one here) -- co-members' apps detect the changed key and rewrap chat keys
    // for it, which is this app's "social recovery" mechanism instead of a server-held backup.
    initializeCrypto(data.id).catch((err) => console.warn('initializeCrypto failed', err));
  }

  // Only called right before actually claiming/recovering a phone — never just to look one up —
  // so mistyped numbers or wrong PINs never leave an empty "New Member" row behind.
  async function ensureSession(): Promise<{ userId: string } | { error: string }> {
    if (session) return { userId: session.user.id };
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) return { error: error.message };
    if (!data.session) return { error: 'Could not start a session. Try again.' };
    setSession(data.session);
    await loadProfile(data.session.user.id);
    return { userId: data.session.user.id };
  }

  // Safety net for the rare case a session got created but claim/recover then failed (e.g. a
  // network drop, or a phone-number race with another device) — leaves zero trace either way.
  async function cleanupFailedAttempt() {
    await supabase.rpc('delete_self');
    await clearCryptoState();
    await supabase.auth.signOut();
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
      // No OTP: signs in anonymously (free, instant, no SMS provider). Since that
      // mints a brand-new auth.uid() with no credential to log back in with, a
      // PIN tied to the phone number is what lets a later login (after sign-out
      // or reinstall) recover the old identity instead of starting over — see
      // supabase/migrations/0006_pin_recovery.sql.
      async checkPhone(phone: string) {
        const { data, error } = await supabase.rpc('check_phone_status', { p_phone: phone });
        if (error) return { error: error.message };
        return { exists: !!data.exists, hasPin: !!data.has_pin };
      },
      async claimPhone(phone: string, pin: string) {
        const ensured = await ensureSession();
        if ('error' in ensured) return ensured.error;

        const { error } = await supabase.rpc('claim_phone', { p_phone: phone, p_pin: pin });
        if (error) {
          await cleanupFailedAttempt();
          return error.code === '23505'
            ? 'That phone number is already registered to another account.'
            : error.message;
        }
        await loadProfile(ensured.userId);
        return null;
      },
      async recoverAccount(phone: string, pin: string) {
        const { data: verified, error: verifyError } = await supabase.rpc('verify_recovery_pin', {
          p_phone: phone,
          p_pin: pin,
        });
        if (verifyError) return verifyError.message;
        if (!verified) return 'Incorrect PIN.';

        const ensured = await ensureSession();
        if ('error' in ensured) return ensured.error;

        const { data, error } = await supabase.rpc('recover_account', {
          p_phone: phone,
          p_pin: pin,
        });
        if (error || !data) {
          await cleanupFailedAttempt();
          return error ? error.message : 'Incorrect PIN.';
        }
        await loadProfile(ensured.userId);
        return null;
      },
      async setPin(pin: string) {
        const { error } = await supabase.rpc('set_pin', { p_pin: pin });
        if (error) return error.message;
        if (session) await loadProfile(session.user.id);
        return null;
      },
      async signOut() {
        await clearCryptoState();
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
