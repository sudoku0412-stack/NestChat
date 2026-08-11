import {
  crypto_aead_xchacha20poly1305_ietf_NPUBBYTES,
  crypto_aead_xchacha20poly1305_ietf_decrypt,
  crypto_aead_xchacha20poly1305_ietf_encrypt,
  randombytes_buf,
  to_string,
} from 'react-native-libsodium';
import { CURRENT_ENVELOPE_VERSION } from './config';
import { packCiphertext, unpackCiphertext, type MessageEnvelopePlaintext } from './envelope';
import { getChatKeyById, getOrCreateChatKey } from './chatKeys';
import type { IdentityKeyPair } from './keys';

// AEAD additional data binds the ciphertext to exactly this (chat, message, sender, key) tuple --
// the server can copy a ciphertext blob around, but can't get it to decrypt successfully under a
// different chat_id/message_id/sender_id/key_id without knowing the chat key (which it doesn't
// have), so it can't splice a message into another chat or reattribute its sender.
function additionalData(chatId: string, messageId: string, senderId: string, keyId: string): string {
  return `${chatId}:${messageId}:${senderId}:${keyId}`;
}

export interface EncryptedMessageFields {
  enc_v: number;
  key_id: string;
  ciphertext: string;
}

export async function encryptMessageText(params: {
  chatId: string;
  messageId: string;
  senderId: string;
  text: string;
  identity: IdentityKeyPair;
}): Promise<EncryptedMessageFields> {
  const { keyId, key } = await getOrCreateChatKey(params.chatId, params.senderId, params.identity);
  const nonce = randombytes_buf(crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const envelope: MessageEnvelopePlaintext = { t: 'text', text: params.text };
  const ct = crypto_aead_xchacha20poly1305_ietf_encrypt(
    JSON.stringify(envelope),
    additionalData(params.chatId, params.messageId, params.senderId, keyId),
    null,
    nonce,
    key
  );
  return { enc_v: CURRENT_ENVELOPE_VERSION, key_id: keyId, ciphertext: packCiphertext(nonce, ct) };
}

const DECRYPT_FAILED_SENTINEL = 'Unable to decrypt this message';

export async function decryptMessageText(params: {
  chatId: string;
  messageId: string;
  senderId: string;
  keyId: string;
  ciphertext: string;
  identity: IdentityKeyPair;
  myUserId: string;
}): Promise<string> {
  try {
    const key = await getChatKeyById(params.keyId, params.myUserId, params.identity);
    if (!key) return DECRYPT_FAILED_SENTINEL;

    const { nonce, ciphertext } = unpackCiphertext(params.ciphertext, crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
    const plaintextBytes = crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      ciphertext,
      additionalData(params.chatId, params.messageId, params.senderId, params.keyId),
      nonce,
      key
    );
    const envelope = JSON.parse(to_string(plaintextBytes)) as MessageEnvelopePlaintext;
    return envelope.text ?? '';
  } catch {
    // Never throw out of a decrypt call -- one bad/foreign-key message must not blank a whole
    // thread. Common causes: key not yet received (just-added member), corrupted row.
    return DECRYPT_FAILED_SENTINEL;
  }
}
