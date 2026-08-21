import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../../lib/auth';
import { useChatList } from '../../../lib/hooks/useChatList';
import { supabase } from '../../../lib/supabase';
import { ChatRow } from '../../../components/ChatRow';
import { CloseIcon, PlusIcon, SearchIcon } from '../../../components/icons';
import { useAccentTheme } from '../../../lib/accentTheme';
import { colors, fonts, fontWeight, radius, space } from '../../../lib/theme';
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
            <CloseIcon size={20} color={colors.text} />
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
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={refresh}
        ListHeaderComponent={
          <View>
            <View style={styles.searchRow}>
              <SearchIcon size={16} color={colors.textMuted} />
              <TextInput
                style={styles.search}
                value={query}
                onChangeText={setQuery}
                placeholder="Search chats"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={styles.chipsRow}>
              {FILTERS.map((f) => (
                <Pressable
                  key={f.key}
                  style={[styles.chip, filter === f.key && { backgroundColor: accentColors.accent }]}
                  onPress={() => setFilter(f.key)}
                >
                  <Text
                    style={[
                      styles.chipLabel,
                      filter === f.key && [styles.chipLabelActive, { color: accentColors.accent100 }],
                    ]}
                  >
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
            showPresence={
              item.type !== 'group' &&
              !!profile?.show_read_receipts &&
              !!item.avatarMembers[0]?.show_read_receipts &&
              !!item.avatarMembers[0]?.is_online
            }
          />
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {query || filter !== 'all'
                  ? 'No chats match.'
                  : 'No chats yet. Tap the + button to message a household member.'}
              </Text>
            </View>
          ) : null
        }
      />

      {!selectMode && (
        <Pressable
          style={[styles.fab, { backgroundColor: accentColors.accent }]}
          onPress={() => router.push('/(app)/members')}
        >
          <PlusIcon size={22} color={accentColors.accent100} />
        </Pressable>
      )}
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    marginHorizontal: space[6],
    marginTop: space[4],
    paddingHorizontal: space[4],
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
  },
  search: {
    flex: 1,
    paddingVertical: space[3],
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
    fontWeight: fontWeight.semibold,
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
  fab: {
    position: 'absolute',
    right: space[6],
    bottom: space[8],
    width: 56,
    height: 56,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
