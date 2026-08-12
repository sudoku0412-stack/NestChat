import { randombytes_buf } from 'react-native-libsodium';
import { decryptFileBuffer, encryptFileBuffer } from './media';

describe('encryptFileBuffer / decryptFileBuffer', () => {
  const chatKey = randombytes_buf(32);
  const chatId = 'chat-1';
  const messageId = 'msg-1';
  const keyId = 'key-1';

  it('round-trips file bytes through encrypt then decrypt', () => {
    const original = randombytes_buf(1024); // stand-in for a photo's bytes
    const { encryptedBytes, wrappedKey } = encryptFileBuffer(original, chatKey, chatId, messageId, keyId);

    expect(encryptedBytes).not.toEqual(original);

    const decrypted = decryptFileBuffer(encryptedBytes, chatKey, wrappedKey, chatId, messageId, keyId);
    expect(Array.from(decrypted)).toEqual(Array.from(original));
  });

  it('produces a different wrapped key and ciphertext each time (fresh file key + nonces)', () => {
    const original = randombytes_buf(64);
    const a = encryptFileBuffer(original, chatKey, chatId, messageId, keyId);
    const b = encryptFileBuffer(original, chatKey, chatId, messageId, keyId);
    expect(a.wrappedKey).not.toBe(b.wrappedKey);
    expect(Array.from(a.encryptedBytes)).not.toEqual(Array.from(b.encryptedBytes));
  });

  it('fails to decrypt if the wrong chat key is used to unwrap the file key', () => {
    const original = randombytes_buf(64);
    const { encryptedBytes, wrappedKey } = encryptFileBuffer(original, chatKey, chatId, messageId, keyId);
    const wrongKey = randombytes_buf(32);
    expect(() => decryptFileBuffer(encryptedBytes, wrongKey, wrappedKey, chatId, messageId, keyId)).toThrow();
  });

  it('fails to decrypt if the additional-data binding (message id) does not match', () => {
    const original = randombytes_buf(64);
    const { encryptedBytes, wrappedKey } = encryptFileBuffer(original, chatKey, chatId, messageId, keyId);
    expect(() =>
      decryptFileBuffer(encryptedBytes, chatKey, wrappedKey, chatId, 'a-different-message-id', keyId)
    ).toThrow();
  });
});
