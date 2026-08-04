import { act, renderHook } from '@testing-library/react-native';
import { chainable } from './testUtils/chain';

jest.mock('./supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signInAnonymously: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

import { supabase } from './supabase';
import { AuthProvider, useAuth } from './auth';

function mockNoSession() {
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null } });
  (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
    data: { subscription: { unsubscribe: jest.fn() } },
  });
}

function mockProfile(profile: Record<string, unknown>) {
  (supabase.from as jest.Mock).mockImplementation(() => chainable({ data: profile, error: null }));
}

function mockSignIn(uid: string) {
  (supabase.auth.signInAnonymously as jest.Mock).mockResolvedValue({
    data: { user: { id: uid }, session: { user: { id: uid } } },
    error: null,
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  mockNoSession();
});

async function flush() {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe('checkPhone', () => {
  it('never creates a session — just reports phone status via RPC', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: { exists: true, has_pin: true },
      error: null,
    });

    const { result } = await renderHook(() => useAuth(), { wrapper: AuthProvider });
    await flush();

    const status = await result.current.checkPhone('+15551234567');

    expect(supabase.auth.signInAnonymously).not.toHaveBeenCalled();
    expect(supabase.rpc).toHaveBeenCalledWith('check_phone_status', { p_phone: '+15551234567' });
    expect(status).toEqual({ exists: true, hasPin: true });
  });
});

describe('recoverAccount', () => {
  it('never creates a session when the PIN is wrong', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: false, error: null });

    const { result } = await renderHook(() => useAuth(), { wrapper: AuthProvider });
    await flush();

    const message = await result.current.recoverAccount('+15551234567', '9999');

    expect(supabase.rpc).toHaveBeenCalledWith('verify_recovery_pin', {
      p_phone: '+15551234567',
      p_pin: '9999',
    });
    expect(supabase.auth.signInAnonymously).not.toHaveBeenCalled();
    expect(message).toBe('Incorrect PIN.');
  });

  it('creates a session and migrates data once the PIN verifies', async () => {
    mockSignIn('new-uid');
    mockProfile({ id: 'new-uid', phone: null, pin_hash: null });

    (supabase.rpc as jest.Mock).mockImplementation((fn: string) => {
      if (fn === 'verify_recovery_pin') return Promise.resolve({ data: true, error: null });
      if (fn === 'recover_account') return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: null, error: null });
    });

    const { result } = await renderHook(() => useAuth(), { wrapper: AuthProvider });
    await flush();

    const message = await result.current.recoverAccount('+15551234567', '1234');

    expect(supabase.auth.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith('recover_account', {
      p_phone: '+15551234567',
      p_pin: '1234',
    });
    expect(message).toBeNull();
  });

  it('cleans up (deletes the just-created session) if recover_account then fails', async () => {
    mockSignIn('new-uid');
    mockProfile({ id: 'new-uid', phone: null, pin_hash: null });

    (supabase.rpc as jest.Mock).mockImplementation((fn: string) => {
      if (fn === 'verify_recovery_pin') return Promise.resolve({ data: true, error: null });
      if (fn === 'recover_account') return Promise.resolve({ data: false, error: null });
      if (fn === 'delete_self') return Promise.resolve({ data: null, error: null });
      return Promise.resolve({ data: null, error: null });
    });

    const { result } = await renderHook(() => useAuth(), { wrapper: AuthProvider });
    await flush();

    const message = await result.current.recoverAccount('+15551234567', '1234');

    expect(supabase.rpc).toHaveBeenCalledWith('delete_self');
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    expect(message).toBe('Incorrect PIN.');
  });
});

describe('claimPhone', () => {
  it('creates a session and claims the phone', async () => {
    mockSignIn('new-uid');
    mockProfile({ id: 'new-uid', phone: '+15551234567', pin_hash: 'hash' });
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: null });

    const { result } = await renderHook(() => useAuth(), { wrapper: AuthProvider });
    await flush();

    const message = await result.current.claimPhone('+15551234567', '1234');

    expect(supabase.auth.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith('claim_phone', {
      p_phone: '+15551234567',
      p_pin: '1234',
    });
    expect(message).toBeNull();
  });

  it('cleans up and reports a taken phone number on a 23505 conflict', async () => {
    mockSignIn('new-uid');
    mockProfile({ id: 'new-uid', phone: null, pin_hash: null });
    (supabase.rpc as jest.Mock).mockImplementation((fn: string) => {
      if (fn === 'claim_phone') {
        return Promise.resolve({ data: null, error: { code: '23505', message: 'duplicate' } });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { result } = await renderHook(() => useAuth(), { wrapper: AuthProvider });
    await flush();

    const message = await result.current.claimPhone('+15551234567', '1234');

    expect(supabase.rpc).toHaveBeenCalledWith('delete_self');
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    expect(message).toBe('That phone number is already registered to another account.');
  });
});
