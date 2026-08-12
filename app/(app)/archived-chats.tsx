import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { useChatList } from '../../lib/hooks/useChatList';
import { supabase } from '../../lib/supabase';
import { ChatRow } from '../../components/ChatRow';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, space } from '../../lib/theme';

export default function ArchivedChatsScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { chats, loading, refresh } = useChatList(profile?.id ?? null, { archived: true });
  const [openRowId, setOpenRowId] = useState<string | null>(null);

  async function handleMuteToggle(chatId: string, muted: boolean) {
    if (!profile) return;
    await supabase.from('chat_members').update({ muted: !muted }).eq('chat_id', chatId).eq('user_id', profile.id);
    refresh();
  }

  async function handleDelete(chatId: string) {
    if (!profile) return;
    await supabase.from('chat_members').delete().eq('chat_id', chatId).eq('user_id', profile.id);
    refresh();
  }

  async function handleUnarchive(chatId: string) {
    if (!profile) return;
    await supabase
      .from('chat_members')
      .update({ archived: false })
      .eq('chat_id', chatId)
      .eq('user_id', profile.id);
    refresh();
  }

  async function handleFavoriteToggle(chatId: string, favorite: boolean) {
    if (!profile) return;
    await supabase
      .from('chat_members')
      .update({ favorite: !favorite })
      .eq('chat_id', chatId)
      .eq('user_id', profile.id);
    refresh();
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader title="Archived" />

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
            onArchive={() => handleUnarchive(item.id)}
            onFavoriteToggle={() => handleFavoriteToggle(item.id, item.favorite)}
            isArchived
          />
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No archived chats.</Text>
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
