import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ChevronRightIcon } from '../../components/icons';
import { useAccentTheme } from '../../lib/accentTheme';
import { colors, fontWeight, space } from '../../lib/theme';
import type { BroadcastListsRow } from '../../lib/database.types';

interface ListRow extends BroadcastListsRow {
  memberCount: number;
}

export default function ListsScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { colors: accentColors } = useAccentTheme();
  const [lists, setLists] = useState<ListRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!profile) return;
    const { data: listRows } = await supabase
      .from('broadcast_lists')
      .select('*')
      .eq('owner_id', profile.id)
      .order('created_at', { ascending: false });

    const { data: memberRows } = await supabase.from('broadcast_list_members').select('list_id');
    const counts = new Map<string, number>();
    for (const row of memberRows ?? []) {
      counts.set(row.list_id, (counts.get(row.list_id) ?? 0) + 1);
    }

    setLists(((listRows as BroadcastListsRow[]) ?? []).map((l) => ({ ...l, memberCount: counts.get(l.id) ?? 0 })));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [profile?.id]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="Lists"
        right={
          // stale .expo/types/router.d.ts predates this route -- see settings.tsx's MENU_ROWS comment
          <Pressable onPress={() => router.push('/(app)/list-edit/new' as any)} hitSlop={8}>
            <Text style={[styles.action, { color: accentColors.accent }]}>New</Text>
          </Pressable>
        }
      />

      {loading ? (
        <ActivityIndicator color={accentColors.accent} style={{ marginTop: space[8] }} />
      ) : (
        <FlatList
          data={lists}
          keyExtractor={(l) => l.id}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>
                Create a list to quickly broadcast one message to a saved group of people.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => router.push(`/(app)/list-edit/${item.id}` as any)}>
              <View>
                <Text style={styles.rowLabel}>{item.name}</Text>
                <Text style={styles.rowSub}>{item.memberCount} member{item.memberCount === 1 ? '' : 's'}</Text>
              </View>
              <ChevronRightIcon size={18} color={colors.textMuted} />
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
  action: {
    fontSize: 15,
    fontWeight: fontWeight.semibold,
  },
  centered: {
    padding: space[8],
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[6],
    paddingVertical: space[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowLabel: {
    color: colors.text,
    fontSize: 16,
  },
  rowSub: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
});
