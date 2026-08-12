import { chainable, type RecordedCall } from './testUtils/chain';

jest.mock('./supabase', () => ({
  supabase: { from: jest.fn(), storage: { from: jest.fn(() => ({ remove: jest.fn().mockResolvedValue({}) })) } },
}));
jest.mock('./media', () => ({ readAssetBytes: jest.fn(), uploadMediaBytes: jest.fn() }));

import { supabase } from './supabase';
import { readAssetBytes, uploadMediaBytes } from './media';
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
      args: [{ id: 'msg-1', chat_id: 'chat-1', sender_id: 'user-1', body: 'hi', reply_to_message_id: null }],
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
  const bytes = new ArrayBuffer(8);

  beforeEach(() => {
    (readAssetBytes as jest.Mock).mockResolvedValue({ asset, bytes });
  });

  it('reads bytes, uploads, then records the message and media rows with the same id', async () => {
    const messagesCalls: RecordedCall[] = [];
    const mediaCalls: RecordedCall[] = [];

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'messages') return chainable({ data: null, error: null }, messagesCalls);
      return chainable({ data: null, error: null }, mediaCalls);
    });
    (uploadMediaBytes as jest.Mock).mockResolvedValue({
      kind: 'photo',
      storagePath: 'chat-1/msg-x/123.jpg',
      width: 100,
      height: 100,
    });

    await sendMediaMessage('chat-1', 'user-1', asset);

    expect(readAssetBytes).toHaveBeenCalledWith(asset);
    const uploadCall = (uploadMediaBytes as jest.Mock).mock.calls[0];
    const [uploadChatId, uploadMessageId, uploadAsset, uploadedBytes, uploadOpts] = uploadCall;
    expect(uploadChatId).toBe('chat-1');
    expect(uploadAsset).toBe(asset);
    expect(uploadedBytes).toBe(bytes); // no identity key in this test's keychain -> plaintext
    expect(uploadOpts).toEqual({ encrypted: false });

    const insertMessageCall = messagesCalls.find((c) => c.method === 'insert')!;
    expect(insertMessageCall.args[0]).toMatchObject({
      id: uploadMessageId,
      chat_id: 'chat-1',
      sender_id: 'user-1',
      body: null,
      key_id: null,
    });

    const insertMediaCall = mediaCalls.find((c) => c.method === 'insert')!;
    expect(insertMediaCall.args[0]).toMatchObject({
      message_id: uploadMessageId,
      kind: 'photo',
      storage_path: 'chat-1/msg-x/123.jpg',
      wrapped_key: null,
    });
  });

  it('rethrows if the upload fails, without touching the messages table', async () => {
    (uploadMediaBytes as jest.Mock).mockRejectedValue(new Error('upload failed'));

    await expect(sendMediaMessage('chat-1', 'user-1', asset)).rejects.toThrow('upload failed');
    expect(supabase.from).not.toHaveBeenCalledWith('messages');
  });

  it('removes the uploaded file and rethrows if inserting the message row fails', async () => {
    const messagesCalls: RecordedCall[] = [];
    const removeMock = jest.fn().mockResolvedValue({});
    (supabase.storage.from as jest.Mock).mockReturnValue({ remove: removeMock });
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'messages') return chainable({ data: null, error: new Error('message insert failed') }, messagesCalls);
      return chainable({ data: null, error: null });
    });
    (uploadMediaBytes as jest.Mock).mockResolvedValue({ kind: 'photo', storagePath: 'chat-1/msg-y/x.jpg' });

    await expect(sendMediaMessage('chat-1', 'user-1', asset)).rejects.toThrow('message insert failed');
    expect(removeMock).toHaveBeenCalledWith(['chat-1/msg-y/x.jpg']);
  });

  it('deletes the message row and removes the uploaded file if recording the media row fails', async () => {
    const messagesCalls: RecordedCall[] = [];
    const removeMock = jest.fn().mockResolvedValue({});
    (supabase.storage.from as jest.Mock).mockReturnValue({ remove: removeMock });
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'messages') return chainable({ data: null, error: null }, messagesCalls);
      return chainable({ data: null, error: new Error('media insert failed') });
    });
    (uploadMediaBytes as jest.Mock).mockResolvedValue({ kind: 'photo', storagePath: 'chat-1/msg-z/x.jpg' });

    await expect(sendMediaMessage('chat-1', 'user-1', asset)).rejects.toThrow('media insert failed');
    expect(messagesCalls.some((c) => c.method === 'delete')).toBe(true);
    expect(removeMock).toHaveBeenCalledWith(['chat-1/msg-z/x.jpg']);
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
