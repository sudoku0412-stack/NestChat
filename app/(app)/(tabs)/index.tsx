import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../../lib/auth';
import { useChatList } from '../../../lib/hooks/useChatList';
import { supabase } from '../../../lib/supabase';
import { ChatRow } from '../../../components/ChatRow';
import { useAccentTheme } from '../../../lib/accentTheme';
import { colors, fonts, radius, space } from '../../../lib/theme';
import { useThemeMode } from '../../../lib/themeMode';

type Filter = 'all' | 'unread' | 'groups' | 'favorites';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'groups', label: 'Groups' },
  { key: 'favorites', label: 'Favorites' },
];

export default function ChatListScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { colors: accentColors } = useAccentTheme();
  const { chats, loading, refresh } = useChatList(profile?.id ?? null);
  const { chats: archivedChats } = useChatList(profile?.id ?? null, { archived: true });
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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

  async function handleFavoriteToggle(chatId: string, favorite: boolean) {
    if (!profile) return;
    await supabase
      .from('chat_members')
      .update({ favorite: !favorite })
      .eq('chat_id', chatId)
      .eq('user_id', profile.id);
    refresh();
  }

  function enterSelectMode(chatId: string) {
    setSelectMode(true);
    setSelectedIds(new Set([chatId]));
  }

  function toggleSelected(chatId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(chatId)) next.delete(chatId);
      else next.add(chatId);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  async function bulkApply(update: { muted?: boolean; archived?: boolean } | 'delete') {
    if (!profile || selectedIds.size === 0) return;
    const ids = [...selectedIds];
    if (update === 'delete') {
      await Promise.all(
        ids.map((id) => supabase.from('chat_members').delete().eq('chat_id', id).eq('user_id', profile.id))
      );
    } else {
      await Promise.all(
        ids.map((id) =>
          supabase.from('chat_members').update(update).eq('chat_id', id).eq('user_id', profile.id)
        )
      );
    }
    exitSelectMode();
    refresh();
  }

  const filtered = chats.filter((chat) => {
    if (filter === 'unread' && chat.unreadCount === 0) return false;
    if (filter === 'groups' && chat.type !== 'group') return false;
    if (filter === 'favorites' && !chat.favorite) return false;
    if (query.trim() && !chat.title.toLowerCase().includes(query.trim().toLowerCase())) return false;
    return true;
  });

  return (
    <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: bg }]}>
      {selectMode ? (
        <View style={styles.header}>
          <Pressable onPress={exitSelectMode} hitSlop={8}>
            <Text style={styles.cancelGlyph}>✕</Text>
          </Pressable>
          <Text style={styles.selectCount}>{selectedIds.size} selected</Text>
          <View style={styles.headerActions}>
            <Pressable onPress={() => bulkApply({ muted: true })} hitSlop={8}>
              <Text style={[styles.selectAction, { color: accentColors.accent }]}>Mute</Text>
            </Pressable>
            <Pressable onPress={() => bulkApply({ archived: true })} hitSlop={8}>
              <Text style={[styles.selectAction, { color: accentColors.accent }]}>Archive</Text>
            </Pressable>
            <Pressable onPress={() => bulkApply('delete')} hitSlop={8}>
              <Text style={[styles.selectAction, styles.selectActionDanger]}>Delete</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Chats</Text>
          <View style={styles.headerActions}>
            <Pressable style={styles.iconButton} onPress={() => router.push('/(app)/members')}>
              <Text style={styles.icon}>＋</Text>
            </Pressable>
          </View>
        </View>
      )}
      <View style={styles.headerRule} />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={refresh}
        ListHeaderComponent={
          <View>
            <TextInput
              style={styles.search}
              value={query}
              onChangeText={setQuery}
              placeholder="Search chats"
              placeholderTextColor={colors.textMuted}
            />
            <View style={styles.chipsRow}>
              {FILTERS.map((f) => (
                <Pressable
                  key={f.key}
                  style={[
                    styles.chip,
                    filter === f.key && { backgroundColor: accentColors.accent700 },
                  ]}
                  onPress={() => setFilter(f.key)}
                >
                  <Text style={[styles.chipLabel, filter === f.key && styles.chipLabelActive]}>
                    {f.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {archivedChats.length > 0 && (
              <Pressable style={styles.archivedRow} onPress={() => router.push('/(app)/archived-chats')}>
                <Text style={styles.archivedLabel}>Archived</Text>
                <Text style={styles.archivedCount}>{archivedChats.length}</Text>
              </Pressable>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <ChatRow
            chat={item}
            isOpen={openRowId === item.id}
            onOpenChange={(open) => setOpenRowId(open ? item.id : null)}
            onPress={() => (selectMode ? toggleSelected(item.id) : router.push(`/(app)/chat/${item.id}`))}
            onLongPress={() => (selectMode ? undefined : enterSelectMode(item.id))}
            onMuteToggle={() => handleMuteToggle(item.id, item.muted)}
            onDelete={() => handleDelete(item.id)}
            onArchive={() => handleArchive(item.id)}
            onFavoriteToggle={() => handleFavoriteToggle(item.id, item.favorite)}
            selectMode={selectMode}
            selected={selectedIds.has(item.id)}
          />
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {query || filter !== 'all'
                  ? 'No chats match.'
                  : 'No chats yet. Tap ＋ to message a household member.'}
              </Text>
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
    fontFamily: fonts.display,
  },
  headerActions: {
    flexDirection: 'row',
    gap: space[4],
    alignItems: 'center',
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
  cancelGlyph: {
    color: colors.text,
    fontSize: 18,
  },
  selectCount: {
    color: colors.text,
    fontSize: 15,
  },
  selectAction: {
    fontSize: 14,
  },
  selectActionDanger: {
    color: colors.danger,
  },
  headerRule: {
    height: 2,
    backgroundColor: colors.divider,
  },
  search: {
    marginHorizontal: space[6],
    marginTop: space[4],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    color: colors.text,
    fontSize: 15,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: space[2],
    paddingHorizontal: space[6],
    paddingVertical: space[4],
  },
  chip: {
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
  chipLabel: {
    color: colors.textMuted,
    fontSize: 13,
  },
  chipLabelActive: {
    color: colors.text,
  },
  archivedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space[6],
    paddingVertical: space[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  archivedLabel: {
    color: colors.text,
    fontSize: 15,
  },
  archivedCount: {
    color: colors.textMuted,
    fontSize: 14,
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
