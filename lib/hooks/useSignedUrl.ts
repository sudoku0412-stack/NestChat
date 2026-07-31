import { useEffect, useState } from 'react';
import { getSignedMediaUrl } from '../media';

const cache = new Map<string, string>();

export function useSignedUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(path ? cache.get(path) ?? null : null);

  useEffect(() => {
    if (!path) return;
    if (cache.has(path)) {
      setUrl(cache.get(path)!);
      return;
    }
    let active = true;
    getSignedMediaUrl(path).then((signed) => {
      if (!active || !signed) return;
      cache.set(path, signed);
      setUrl(signed);
    });
    return () => {
      active = false;
    };
  }, [path]);

  return url;
}
