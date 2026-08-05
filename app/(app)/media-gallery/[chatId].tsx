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
import { useAuth } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import { useSignedUrl } from '../../../lib/hooks/useSignedUrl';
import { colors, fontWeight, space } from '../../../lib/theme';
import { useAccentTheme } from '../../../lib/accentTheme';
import type { MessageMediaRow } from '../../../lib/database.types';

type GalleryItem = MessageMediaRow & { message_id: string; sender_id: string };

const COLUMNS = 3;
const TILE_SIZE = Dimensions.get('window').width / COLUMNS;

function GridTile({ item, ownMessage }: { item: GalleryItem; ownMessage: boolean }) {
  const url = useSignedUrl(item.storage_path);
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

function DocumentRow({ item }: { item: GalleryItem }) {
  const url = useSignedUrl(item.storage_path);
  return (
    <Pressable style={styles.documentRow} onPress={() => url && Linking.openURL(url)} disabled={!url}>
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
      .select('*, messages!inner(chat_id, sender_id)')
      .eq('messages.chat_id', chatId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const rows = (data ?? []).map((row: any) => ({
          ...row,
          message_id: row.message_id,
          sender_id: row.messages.sender_id,
        }));
        setItems(rows);
        setLoading(false);
      });
  }, [chatId]);

  const photos = items.filter((i) => i.kind === 'photo' || i.kind === 'video' || i.kind === 'gif');
  const documents = items.filter((i) => i.kind === 'document');

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Media, links and docs</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.headerRule} />

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
                  <GridTile item={media} ownMessage={media.sender_id === profile?.id} />
                )}
              />
            ) : (
              <View style={styles.documentsSection}>
                <Text style={styles.sectionLabel}>Documents</Text>
                {documents.map((doc) => (
                  <DocumentRow key={doc.id} item={doc} />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[6],
    paddingVertical: space[4],
  },
  back: {
    color: colors.text,
    fontSize: 28,
    width: 24,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: fontWeight.medium,
  },
  headerRule: {
    height: 2,
    backgroundColor: colors.divider,
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
