import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../lib/auth';
import { useMembers } from '../../../lib/hooks/useMembers';
import { supabase } from '../../../lib/supabase';
import { getIdentityKeyPair, rewrapChatKeyForMembers, rotateChatKeyOnRemoval } from '../../../lib/crypto';
import { GroupAvatarStack } from '../../../components/Avatar';
import { MemberRow } from '../../../components/MemberRow';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { CloseIcon } from '../../../components/icons';
import { useAccentTheme } from '../../../lib/accentTheme';
import { useTheme } from '../../../lib/themeMode';
import { fontWeight, space } from '../../../lib/theme';
import type { Member } from '../../../lib/types';

export default function GroupInfoScreen() {
  const theme = useTheme();
  const { colors: accentColors } = useAccentTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { members: household } = useMembers(profile?.id);
  const [groupName, setGroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState<Member[]>([]);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    const [{ data: chat }, { data: memberRows }] = await Promise.all([
      supabase.from('chats').select('name').eq('id', id).single(),
      supabase.from('chat_members').select('users(*)').eq('chat_id', id),
    ]);
    setGroupName(chat?.name ?? '');
    setGroupMembers(((memberRows ?? []).map((r) => r.users) as unknown as Member[]).filter(Boolean));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [id]);

  const memberIds = new Set(groupMembers.map((m) => m.id));
  const addable = household.filter((m) => !memberIds.has(m.id));

  async function removeMember(userId: string) {
    await supabase.from('chat_members').delete().eq('chat_id', id).eq('user_id', userId);
    // Rotates the chat key forward so the removed member can't read anything encrypted from now
    // on -- remaining members keep their existing wrap of the old key, so history stays readable.
    const remainingIds = groupMembers.map((m) => m.id).filter((memberId) => memberId !== userId);
    try {
      await rotateChatKeyOnRemoval(id, remainingIds);
    } catch (err) {
      console.warn('rotateChatKeyOnRemoval failed', err);
    }
    load();
  }

  async function addMember(userId: string) {
    await supabase.from('chat_members').insert({ chat_id: id, user_id: userId });
    setAdding(false);
    if (profile) {
      const identity = await getIdentityKeyPair();
      if (identity) {
        try {
          await rewrapChatKeyForMembers(id, [userId], identity, profile.id);
        } catch (err) {
          console.warn('rewrapChatKeyForMembers failed', err);
        }
      }
    }
    load();
  }

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={accentColors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: theme.bg }]}>
      <ScreenHeader title="Group info" theme={theme} />

      <View style={styles.summary}>
        <GroupAvatarStack members={groupMembers} size={64} />
        <Text style={[styles.groupName, { color: theme.text }]}>{groupName}</Text>
        <Text style={[styles.memberCount, { color: theme.textMuted }]}>{groupMembers.length} members</Text>
      </View>

      {adding ? (
        <>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Add a member</Text>
          <FlatList
            data={addable}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => <MemberRow member={item} onPress={() => addMember(item.id)} />}
            ListEmptyComponent={<Text style={[styles.emptyText, { color: theme.textMuted }]}>Everyone is already in this group.</Text>}
          />
          <Pressable style={styles.cancelAdd} onPress={() => setAdding(false)}>
            <Text style={[styles.cancelAddText, { color: theme.textMuted }]}>Cancel</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Members ({groupMembers.length})</Text>
          <FlatList
            data={groupMembers}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => (
              <MemberRow
                member={item}
                trailing={
                  item.id !== profile?.id ? (
                    <Pressable
                      onPress={() => removeMember(item.id)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${item.display_name}`}
                    >
                      <CloseIcon size={16} color={theme.danger} />
                    </Pressable>
                  ) : null
                }
              />
            )}
          />
          <Pressable style={styles.addRow} onPress={() => setAdding(true)}>
            <Text style={[styles.addLabel, { color: accentColors.accent }]}>+ Add member</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: {
    alignItems: 'center',
    paddingVertical: space[8],
    gap: space[2],
  },
  groupName: {
    fontSize: 20,
    fontWeight: fontWeight.heading,
  },
  memberCount: {
    fontSize: 13,
  },
  sectionLabel: {
    fontSize: 12,
    letterSpacing: 0.4,
    paddingHorizontal: space[6],
    paddingBottom: space[2],
  },
  addRow: {
    paddingHorizontal: space[6],
    paddingVertical: space[4],
  },
  addLabel: {
    fontSize: 15,
    fontWeight: fontWeight.semibold,
  },
  cancelAdd: {
    paddingHorizontal: space[6],
    paddingVertical: space[4],
  },
  cancelAddText: {
    fontSize: 15,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    padding: space[6],
  },
});
