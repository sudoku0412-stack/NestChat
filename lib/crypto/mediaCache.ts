import { Directory, File, Paths } from 'expo-file-system';
import { getSignedMediaUrl } from '../media';
import { getChatKeyById } from './chatKeys';
import { decryptFileBuffer } from './media';
import { getIdentityKeyPair } from './keys';

const CACHE_DIR_NAME = 'nestchat-decrypted-media';

// Session-lifetime index of mediaId -> local file:// URI, so re-rendering a message (scroll,
// re-mount) doesn't even touch the filesystem-existence check below. The on-disk cache in
// CACHE_DIR_NAME survives across app launches (until purgeDecryptedMediaCache runs, e.g. on
// sign-out); this Map is just a faster path within one running session.
const memoryIndex = new Map<string, string>();

function cacheDir(): Directory {
  return new Directory(Paths.cache, CACHE_DIR_NAME);
}

export interface DecryptedMediaParams {
  mediaId: string;
  storagePath: string;
  wrappedKey: string;
  chatId: string;
  messageId: string;
  keyId: string;
  myUserId: string;
}

// Returns a local file:// URI pointing at the decrypted bytes, downloading + decrypting +
// caching to disk on first access. Returns null if the chat key isn't available yet (e.g. a
// just-recovered device hasn't been rewrapped by a co-member) or decryption fails -- callers
// should treat null the same as "still loading" / show a fallback, never throw.
export async function getDecryptedMediaUri(params: DecryptedMediaParams): Promise<string | null> {
  const cached = memoryIndex.get(params.mediaId);
  if (cached) return cached;

  const dir = cacheDir();
  if (!dir.exists) dir.create({ intermediates: true });
  const localFile = new File(dir, `${params.mediaId}.bin`);
  if (localFile.exists) {
    memoryIndex.set(params.mediaId, localFile.uri);
    return localFile.uri;
  }

  try {
    const identity = await getIdentityKeyPair();
    if (!identity) return null;
    const chatKey = await getChatKeyById(params.keyId, params.myUserId, identity);
    if (!chatKey) return null;

    const signedUrl = await getSignedMediaUrl(params.storagePath);
    if (!signedUrl) return null;
    const response = await fetch(signedUrl);
    const encryptedBytes = new Uint8Array(await response.arrayBuffer());

    const plaintext = decryptFileBuffer(
      encryptedBytes,
      chatKey,
      params.wrappedKey,
      params.chatId,
      params.messageId,
      params.keyId
    );

    localFile.create();
    localFile.write(plaintext);
    memoryIndex.set(params.mediaId, localFile.uri);
    return localFile.uri;
  } catch (err) {
    console.warn('getDecryptedMediaUri failed', params.mediaId, err);
    return null;
  }
}

// Called on sign-out -- decrypted media is plaintext sitting on disk, so it shouldn't outlive
// the session that had the key to produce it.
export function purgeDecryptedMediaCache(): void {
  const dir = cacheDir();
  if (dir.exists) dir.delete();
  memoryIndex.clear();
}
