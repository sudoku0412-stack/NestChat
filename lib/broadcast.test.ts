import { chainable, type RecordedCall } from './testUtils/chain';

jest.mock('./supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));
jest.mock('./chatActions', () => ({ sendTextMessage: jest.fn(), sendMediaMessage: jest.fn() }));

import { supabase } from './supabase';
import { sendTextMessage, sendMediaMessage } from './chatActions';
import { sendBroadcastMedia, sendBroadcastText } from './broadcast';

describe('sendBroadcastText', () => {
  afterEach(() => jest.resetAllMocks());

  function mockTables(sendId = 'send-1') {
    const sendsCalls: RecordedCall[] = [];
    const targetsCalls: RecordedCall[] = [];
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'broadcast_sends') return chainable({ data: { id: sendId }, error: null }, sendsCalls);
      if (table === 'broadcast_send_targets') return chainable({ data: null, error: null }, targetsCalls);
      throw new Error(`unexpected table ${table}`);
    });
    return { sendsCalls, targetsCalls };
  }

  it('creates a broadcast_sends row, sends to each recipient via find_or_create_dm + sendTextMessage, and logs each target', async () => {
    const { sendsCalls, targetsCalls } = mockTables();
    (supabase.rpc as jest.Mock).mockImplementation((fn: string, args: { other_user_id: string }) =>
      Promise.resolve({ data: `chat-${args.other_user_id}`, error: null })
    );
    (sendTextMessage as jest.Mock).mockImplementation((chatId: string) =>
      Promise.resolve({ id: `msg-${chatId}` })
    );

    const result = await sendBroadcastText(['u1', 'u2'], 'sender-1', 'hello', 'list-1');

    expect(result).toEqual({ sent: 2, failed: [] });
    expect(sendsCalls[0]).toEqual({
      method: 'insert',
      args: [{ sender_id: 'sender-1', list_id: 'list-1' }],
    });
    expect(supabase.rpc).toHaveBeenCalledWith('find_or_create_dm', { other_user_id: 'u1' });
    expect(supabase.rpc).toHaveBeenCalledWith('find_or_create_dm', { other_user_id: 'u2' });
    expect(sendTextMessage).toHaveBeenCalledWith('chat-u1', 'sender-1', 'hello');
    expect(sendTextMessage).toHaveBeenCalledWith('chat-u2', 'sender-1', 'hello');
    expect(targetsCalls.filter((c) => c.method === 'insert')).toHaveLength(2);
    expect(targetsCalls[0]).toEqual({
      method: 'insert',
      args: [{ send_id: 'send-1', recipient_id: 'u1', chat_id: 'chat-u1', message_id: 'msg-chat-u1' }],
    });
  });

  it('keeps going when one recipient fails, and reports it in `failed`', async () => {
    mockTables();
    (supabase.rpc as jest.Mock).mockImplementation((fn: string, args: { other_user_id: string }) =>
      args.other_user_id === 'bad'
        ? Promise.resolve({ data: null, error: new Error('no dm') })
        : Promise.resolve({ data: `chat-${args.other_user_id}`, error: null })
    );
    (sendTextMessage as jest.Mock).mockResolvedValue({ id: 'msg-1' });

    const result = await sendBroadcastText(['bad', 'good'], 'sender-1', 'hello');

    expect(result.sent).toBe(1);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].recipientId).toBe('bad');
    expect(sendTextMessage).toHaveBeenCalledTimes(1);
  });

  it('throws if the broadcast_sends row itself fails to insert', async () => {
    (supabase.from as jest.Mock).mockReturnValue(chainable({ data: null, error: new Error('boom') }));

    await expect(sendBroadcastText(['u1'], 'sender-1', 'hi')).rejects.toThrow('boom');
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});

describe('sendBroadcastMedia', () => {
  afterEach(() => jest.resetAllMocks());

  it('reuses the same per-recipient fan-out, calling sendMediaMessage instead of sendTextMessage', async () => {
    const targetsCalls: RecordedCall[] = [];
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'broadcast_sends') return chainable({ data: { id: 'send-2' }, error: null });
      return chainable({ data: null, error: null }, targetsCalls);
    });
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: 'chat-u1', error: null });
    (sendMediaMessage as jest.Mock).mockResolvedValue({ id: 'media-msg-1' });
    const asset = { uri: 'file://photo.jpg', kind: 'photo' as const };

    const result = await sendBroadcastMedia(['u1'], 'sender-1', asset);

    expect(result).toEqual({ sent: 1, failed: [] });
    expect(sendMediaMessage).toHaveBeenCalledWith('chat-u1', 'sender-1', asset);
    expect(targetsCalls[0].args[0]).toMatchObject({ recipient_id: 'u1', message_id: 'media-msg-1' });
  });
});
