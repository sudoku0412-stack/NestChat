import { chainable, type RecordedCall } from './testUtils/chain';

jest.mock('./supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('./media', () => ({ uploadMedia: jest.fn() }));

import { supabase } from './supabase';
import { uploadMedia } from './media';
import { generateId, sendMediaMessage, sendTextMessage, softDeleteMessage } from './chatActions';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('generateId', () => {
  it('produces a valid v4-shaped UUID', () => {
    expect(generateId()).toMatch(UUID_V4);
  });

  it('produces different ids across calls', () => {
    expect(generateId()).not.toBe(generateId());
  });
});

describe('sendTextMessage', () => {
  afterEach(() => jest.resetAllMocks());

  it('inserts with the given (or generated) id and returns the inserted row', async () => {
    const row = { id: 'msg-1', chat_id: 'chat-1', sender_id: 'user-1', body: 'hi' };
    const calls: RecordedCall[] = [];
    (supabase.from as jest.Mock).mockReturnValue(chainable({ data: row, error: null }, calls));

    const result = await sendTextMessage('chat-1', 'user-1', 'hi', 'msg-1');

    expect(supabase.from).toHaveBeenCalledWith('messages');
    expect(calls[0]).toEqual({
      method: 'insert',
      args: [{ id: 'msg-1', chat_id: 'chat-1', sender_id: 'user-1', body: 'hi' }],
    });
    expect(result).toEqual(row);
  });

  it('generates an id when none is passed', async () => {
    const calls: RecordedCall[] = [];
    (supabase.from as jest.Mock).mockReturnValue(
      chainable({ data: { id: 'whatever' }, error: null }, calls)
    );

    await sendTextMessage('chat-1', 'user-1', 'hi');

    const insertCall = calls.find((c) => c.method === 'insert')!;
    expect((insertCall.args[0] as { id: string }).id).toMatch(UUID_V4);
  });

  it('throws when the insert fails', async () => {
    (supabase.from as jest.Mock).mockReturnValue(
      chainable({ data: null, error: new Error('boom') })
    );

    await expect(sendTextMessage('chat-1', 'user-1', 'hi')).rejects.toThrow('boom');
  });
});

describe('sendMediaMessage', () => {
  afterEach(() => jest.resetAllMocks());

  const asset = { uri: 'file://photo.jpg', kind: 'photo' as const };

  it('creates a placeholder message, uploads, then records the media row', async () => {
    const message = { id: 'msg-2' };
    const messagesCalls: RecordedCall[] = [];
    const mediaCalls: RecordedCall[] = [];

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'messages') return chainable({ data: message, error: null }, messagesCalls);
      return chainable({ data: null, error: null }, mediaCalls);
    });
    (uploadMedia as jest.Mock).mockResolvedValue({
      kind: 'photo',
      storagePath: 'chat-1/msg-2/123.jpg',
      width: 100,
      height: 100,
    });

    await sendMediaMessage('chat-1', 'user-1', asset);

    expect(uploadMedia).toHaveBeenCalledWith('chat-1', 'msg-2', asset);
    const insertMediaCall = mediaCalls.find((c) => c.method === 'insert')!;
    expect(insertMediaCall.args[0]).toMatchObject({
      message_id: 'msg-2',
      kind: 'photo',
      storage_path: 'chat-1/msg-2/123.jpg',
    });
  });

  it('deletes the placeholder message and rethrows if the upload fails', async () => {
    const message = { id: 'msg-3' };
    const messagesCalls: RecordedCall[] = [];

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'messages') return chainable({ data: message, error: null }, messagesCalls);
      return chainable({ data: null, error: null });
    });
    (uploadMedia as jest.Mock).mockRejectedValue(new Error('upload failed'));

    await expect(sendMediaMessage('chat-1', 'user-1', asset)).rejects.toThrow('upload failed');

    const deleteCall = messagesCalls.find((c) => c.method === 'delete');
    expect(deleteCall).toBeDefined();
    const eqCall = messagesCalls.find((c) => c.method === 'eq' && c.args[1] === 'msg-3');
    expect(eqCall).toBeDefined();
  });

  it('deletes the placeholder message and throws if recording the media row fails', async () => {
    const message = { id: 'msg-4' };
    const messagesCalls: RecordedCall[] = [];

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'messages') return chainable({ data: message, error: null }, messagesCalls);
      return chainable({ data: null, error: new Error('media insert failed') });
    });
    (uploadMedia as jest.Mock).mockResolvedValue({ kind: 'photo', storagePath: 'x' });

    await expect(sendMediaMessage('chat-1', 'user-1', asset)).rejects.toThrow('media insert failed');
    expect(messagesCalls.some((c) => c.method === 'delete')).toBe(true);
  });
});

describe('softDeleteMessage', () => {
  it('sets deleted_at on the target message', async () => {
    const calls: RecordedCall[] = [];
    (supabase.from as jest.Mock).mockReturnValue(chainable({ data: null, error: null }, calls));

    await softDeleteMessage('msg-5');

    expect(supabase.from).toHaveBeenCalledWith('messages');
    const updateCall = calls.find((c) => c.method === 'update')!;
    expect(updateCall.args[0]).toHaveProperty('deleted_at');
    expect(calls.some((c) => c.method === 'eq' && c.args[0] === 'id' && c.args[1] === 'msg-5')).toBe(
      true
    );
  });
});
