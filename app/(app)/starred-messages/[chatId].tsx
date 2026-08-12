import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import { unstarMessage } from '../../../lib/chatActions';
import { decryptTextField, isEncryptedRow } from '../../../lib/crypto';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { StarIcon } from '../../../components/icons';
import { useAccentTheme } from '../../../lib/accentTheme';
import { colors, space } from '../../../lib/theme';

interface StarredItem {
  message_id: string;
  sender_id: string;
  body: string | null;
  created_at: string;
  deleted_at: string | null;
}

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function StarredMessagesScreen() {
  const { colors: accentColors } = useAccentTheme();
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [items, setItems] = useState<StarredItem[]>([]);
  const [namesById, setNamesById] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  function load() {
    if (!profile) return;
    supabase
      .from('message_stars')
      .select(
        'message_id, messages!inner(chat_id, sender_id, body, created_at, deleted_at, enc_v, key_id, ciphertext)'
      )
      .eq('messages.chat_id', chatId)
      .eq('user_id', profile.id)
      .order('starred_at', { ascending: false })
      .then(async ({ data }) => {
        const rows = await Promise.all(
          (data ?? []).map(async (row: any) => {
            const m = row.messages;
            const body = isEncryptedRow(m)
              ? await decryptTextField({
                  chatId: m.chat_id,
                  messageId: row.message_id,
                  senderId: m.sender_id,
                  plaintextBody: m.body,
                  encrypted: { enc_v: m.enc_v, key_id: m.key_id, ciphertext: m.ciphertext },
                  myUserId: profile.id,
                })
              : m.body;
            return {
              message_id: row.message_id,
              sender_id: m.sender_id,
              body,
              created_at: m.created_at,
              deleted_at: m.deleted_at,
            };
          })
        );
        setItems(rows);
        setLoading(false);
      });

    supabase
      .from('chat_members')
      .select('user_id, users(display_name)')
      .eq('chat_id', chatId)
      .then(({ data }) => {
        const map = new Map<string, string>();
        for (const row of data ?? []) {
          const name = (row.users as unknown as { display_name: string } | null)?.display_name;
          if (name) map.set(row.user_id, name);
        }
        setNamesById(map);
      });
  }

  useEffect(() => {
    load();
  }, [chatId, profile?.id]);

  async function handleUnstar(messageId: string) {
    if (!profile) return;
    setItems((prev) => prev.filter((i) => i.message_id !== messageId));
    await unstarMessage(messageId, profile.id);
  }

  function previewFor(item: StarredItem) {
    if (item.deleted_at) return 'This message was deleted';
    if (item.body) return item.body;
    return 'Media message';
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader title="Starred messages" />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={accentColors.accent} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.message_id}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>
                Long-press any message in this chat to star it, and it'll show up here.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => router.push(`/(app)/chat/${chatId}`)}>
              <View style={styles.rowText}>
                <Text style={styles.sender}>{namesById.get(item.sender_id) ?? 'Unknown'}</Text>
                <Text style={styles.preview} numberOfLines={2}>
                  {previewFor(item)}
                </Text>
                <Text style={styles.timestamp}>{formatTimestamp(item.created_at)}</Text>
              </View>
              <Pressable onPress={() => handleUnstar(item.message_id)} hitSlop={8} style={styles.starGlyph}>
                <StarIcon size={18} color={accentColors.accent} filled />
              </Pressable>
            </Pressable>
          )}
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
    padding: space[8],
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: space[6],
    paddingVertical: space[4],
    gap: space[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowText: {
    flex: 1,
  },
  sender: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: space[1],
  },
  preview: {
    color: colors.text,
    fontSize: 15,
  },
  timestamp: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: space[1],
  },
  starGlyph: {
    marginTop: space[1],
  },
});
