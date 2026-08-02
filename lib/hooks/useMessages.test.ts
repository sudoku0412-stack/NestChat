import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { chainable, makeChannelStub } from '../testUtils/chain';

jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    channel: jest.fn(),
    removeChannel: jest.fn(),
    realtime: { setAuth: jest.fn() },
    auth: { getSession: jest.fn() },
  },
}));

import { supabase } from '../supabase';
import { useMessages } from './useMessages';

type Row = Record<string, unknown>;

function mockChatData(messages: Row[], memberStates: Row[] = []) {
  (supabase.from as jest.Mock).mockImplementation((table: string) => {
    if (table === 'messages') return chainable({ data: messages, error: null });
    if (table === 'chat_members') return chainable({ data: memberStates, error: null });
    // message_media, live_locations — none needed for these tests.
    return chainable({ data: [], error: null });
  });
}

beforeEach(() => {
  // useMessages logs realtime-channel diagnostics that are useful on-device
  // but just noise in a test run.
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
  (supabase.channel as jest.Mock).mockReturnValue(makeChannelStub().channel);
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({
    data: { session: { access_token: 'token', expires_at: Math.floor(Date.now() / 1000) + 3600 } },
  });
  (supabase.rpc as jest.Mock).mockResolvedValue({ error: null });
});

afterEach(() => jest.resetAllMocks());

// Lets every pending microtask in the mount effect's Promise chain (fetch →
// setState → conditional mark_chat_read call) settle before we assert.
async function flush() {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe('useMessages — mark-as-read gating', () => {
  it('marks the chat read once on initial load when there are messages', async () => {
    mockChatData([{ id: 'm1', chat_id: 'c1', created_at: '2026-01-01T00:00:00Z' }]);

    const { result, unmount } = await renderHook(() => useMessages('c1', 'user-1'));
    await flush();
    expect(result.current.messages).toHaveLength(1);

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith('mark_chat_read', { p_chat_id: 'c1' });
    unmount();
  });

  it('does NOT re-mark-as-read on a refresh that returns the same newest message', async () => {
    mockChatData([{ id: 'm1', chat_id: 'c1', created_at: '2026-01-01T00:00:00Z' }]);

    const { result, unmount } = await renderHook(() => useMessages('c1', 'user-1'));
    await flush();
    expect(supabase.rpc).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refresh();
    });

    // Same newest id as before — this is the exact regression this session
    // fixed: mark_chat_read used to fire on every refresh, not just when
    // the newest message actually changed.
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('marks as read again once a genuinely new message arrives', async () => {
    mockChatData([{ id: 'm1', chat_id: 'c1', created_at: '2026-01-01T00:00:00Z' }]);
    const { result, unmount } = await renderHook(() => useMessages('c1', 'user-1'));
    await flush();
    expect(supabase.rpc).toHaveBeenCalledTimes(1);

    mockChatData([
      { id: 'm1', chat_id: 'c1', created_at: '2026-01-01T00:00:00Z' },
      { id: 'm2', chat_id: 'c1', created_at: '2026-01-01T00:05:00Z' },
    ]);
    await act(async () => {
      await result.current.refresh();
    });

    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('never calls mark_chat_read for an empty chat', async () => {
    mockChatData([]);
    const { result, unmount } = await renderHook(() => useMessages('c1', 'user-1'));
    await flush();
    expect(result.current.loading).toBe(false);

    expect(supabase.rpc).not.toHaveBeenCalled();
    unmount();
  });

  it('never calls mark_chat_read when there is no signed-in user', async () => {
    mockChatData([{ id: 'm1', chat_id: 'c1', created_at: '2026-01-01T00:00:00Z' }]);
    const { result, unmount } = await renderHook(() => useMessages('c1', null));
    await flush();
    expect(result.current.messages).toHaveLength(1);

    expect(supabase.rpc).not.toHaveBeenCalled();
    unmount();
  });
});

describe('useMessages — isReadByOthers', () => {
  const messages = [
    { id: 'm1', chat_id: 'c1', created_at: '2026-01-01T00:00:00Z' },
    { id: 'm2', chat_id: 'c1', created_at: '2026-01-01T00:05:00Z' },
  ];

  it('is false when no other member has read up to that message', async () => {
    mockChatData(messages, [{ user_id: 'other', last_read_message_id: null }]);
    const { result, unmount } = await renderHook(() => useMessages('c1', 'user-1'));
    await flush();
    expect(result.current.messages).toHaveLength(2);

    expect(result.current.isReadByOthers(messages[0] as never)).toBe(false);
    unmount();
  });

  it('is true only for messages at or before the other member’s last_read_message_id', async () => {
    mockChatData(messages, [{ user_id: 'other', last_read_message_id: 'm1' }]);
    const { result, unmount } = await renderHook(() => useMessages('c1', 'user-1'));
    await flush();
    expect(result.current.messages).toHaveLength(2);

    expect(result.current.isReadByOthers(messages[0] as never)).toBe(true);
    expect(result.current.isReadByOthers(messages[1] as never)).toBe(false);
    unmount();
  });

  it('requires every other member to have read it, in a group chat', async () => {
    mockChatData(messages, [
      { user_id: 'a', last_read_message_id: 'm2' },
      { user_id: 'b', last_read_message_id: 'm1' },
    ]);
    const { result, unmount } = await renderHook(() => useMessages('c1', 'user-1'));
    await flush();
    expect(result.current.messages).toHaveLength(2);

    expect(result.current.isReadByOthers(messages[0] as never)).toBe(true);
    expect(result.current.isReadByOthers(messages[1] as never)).toBe(false);
    unmount();
  });
});
