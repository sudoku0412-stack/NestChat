import {
  crypto_aead_xchacha20poly1305_ietf_NPUBBYTES,
  crypto_aead_xchacha20poly1305_ietf_decrypt,
  crypto_aead_xchacha20poly1305_ietf_encrypt,
  from_base64,
  randombytes_buf,
  to_base64,
} from 'react-native-libsodium';

const FILE_KEY_BYTES = 32;

// Envelope encryption, not "encrypt the file directly with the chat key": each file gets its own
// random key (fileKey), the file bytes are encrypted with that, and fileKey itself is what gets
// wrapped with the chat key -- same reason Signal/most attachment encryption schemes do this
// instead of reusing the chat key directly: one AEAD key encrypting many multi-megabyte blobs is
// worse nonce-reuse-risk hygiene than one key per file, wrapped by a key used only for tiny blobs.
//
// react-native-libsodium (this version) has no crypto_secretstream on native, only single-shot
// AEAD -- see HANDOVER.md. So this loads the whole file into memory, same as the existing
// plaintext upload pipeline already does (lib/media.ts's uploadMedia does `fetch().arrayBuffer()`
// today) -- no new memory-usage regression, just no streaming decrypt either.
function fileKeyAdditionalData(chatId: string, messageId: string, keyId: string): string {
  return `media:${chatId}:${messageId}:${keyId}`;
}

export interface EncryptedFile {
  encryptedBytes: Uint8Array;
  wrappedKey: string;
}

export function encryptFileBuffer(
  buffer: ArrayBuffer | Uint8Array,
  chatKey: Uint8Array,
  chatId: string,
  messageId: string,
  keyId: string
): EncryptedFile {
  const fileKey = randombytes_buf(FILE_KEY_BYTES);
  const fileNonce = randombytes_buf(crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const ciphertext = crypto_aead_xchacha20poly1305_ietf_encrypt(
    buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer),
    '',
    null,
    fileNonce,
    fileKey
  );
  const encryptedBytes = new Uint8Array(fileNonce.length + ciphertext.length);
  encryptedBytes.set(fileNonce, 0);
  encryptedBytes.set(ciphertext, fileNonce.length);

  const wrapNonce = randombytes_buf(crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const wrappedFileKeyCt = crypto_aead_xchacha20poly1305_ietf_encrypt(
    fileKey,
    fileKeyAdditionalData(chatId, messageId, keyId),
    null,
    wrapNonce,
    chatKey
  );
  const wrapped = new Uint8Array(wrapNonce.length + wrappedFileKeyCt.length);
  wrapped.set(wrapNonce, 0);
  wrapped.set(wrappedFileKeyCt, wrapNonce.length);

  return { encryptedBytes, wrappedKey: to_base64(wrapped) };
}

export function decryptFileBuffer(
  encryptedBytes: Uint8Array,
  chatKey: Uint8Array,
  wrappedKey: string,
  chatId: string,
  messageId: string,
  keyId: string
): Uint8Array {
  const wrapped = from_base64(wrappedKey);
  const wrapNonce = wrapped.slice(0, crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const wrappedFileKeyCt = wrapped.slice(crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const fileKey = crypto_aead_xchacha20poly1305_ietf_decrypt(
    null,
    wrappedFileKeyCt,
    fileKeyAdditionalData(chatId, messageId, keyId),
    wrapNonce,
    chatKey
  );

  const fileNonce = encryptedBytes.slice(0, crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const fileCiphertext = encryptedBytes.slice(crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  return crypto_aead_xchacha20poly1305_ietf_decrypt(null, fileCiphertext, '', fileNonce, fileKey);
}
