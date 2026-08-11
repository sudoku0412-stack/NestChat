import { generateIdentityKeyPair } from './keys';

jest.mock('./chatKeys', () => ({
  getOrCreateChatKey: jest.fn().mockResolvedValue({ keyId: 'key-1', key: new Uint8Array(32).fill(7) }),
  getChatKeyById: jest.fn().mockResolvedValue(new Uint8Array(32).fill(7)),
}));

import { decryptMessageText, encryptMessageText } from './message';
import { getChatKeyById } from './chatKeys';

const identity = generateIdentityKeyPair();

describe('encryptMessageText / decryptMessageText', () => {
  const base = { chatId: 'chat-1', messageId: 'msg-1', senderId: 'user-a', identity, myUserId: 'user-a' };

  it('round-trips plaintext through encrypt then decrypt', async () => {
    const encrypted = await encryptMessageText({ ...base, text: 'hey there' });
    expect(encrypted.key_id).toBe('key-1');
    expect(encrypted.enc_v).toBe(1);

    const decrypted = await decryptMessageText({ ...base, keyId: encrypted.key_id, ciphertext: encrypted.ciphertext });
    expect(decrypted).toBe('hey there');
  });

  it('produces different ciphertext for the same plaintext each time (random nonce)', async () => {
    const a = await encryptMessageText({ ...base, text: 'same text' });
    const b = await encryptMessageText({ ...base, text: 'same text' });
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('fails closed (sentinel, no throw) when the additional-data binding does not match', async () => {
    const encrypted = await encryptMessageText({ ...base, text: 'hey there' });
    // Decrypting as if this were a different message id -- the AEAD additional data won't match,
    // so this must return the sentinel rather than the real plaintext or a thrown error.
    const decrypted = await decryptMessageText({
      ...base,
      messageId: 'a-different-message-id',
      keyId: encrypted.key_id,
      ciphertext: encrypted.ciphertext,
    });
    expect(decrypted).toBe('Unable to decrypt this message');
  });

  it('fails closed when the chat key is unavailable', async () => {
    (getChatKeyById as jest.Mock).mockResolvedValueOnce(null);
    const decrypted = await decryptMessageText({ ...base, keyId: 'key-1', ciphertext: 'irrelevant' });
    expect(decrypted).toBe('Unable to decrypt this message');
  });
});
