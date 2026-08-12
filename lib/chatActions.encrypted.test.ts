import { chainable, type RecordedCall } from './testUtils/chain';

// Separate file from chatActions.test.ts because this mocks ./crypto with SEND_ENCRYPTED forced
// on -- module mocks are file-scoped in Jest, and the other file's tests rely on the real
// (false) default to assert plaintext insert payloads.
jest.mock('./supabase', () => ({
  supabase: { from: jest.fn(), storage: { from: jest.fn(() => ({ remove: jest.fn().mockResolvedValue({}) })) } },
}));
jest.mock('./crypto', () => ({
  SEND_ENCRYPTED: true,
  getIdentityKeyPair: jest.fn().mockResolvedValue({ publicKey: new Uint8Array(32), secretKey: new Uint8Array(32) }),
  encryptMessageText: jest.fn().mockResolvedValue({ enc_v: 1, key_id: 'key-1', ciphertext: 'ct-base64' }),
  getOrCreateChatKey: jest.fn().mockResolvedValue({ keyId: 'key-1', key: new Uint8Array(32) }),
  encryptFileBuffer: jest.fn().mockReturnValue({
    encryptedBytes: new Uint8Array([9, 9, 9]),
    wrappedKey: 'wrapped-key-base64',
  }),
}));
jest.mock('./media', () => ({ readAssetBytes: jest.fn(), uploadMediaBytes: jest.fn() }));

import { supabase } from './supabase';
import { encryptFileBuffer, encryptMessageText, getIdentityKeyPair, getOrCreateChatKey } from './crypto';
import { readAssetBytes, uploadMediaBytes } from './media';
import { sendMediaMessage, sendTextMessage } from './chatActions';

describe('sendTextMessage with SEND_ENCRYPTED on', () => {
  afterEach(() => jest.clearAllMocks());

  it('inserts the encrypted envelope with body null instead of the plaintext', async () => {
    const calls: RecordedCall[] = [];
    (supabase.from as jest.Mock).mockReturnValue(
      chainable({ data: { id: 'msg-1' }, error: null }, calls)
    );

    await sendTextMessage('chat-1', 'user-1', 'secret text', 'msg-1');

    expect(encryptMessageText).toHaveBeenCalledWith({
      chatId: 'chat-1',
      messageId: 'msg-1',
      senderId: 'user-1',
      text: 'secret text',
      identity: { publicKey: new Uint8Array(32), secretKey: new Uint8Array(32) },
    });
    const insertCall = calls.find((c) => c.method === 'insert')!;
    expect(insertCall.args[0]).toEqual({
      id: 'msg-1',
      chat_id: 'chat-1',
      sender_id: 'user-1',
      body: null,
      reply_to_message_id: null,
      enc_v: 1,
      key_id: 'key-1',
      ciphertext: 'ct-base64',
    });
  });

  it('falls back to plaintext if no identity key exists yet', async () => {
    (getIdentityKeyPair as jest.Mock).mockResolvedValueOnce(null);
    const calls: RecordedCall[] = [];
    (supabase.from as jest.Mock).mockReturnValue(
      chainable({ data: { id: 'msg-2' }, error: null }, calls)
    );

    await sendTextMessage('chat-1', 'user-1', 'hi', 'msg-2');

    const insertCall = calls.find((c) => c.method === 'insert')!;
    expect(insertCall.args[0]).toMatchObject({ body: 'hi' });
    expect(insertCall.args[0]).not.toHaveProperty('enc_v');
  });
});

describe('sendMediaMessage with SEND_ENCRYPTED on', () => {
  afterEach(() => jest.clearAllMocks());

  const asset = { uri: 'file://photo.jpg', kind: 'photo' as const };
  const bytes = new ArrayBuffer(8);

  it('encrypts the file, wraps its key with the chat key, and uploads the ciphertext', async () => {
    (readAssetBytes as jest.Mock).mockResolvedValue({ asset, bytes });
    (uploadMediaBytes as jest.Mock).mockResolvedValue({ kind: 'photo', storagePath: 'chat-1/msg/enc.jpg.enc' });

    const messagesCalls: RecordedCall[] = [];
    const mediaCalls: RecordedCall[] = [];
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'messages') return chainable({ data: null, error: null }, messagesCalls);
      return chainable({ data: null, error: null }, mediaCalls);
    });

    await sendMediaMessage('chat-1', 'user-1', asset);

    expect(getOrCreateChatKey).toHaveBeenCalledWith('chat-1', 'user-1', {
      publicKey: new Uint8Array(32),
      secretKey: new Uint8Array(32),
    });
    const encMessageId = (encryptFileBuffer as jest.Mock).mock.calls[0][3];
    expect(encryptFileBuffer).toHaveBeenCalledWith(bytes, new Uint8Array(32), 'chat-1', encMessageId, 'key-1');

    const uploadCall = (uploadMediaBytes as jest.Mock).mock.calls[0];
    expect(uploadCall[3]).toEqual(new Uint8Array([9, 9, 9])); // the encrypted bytes, not the plaintext
    expect(uploadCall[4]).toEqual({ encrypted: true });

    const insertMessageCall = messagesCalls.find((c) => c.method === 'insert')!;
    expect(insertMessageCall.args[0]).toMatchObject({ key_id: 'key-1', body: null });

    const insertMediaCall = mediaCalls.find((c) => c.method === 'insert')!;
    expect(insertMediaCall.args[0]).toMatchObject({ wrapped_key: 'wrapped-key-base64' });
  });

  it('falls back to plaintext upload if no identity key exists yet', async () => {
    (getIdentityKeyPair as jest.Mock).mockResolvedValueOnce(null);
    (readAssetBytes as jest.Mock).mockResolvedValue({ asset, bytes });
    (uploadMediaBytes as jest.Mock).mockResolvedValue({ kind: 'photo', storagePath: 'chat-1/msg/plain.jpg' });
    (supabase.from as jest.Mock).mockReturnValue(chainable({ data: null, error: null }));

    await sendMediaMessage('chat-1', 'user-1', asset);

    expect(encryptFileBuffer).not.toHaveBeenCalled();
    const uploadCall = (uploadMediaBytes as jest.Mock).mock.calls[0];
    expect(uploadCall[3]).toBe(bytes);
    expect(uploadCall[4]).toEqual({ encrypted: false });
  });
});
