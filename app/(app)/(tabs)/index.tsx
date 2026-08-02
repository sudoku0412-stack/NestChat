import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../../lib/auth';
import { useChatList } from '../../../lib/hooks/useChatList';
import { supabase } from '../../../lib/supabase';
import { ChatRow } from '../../../components/ChatRow';
import { colors, fontWeight, space } from '../../../lib/theme';
import { useThemeMode } from '../../../lib/themeMode';

export default function ChatListScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { chats, loading, refresh } = useChatList(profile?.id ?? null);
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const { bg } = useThemeMode();

  async function handleMuteToggle(chatId: string, muted: boolean) {
    if (!profile) return;
    await supabase
      .from('chat_members')
      .update({ muted: !muted })
      .eq('chat_id', chatId)
      .eq('user_id', profile.id);
    refresh();
  }

  async function handleDelete(chatId: string) {
    if (!profile) return;
    await supabase.from('chat_members').delete().eq('chat_id', chatId).eq('user_id', profile.id);
    refresh();
  }

  async function handleArchive(chatId: string) {
    if (!profile) return;
    await supabase
      .from('chat_members')
      .update({ archived: true })
      .eq('chat_id', chatId)
      .eq('user_id', profile.id);
    refresh();
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: bg }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chats</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.iconButton} onPress={() => router.push('/(app)/members')}>
            <Text style={styles.icon}>＋</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.headerRule} />

      <FlatList
        data={chats}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={refresh}
        renderItem={({ item }) => (
          <ChatRow
            chat={item}
            isOpen={openRowId === item.id}
            onOpenChange={(open) => setOpenRowId(open ? item.id : null)}
            onPress={() => router.push(`/(app)/chat/${item.id}`)}
            onMuteToggle={() => handleMuteToggle(item.id, item.muted)}
            onDelete={() => handleDelete(item.id)}
            onArchive={() => handleArchive(item.id)}
          />
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No chats yet. Tap ＋ to message a household member.</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space[6],
    paddingVertical: space[4],
  },
  headerTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: fontWeight.heading,
  },
  headerActions: {
    flexDirection: 'row',
    gap: space[4],
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    color: colors.text,
    fontSize: 20,
  },
  headerRule: {
    height: 2,
    backgroundColor: colors.divider,
  },
  empty: {
    padding: space[8],
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 14,
  },
});
