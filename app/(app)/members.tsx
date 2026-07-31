import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { useMembers } from '../../lib/hooks/useMembers';
import { supabase } from '../../lib/supabase';
import { MemberRow } from '../../components/MemberRow';
import { colors, fontWeight, space } from '../../lib/theme';

export default function MembersScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { members, loading } = useMembers(profile?.id);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [startingDm, setStartingDm] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function startDirectMessage(userId: string) {
    setStartingDm(userId);
    const { data, error } = await supabase.rpc('find_or_create_dm', { other_user_id: userId });
    setStartingDm(null);
    if (error || !data) return;
    router.replace('/(app)');
    router.push(`/(app)/chat/${data}`);
  }

  function goToNewGroup() {
    router.push({ pathname: '/(app)/new-group', params: { memberIds: Array.from(selected).join(',') } });
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>New Chat</Text>
        <Pressable onPress={goToNewGroup} hitSlop={8}>
          <Text style={styles.action}>New Group{selected.size > 0 ? ` (${selected.size})` : ''}</Text>
        </Pressable>
      </View>
      <View style={styles.headerRule} />

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: space[8] }} />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <MemberRow
              member={item}
              onPress={() => startDirectMessage(item.id)}
              checkbox={{ checked: selected.has(item.id), onToggle: () => toggle(item.id) }}
              trailing={startingDm === item.id ? <ActivityIndicator color={colors.accent} /> : null}
            />
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
    width: 28,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: fontWeight.medium,
  },
  action: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },
  headerRule: {
    height: 2,
    backgroundColor: colors.divider,
  },
});
