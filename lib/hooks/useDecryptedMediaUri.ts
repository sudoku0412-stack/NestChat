import { useEffect, useState } from 'react';
import { getSignedMediaUrl } from '../media';
import { getDecryptedMediaUri } from '../crypto/mediaCache';
import type { MessageMediaRow } from '../database.types';

// Legacy (pre-Phase-3) plaintext media rows have wrapped_key = null -- same signed-URL behavior
// this hook's predecessor (useSignedUrl) always used, kept here so old media keeps working
// forever without a migration/backfill.
const plaintextUrlCache = new Map<string, string>();

export function useDecryptedMediaUri(
  media: MessageMediaRow,
  chatId: string,
  messageId: string,
  keyId: string | null,
  myUserId: string | null
): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
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
        if (active) setUrl(uri);
        return;
      }

      const cached = plaintextUrlCache.get(media.storage_path);
      if (cached) {
        if (active) setUrl(cached);
        return;
      }
      const signed = await getSignedMediaUrl(media.storage_path);
      if (signed) plaintextUrlCache.set(media.storage_path, signed);
      if (active) setUrl(signed);
    }

    setUrl(null);
    load();
    return () => {
      active = false;
    };
  }, [media.id, media.wrapped_key, media.storage_path, chatId, messageId, keyId, myUserId]);

  return url;
}
