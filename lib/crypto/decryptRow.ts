import { CURRENT_ENVELOPE_VERSION } from './config';
import { decryptMessageText } from './message';
import { getIdentityKeyPair, type IdentityKeyPair } from './keys';

// Shared by useMessages (full thread) and useChatList (last-message preview) so a message
// decrypted once in either place is never re-decrypted in the other. Decryption is a pure
// function of (row, identity) -- bodies never change once sent (only deleted_at does) -- so
// caching by message id indefinitely is safe.
const cache = new Map<string, string>();

let cachedIdentity: IdentityKeyPair | null = null;
async function getIdentity(): Promise<IdentityKeyPair | null> {
  if (cachedIdentity === null) cachedIdentity = await getIdentityKeyPair();
  return cachedIdentity;
}

export interface EncryptedTextFields {
  enc_v: number | null;
  key_id: string | null;
  ciphertext: string | null;
}

// Returns the decrypted text for an encrypted row, or `plaintextBody` unchanged if the row isn't
// encrypted (enc_v null -- legacy plaintext) or myUserId is unknown. Never throws.
export async function decryptTextField(params: {
  chatId: string;
  messageId: string;
  senderId: string;
  plaintextBody: string | null;
  encrypted: EncryptedTextFields;
  myUserId: string | null;
}): Promise<string | null> {
  const { encrypted } = params;
  if (encrypted.enc_v !== CURRENT_ENVELOPE_VERSION || !encrypted.key_id || !encrypted.ciphertext) {
    return params.plaintextBody;
  }
  if (!params.myUserId) return 'Unable to decrypt this message';

  const cached = cache.get(params.messageId);
  if (cached !== undefined) return cached;

  const identity = await getIdentity();
  if (!identity) return 'Unable to decrypt this message';

  const text = await decryptMessageText({
    chatId: params.chatId,
    messageId: params.messageId,
    senderId: params.senderId,
    keyId: encrypted.key_id,
    ciphertext: encrypted.ciphertext,
    identity,
    myUserId: params.myUserId,
  });
  cache.set(params.messageId, text);
  return text;
}
