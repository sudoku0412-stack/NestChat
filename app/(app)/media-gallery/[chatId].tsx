import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import { useDecryptedMediaUri } from '../../../lib/hooks/useDecryptedMediaUri';
import { colors, space } from '../../../lib/theme';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { useAccentTheme } from '../../../lib/accentTheme';
import type { MessageMediaRow } from '../../../lib/database.types';

type GalleryItem = MessageMediaRow & { message_id: string; chat_id: string; sender_id: string; key_id: string | null };

const COLUMNS = 3;
const TILE_SIZE = Dimensions.get('window').width / COLUMNS;

// Same reasoning as MediaTile's openDocument: a decrypted document is a local file:// URI, which
// Sharing handles and Linking.openURL doesn't; legacy plaintext rows are still a remote signed
// URL, which only Linking.openURL can open.
async function openDocument(url: string) {
  if (url.startsWith('file://')) {
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(url);
  } else {
    Linking.openURL(url);
  }
}

function GridTile({ item, ownMessage, myUserId }: { item: GalleryItem; ownMessage: boolean; myUserId: string | null }) {
  const { url } = useDecryptedMediaUri(item, item.chat_id, item.message_id, item.key_id, myUserId);
  const { colors: accentColors } = useAccentTheme();
  return (
    <Pressable
      style={styles.gridTile}
      onPress={() =>
        router.push({
          pathname: '/(app)/media-viewer',
          params: { messageId: item.message_id, mediaId: item.id, ownMessage: ownMessage ? '1' : '0' },
        })
      }
    >
      {url ? (
        <Image source={{ uri: url }} style={styles.gridImage} contentFit="cover" />
      ) : (
        <View style={styles.gridLoading}>
          <ActivityIndicator color={accentColors.accent} size="small" />
        </View>
      )}
      {item.kind === 'video' && <Text style={styles.playGlyph}>▶</Text>}
    </Pressable>
  );
}

function DocumentRow({ item, myUserId }: { item: GalleryItem; myUserId: string | null }) {
  const { url } = useDecryptedMediaUri(item, item.chat_id, item.message_id, item.key_id, myUserId);
  return (
    <Pressable style={styles.documentRow} onPress={() => url && openDocument(url)} disabled={!url}>
      <Text style={styles.documentGlyph}>📄</Text>
      <Text style={styles.documentName} numberOfLines={1}>
        {item.file_name || 'Document'}
      </Text>
    </Pressable>
  );
}

export default function MediaGalleryScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const { colors: accentColors } = useAccentTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('message_media')
      .select('*, messages!inner(chat_id, sender_id, key_id)')
      .eq('messages.chat_id', chatId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const rows = (data ?? []).map((row: any) => ({
          ...row,
          message_id: row.message_id,
          chat_id: row.messages.chat_id,
          sender_id: row.messages.sender_id,
          key_id: row.messages.key_id,
        }));
        setItems(rows);
        setLoading(false);
      });
  }, [chatId]);

  const photos = items.filter(
    (i) => i.kind === 'photo' || i.kind === 'video' || i.kind === 'gif' || i.kind === 'sticker'
  );
  const documents = items.filter((i) => i.kind === 'document');

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader title="Media, links and docs" />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={accentColors.accent} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Nothing shared in this chat yet.</Text>
        </View>
      ) : (
        <FlatList
          data={documents.length > 0 ? [{ kind: 'grid' as const }, { kind: 'docs' as const }] : [{ kind: 'grid' as const }]}
          keyExtractor={(item) => item.kind}
          renderItem={({ item }) =>
            item.kind === 'grid' ? (
              <FlatList
                data={photos}
                keyExtractor={(m) => m.id}
                numColumns={COLUMNS}
                scrollEnabled={false}
                renderItem={({ item: media }) => (
                  <GridTile item={media} ownMessage={media.sender_id === profile?.id} myUserId={profile?.id ?? null} />
                )}
              />
            ) : (
              <View style={styles.documentsSection}>
                <Text style={styles.sectionLabel}>Documents</Text>
                {documents.map((doc) => (
                  <DocumentRow key={doc.id} item={doc} myUserId={profile?.id ?? null} />
                ))}
              </View>
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: space[8],
  },
  gridTile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderWidth: 0.5,
    borderColor: colors.bg,
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  playGlyph: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -12,
    marginLeft: -8,
    color: colors.text,
    fontSize: 20,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 6,
  },
  documentsSection: {
    padding: space[4],
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 0.4,
    paddingBottom: space[2],
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  documentGlyph: {
    fontSize: 22,
  },
  documentName: {
    color: colors.text,
    fontSize: 14,
    flex: 1,
  },
});
