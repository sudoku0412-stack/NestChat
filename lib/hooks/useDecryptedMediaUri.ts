import { useEffect, useState } from 'react';
import { getSignedMediaUrl } from '../media';
import { getDecryptedMediaUri } from '../crypto/mediaCache';
import type { MessageMediaRow } from '../database.types';

// Legacy (pre-Phase-3) plaintext media rows have wrapped_key = null -- same signed-URL behavior
// this hook's predecessor (useSignedUrl) always used, kept here so old media keeps working
// forever without a migration/backfill.
const plaintextUrlCache = new Map<string, string>();

// autoLoad gates whether decrypt-and-cache happens automatically on mount (the "media
// auto-download" preference, Settings -> Storage and data) -- when false, `url` stays null until
// something calls the returned `load()` explicitly, so tap-to-load still always works regardless
// of the setting.
export function useDecryptedMediaUri(
  media: MessageMediaRow,
  chatId: string,
  messageId: string,
  keyId: string | null,
  myUserId: string | null,
  autoLoad: boolean = true
): { url: string | null; load: () => Promise<string | null> } {
  const [url, setUrl] = useState<string | null>(null);

  async function load(): Promise<string | null> {
    if (media.wrapped_key && keyId && myUserId) {
      const uri = await getDecryptedMediaUri({
        mediaId: media.id,
        storagePath: media.storage_path,
        wrappedKey: media.wrapped_key,
        chatId,
        messageId,
        keyId,
        myUserId,
      });
      setUrl(uri);
      return uri;
    }

    const cached = plaintextUrlCache.get(media.storage_path);
    if (cached) {
      setUrl(cached);
      return cached;
    }
    const signed = await getSignedMediaUrl(media.storage_path);
    if (signed) plaintextUrlCache.set(media.storage_path, signed);
    setUrl(signed);
    return signed;
  }

  useEffect(() => {
    let active = true;
    setUrl(null);
    if (autoLoad) {
      load().then((uri) => {
        if (active) setUrl(uri);
      });
    }
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.id, media.wrapped_key, media.storage_path, chatId, messageId, keyId, myUserId, autoLoad]);

  return { url, load };
}
