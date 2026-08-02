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
import { useChatList } from './useChatList';

async function flush() {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
  (supabase.channel as jest.Mock).mockReturnValue(makeChannelStub().channel);
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({
    data: { session: { access_token: 'token', expires_at: 9999999999 } },
  });
});

afterEach(() => jest.resetAllMocks());

function mockChatList(rows: Record<string, unknown>[], members: Record<string, unknown>[] = []) {
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: rows, error: null });
  (supabase.from as jest.Mock).mockReturnValue(chainable({ data: members, error: null }));
}

describe('useChatList', () => {
  it('builds a DM title from the other member, and returns their avatar', async () => {
    mockChatList(
      [
        {
          chat_id: 'c1',
          type: 'dm',
          name: null,
          last_message_body: 'hey there',
          last_message_at: '2026-01-01T00:00:00Z',
          last_message_sender_id: 'other',
          last_message_has_media: false,
          last_message_deleted: false,
          unread_count: 2,
          muted: false,
          archived: false,
        },
      ],
      [
        { chat_id: 'c1', users: { id: 'me', display_name: 'Me' } },
        { chat_id: 'c1', users: { id: 'other', display_name: 'Sudesna', avatar_url: 'x.jpg' } },
      ]
    );

    const { result, unmount } = await renderHook(() => useChatList('me'));
    await flush();

    expect(result.current.chats).toEqual([
      expect.objectContaining({
        id: 'c1',
        title: 'Sudesna',
        lastMessagePreview: 'hey there',
        unreadCount: 2,
      }),
    ]);
    expect(result.current.chats[0].avatarMembers).toHaveLength(1);
    unmount();
  });

  it('uses the group name (or a fallback) as the title for group chats', async () => {
    mockChatList([
      {
        chat_id: 'g1',
        type: 'group',
        name: 'Household',
        last_message_body: null,
        last_message_at: null,
        last_message_sender_id: null,
        last_message_has_media: false,
        last_message_deleted: false,
        unread_count: 0,
        muted: false,
        archived: false,
      },
      {
        chat_id: 'g2',
        type: 'group',
        name: null,
        last_message_body: null,
        last_message_at: null,
        last_message_sender_id: null,
        last_message_has_media: false,
        last_message_deleted: false,
        unread_count: 0,
        muted: false,
        archived: false,
      },
    ]);

    const { result, unmount } = await renderHook(() => useChatList('me'));
    await flush();

    expect(result.current.chats.map((c) => c.title)).toEqual(['Household', 'Unnamed group']);
    unmount();
  });

  describe('last-message preview', () => {
    const base = {
      chat_id: 'c1',
      type: 'dm' as const,
      name: null,
      last_message_sender_id: 'other',
      unread_count: 0,
      muted: false,
      archived: false,
    };

    it('shows a deleted-message placeholder when the last message was deleted', async () => {
      mockChatList([{ ...base, last_message_body: 'gone', last_message_deleted: true, last_message_has_media: false, last_message_at: null }]);
      const { result, unmount } = await renderHook(() => useChatList('me'));
      await flush();
      expect(result.current.chats[0].lastMessagePreview).toBe('This message was deleted');
      unmount();
    });

    it('shows the body text when present', async () => {
      mockChatList([{ ...base, last_message_body: 'hello', last_message_deleted: false, last_message_has_media: false, last_message_at: null }]);
      const { result, unmount } = await renderHook(() => useChatList('me'));
      await flush();
      expect(result.current.chats[0].lastMessagePreview).toBe('hello');
      unmount();
    });

    it('shows a photo placeholder for a media-only message', async () => {
      mockChatList([{ ...base, last_message_body: null, last_message_deleted: false, last_message_has_media: true, last_message_at: null }]);
      const { result, unmount } = await renderHook(() => useChatList('me'));
      await flush();
      expect(result.current.chats[0].lastMessagePreview).toBe('Photo · attachment');
      unmount();
    });

    it('shows "No messages yet" for a chat with no messages at all', async () => {
      mockChatList([{ ...base, last_message_body: null, last_message_deleted: false, last_message_has_media: false, last_message_at: null }]);
      const { result, unmount } = await renderHook(() => useChatList('me'));
      await flush();
      expect(result.current.chats[0].lastMessagePreview).toBe('No messages yet');
      unmount();
    });
  });

  it('surfaces zero chats and stops loading if get_chat_list errors', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: new Error('rpc failed') });
    (supabase.from as jest.Mock).mockReturnValue(chainable({ data: [], error: null }));

    const { result, unmount } = await renderHook(() => useChatList('me'));
    await flush();

    expect(result.current.chats).toEqual([]);
    expect(result.current.loading).toBe(false);
    unmount();
  });

  it('refresh() re-fetches from get_chat_list', async () => {
    mockChatList([]);
    const { result, unmount } = await renderHook(() => useChatList('me'));
    await flush();
    expect(supabase.rpc).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refresh();
    });
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('does nothing when there is no signed-in user', async () => {
    const { result, unmount } = await renderHook(() => useChatList(null));
    await flush();

    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(result.current.chats).toEqual([]);
    unmount();
  });
});
