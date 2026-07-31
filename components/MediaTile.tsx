import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSignedUrl } from '../lib/hooks/useSignedUrl';
import { colors, radius, space } from '../lib/theme';
import type { MessageMediaRow } from '../lib/database.types';

interface MediaTileProps {
  media: MessageMediaRow;
  messageId: string;
  ownMessage: boolean;
}

export function MediaTile({ media, messageId, ownMessage }: MediaTileProps) {
  const url = useSignedUrl(media.storage_path);

  return (
    <Pressable
      style={styles.tile}
      onPress={() =>
        router.push({
          pathname: '/(app)/media-viewer',
          params: { messageId, mediaId: media.id, ownMessage: ownMessage ? '1' : '0' },
        })
      }
    >
      {url ? (
        <Image source={{ uri: url }} style={styles.image} contentFit="cover" />
      ) : (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
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
  return (
    <View style={styles.tile}>
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
