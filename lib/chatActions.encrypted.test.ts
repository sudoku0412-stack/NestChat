import { chainable, type RecordedCall } from './testUtils/chain';

// Separate file from chatActions.test.ts because this mocks ./crypto with SEND_ENCRYPTED forced
// on -- module mocks are file-scoped in Jest, and the other file's tests rely on the real
// (false) default to assert plaintext insert payloads.
jest.mock('./supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('./crypto', () => ({
  SEND_ENCRYPTED: true,
  getIdentityKeyPair: jest.fn().mockResolvedValue({ publicKey: new Uint8Array(32), secretKey: new Uint8Array(32) }),
  encryptMessageText: jest.fn().mockResolvedValue({ enc_v: 1, key_id: 'key-1', ciphertext: 'ct-base64' }),
}));

import { supabase } from './supabase';
import { encryptMessageText, getIdentityKeyPair } from './crypto';
import { sendTextMessage } from './chatActions';

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
