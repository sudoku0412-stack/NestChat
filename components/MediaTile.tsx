import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import { useState } from 'react';
import { useDecryptedMediaUri } from '../lib/hooks/useDecryptedMediaUri';
import { useAuth } from '../lib/auth';
import { colors, radius, space } from '../lib/theme';
import { useAccentTheme } from '../lib/accentTheme';
import type { MessageMediaRow } from '../lib/database.types';

interface MediaTileProps {
  media: MessageMediaRow;
  chatId: string;
  messageId: string;
  keyId: string | null;
  myUserId: string | null;
  ownMessage: boolean;
  // MediaTile is itself a Pressable (tap opens the media viewer / document), nested inside
  // MessageBubble's own Pressable (tap-and-hold to react/reply/etc). RN's gesture responder
  // system hands long-press to whichever Pressable is deepest under the finger, so without this
  // forwarded here, long-pressing directly on a photo/gif/sticker/document silently did nothing
  // -- the outer bubble's onLongPress never fired.
  onLongPress?: (y: number) => void;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// A decrypted document lives at a local file:// URI, which Linking.openURL doesn't handle well
// (it's built for web URLs / registered schemes) -- expo-sharing's share sheet does, and also
// covers the "which app opens this" step Linking.openURL used to skip for legacy plaintext rows.
// Legacy rows are still a remote https signed URL, which Sharing can't open directly, so those
// keep going through Linking.openURL exactly as before.
async function openDocument(url: string) {
  if (url.startsWith('file://')) {
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(url);
  } else {
    Linking.openURL(url);
  }
}

export function MediaTile({ media, chatId, messageId, keyId, myUserId, ownMessage, onLongPress }: MediaTileProps) {
  const { profile } = useAuth();
  const autoLoad = profile?.media_autodownload !== 'never';
  const { url, load } = useDecryptedMediaUri(media, chatId, messageId, keyId, myUserId, autoLoad);
  const { colors: accentColors } = useAccentTheme();
  const [fetching, setFetching] = useState(false);

  function handleLongPress(e: GestureResponderEvent) {
    onLongPress?.(e.nativeEvent.pageY);
  }

  async function ensureLoaded(): Promise<string | null> {
    if (url) return url;
    setFetching(true);
    try {
      return await load();
    } finally {
      setFetching(false);
    }
  }

  if (media.kind === 'document') {
    return (
      <Pressable
        style={styles.documentTile}
        onPress={async () => {
          const resolved = await ensureLoaded();
          if (resolved) openDocument(resolved);
        }}
        onLongPress={handleLongPress}
        disabled={fetching}
      >
        <Text style={styles.documentGlyph}>📄</Text>
        <View style={styles.documentInfo}>
          <Text style={styles.documentName} numberOfLines={1}>
            {media.file_name || 'Document'}
          </Text>
          <Text style={styles.documentMeta}>{formatFileSize(media.file_size)}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={styles.tile}
      onPress={async () => {
        // Not loaded yet (auto-download off) -- first tap fetches the thumbnail instead of
        // jumping straight to the viewer, matching a familiar "tap to download" affordance.
        if (!url) {
          await ensureLoaded();
          return;
        }
        router.push({
          pathname: '/(app)/media-viewer',
          params: { messageId, mediaId: media.id, ownMessage: ownMessage ? '1' : '0' },
        });
      }}
      onLongPress={handleLongPress}
    >
      {url ? (
        <Image source={{ uri: url }} style={styles.image} contentFit="cover" />
      ) : !autoLoad && !fetching ? (
        <View style={styles.loading}>
          <Text style={styles.downloadGlyph}>⬇</Text>
          <Text style={styles.downloadLabel}>Tap to download</Text>
        </View>
      ) : (
        <View style={styles.loading}>
          <ActivityIndicator color={accentColors.accent} />
        </View>
      )}
      {media.kind === 'video' && (
        <View style={styles.playBadge}>
          <Text style={styles.playGlyph}>▶</Text>
        </View>
      )}
    </Pressable>
  );
}

export function PendingMediaTile() {
  const { colors: accentColors } = useAccentTheme();
  return (
    <View style={styles.tile}>
      <View style={styles.loading}>
        <ActivityIndicator color={accentColors.accent} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  documentTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    width: 220,
    padding: space[3],
    borderRadius: radius.md,
    backgroundColor: colors.bgDeep,
  },
  documentGlyph: {
    fontSize: 28,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  documentMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  tile: {
    width: 200,
    height: 200,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadGlyph: {
    color: colors.textMuted,
    fontSize: 22,
  },
  downloadLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: space[1],
  },
  playBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyph: {
    color: colors.text,
    fontSize: 28,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 6,
  },
});
