import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
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
  chat_id: string;
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

// Global, cross-chat view of everything the current user has starred -- the per-chat screen at
// starred-messages/[chatId].tsx stays as-is (still reachable from within a chat); this is purely
// an aggregator on top of the same message_stars/decrypt machinery, not a second source of truth.
export default function AllStarredMessagesScreen() {
  const { colors: accentColors } = useAccentTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [items, setItems] = useState<StarredItem[]>([]);
  const [namesById, setNamesById] = useState<Map<string, string>>(new Map());
  const [chatLabelsById, setChatLabelsById] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!profile) return;
    const { data } = await supabase
      .from('message_stars')
      .select(
        'message_id, messages!inner(chat_id, sender_id, body, created_at, deleted_at, enc_v, key_id, ciphertext)'
      )
      .eq('user_id', profile.id)
      .order('starred_at', { ascending: false });

    const rows = await Promise.all(
      ((data ?? []) as any[]).map(async (row) => {
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
          chat_id: m.chat_id,
          sender_id: m.sender_id,
          body,
          created_at: m.created_at,
          deleted_at: m.deleted_at,
        };
      })
    );
    setItems(rows);
    setLoading(false);

    const chatIds = [...new Set(rows.map((r) => r.chat_id))];
    if (chatIds.length === 0) return;

    const [{ data: chatRows }, { data: memberRows }] = await Promise.all([
      supabase.from('chats').select('id, type, name').in('id', chatIds),
      supabase.from('chat_members').select('chat_id, user_id, users(display_name)').in('chat_id', chatIds),
    ]);

    const nameMap = new Map<string, string>();
    for (const row of memberRows ?? []) {
      const name = (row.users as unknown as { display_name: string } | null)?.display_name;
      if (name) nameMap.set(row.user_id, name);
    }
    setNamesById(nameMap);

    const membersByChat = new Map<string, { userId: string; name: string }[]>();
    for (const row of memberRows ?? []) {
      const list = membersByChat.get(row.chat_id) ?? [];
      const name = (row.users as unknown as { display_name: string } | null)?.display_name;
      if (name) list.push({ userId: row.user_id, name });
      membersByChat.set(row.chat_id, list);
    }

    const labelMap = new Map<string, string>();
    for (const chat of chatRows ?? []) {
      if (chat.type === 'group') {
        labelMap.set(chat.id, chat.name ?? 'Group');
      } else {
        const other = (membersByChat.get(chat.id) ?? []).find((m) => m.userId !== profile.id);
        labelMap.set(chat.id, other?.name ?? 'Chat');
      }
    }
    setChatLabelsById(labelMap);
  }

  useEffect(() => {
    load();
  }, [profile?.id]);

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
                Long-press any message in any chat to star it, and it'll show up here.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => router.push(`/(app)/chat/${item.chat_id}`)}>
              <View style={styles.rowText}>
                <Text style={styles.chatLabel}>
                  {chatLabelsById.get(item.chat_id) ?? '...'} · {namesById.get(item.sender_id) ?? 'Unknown'}
                </Text>
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
  chatLabel: {
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
