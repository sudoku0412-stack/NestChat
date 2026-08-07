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
import { router } from 'expo-router';
import { useSignedUrl } from '../lib/hooks/useSignedUrl';
import { colors, radius, space } from '../lib/theme';
import { useAccentTheme } from '../lib/accentTheme';
import type { MessageMediaRow } from '../lib/database.types';

interface MediaTileProps {
  media: MessageMediaRow;
  messageId: string;
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

export function MediaTile({ media, messageId, ownMessage, onLongPress }: MediaTileProps) {
  const url = useSignedUrl(media.storage_path);
  const { colors: accentColors } = useAccentTheme();

  function handleLongPress(e: GestureResponderEvent) {
    onLongPress?.(e.nativeEvent.pageY);
  }

  if (media.kind === 'document') {
    return (
      <Pressable
        style={styles.documentTile}
        onPress={() => url && Linking.openURL(url)}
        onLongPress={handleLongPress}
        disabled={!url}
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
      onPress={() =>
        router.push({
          pathname: '/(app)/media-viewer',
          params: { messageId, mediaId: media.id, ownMessage: ownMessage ? '1' : '0' },
        })
      }
      onLongPress={handleLongPress}
    >
      {url ? (
        <Image source={{ uri: url }} style={styles.image} contentFit="cover" />
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
