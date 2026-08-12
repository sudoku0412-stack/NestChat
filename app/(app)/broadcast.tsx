import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { useMembers } from '../../lib/hooks/useMembers';
import { supabase } from '../../lib/supabase';
import { sendBroadcastText } from '../../lib/broadcast';
import { decryptTextField, isEncryptedRow } from '../../lib/crypto';
import { MemberRow } from '../../components/MemberRow';
import { useAccentTheme } from '../../lib/accentTheme';
import { colors, fontWeight, space } from '../../lib/theme';
import type { BroadcastListsRow } from '../../lib/database.types';

interface SendLogItem {
  sendId: string;
  createdAt: string;
  recipientCount: number;
  listName: string | null;
  preview: string;
}

export default function BroadcastScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { colors: accentColors } = useAccentTheme();
  const { members, loading: membersLoading } = useMembers(profile?.id);
  const [lists, setLists] = useState<BroadcastListsRow[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [log, setLog] = useState<SendLogItem[]>([]);
  const [logLoading, setLogLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('broadcast_lists')
      .select('*')
      .eq('owner_id', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setLists((data as BroadcastListsRow[]) ?? []));
    loadLog();
  }, [profile?.id]);

  async function loadLog() {
    if (!profile) return;
    const { data: sendRows } = await supabase
      .from('broadcast_sends')
      .select('id, created_at, list_id')
      .eq('sender_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(20);
    const sends = (sendRows as { id: string; created_at: string; list_id: string | null }[]) ?? [];
    if (sends.length === 0) {
      setLog([]);
      setLogLoading(false);
      return;
    }

    // Three batched .in() queries instead of up to 3 sequential round trips per send (targets,
    // message, list name) -- fixed cost regardless of how many of the 20 sends there are.
    const sendIds = sends.map((s) => s.id);
    const { data: targetRows } = await supabase
      .from('broadcast_send_targets')
      .select('send_id, message_id')
      .in('send_id', sendIds);

    const targetsBySend = new Map<string, string[]>();
    for (const row of targetRows ?? []) {
      const list = targetsBySend.get(row.send_id) ?? [];
      list.push(row.message_id);
      targetsBySend.set(row.send_id, list);
    }

    const firstMessageIds = [...targetsBySend.values()].map((ids) => ids[0]).filter(Boolean);
    const { data: messageRows } = firstMessageIds.length
      ? await supabase
          .from('messages')
          .select('id, chat_id, sender_id, body, enc_v, key_id, ciphertext')
          .in('id', firstMessageIds)
      : { data: [] };
    const messagesById = new Map((messageRows ?? []).map((m) => [m.id, m]));

    const listIds = [...new Set(sends.map((s) => s.list_id).filter((id): id is string => !!id))];
    const { data: listRows } = listIds.length
      ? await supabase.from('broadcast_lists').select('id, name').in('id', listIds)
      : { data: [] };
    const listNamesById = new Map((listRows ?? []).map((l) => [l.id, l.name]));

    const items = await Promise.all(
      sends.map(async (send) => {
        const targetIds = targetsBySend.get(send.id) ?? [];
        const recipientCount = targetIds.length;

        let preview = 'Media message';
        const message = targetIds[0] ? messagesById.get(targetIds[0]) : null;
        if (message) {
          const decrypted = isEncryptedRow(message)
            ? await decryptTextField({
                chatId: message.chat_id,
                messageId: message.id,
                senderId: message.sender_id,
                plaintextBody: message.body,
                encrypted: { enc_v: message.enc_v, key_id: message.key_id, ciphertext: message.ciphertext },
                myUserId: profile.id,
              })
            : message.body;
          preview = decrypted ?? preview;
        }

        return {
          sendId: send.id,
          createdAt: send.created_at,
          recipientCount,
          listName: send.list_id ? listNamesById.get(send.list_id) ?? null : null,
          preview,
        };
      })
    );
    setLog(items);
    setLogLoading(false);
  }

  function toggleMember(id: string) {
    setSelectedListId(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function selectList(list: BroadcastListsRow) {
    setSelectedListId(list.id);
    const { data } = await supabase.from('broadcast_list_members').select('member_id').eq('list_id', list.id);
    setSelected(new Set((data ?? []).map((r) => r.member_id)));
  }

  async function handleSend() {
    if (!profile || !body.trim() || selected.size === 0) return;
    setSending(true);
    try {
      const result = await sendBroadcastText(Array.from(selected), profile.id, body.trim(), selectedListId);
      setBody('');
      setSelected(new Set());
      setSelectedListId(null);
      await loadLog();
      if (result.failed.length > 0) {
        Alert.alert('Sent with some failures', `${result.sent} sent, ${result.failed.length} failed.`);
      }
    } catch (err) {
      Alert.alert('Could not send broadcast', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Broadcast messages</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.headerRule} />

      <FlatList
        data={members}
        keyExtractor={(m) => m.id}
        ListHeaderComponent={
          <>
            {lists.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Send to a saved list</Text>
                <FlatList
                  horizontal
                  data={lists}
                  keyExtractor={(l) => l.id}
                  contentContainerStyle={styles.chipRow}
                  renderItem={({ item }) => (
                    <Pressable
                      style={[
                        styles.chip,
                        selectedListId === item.id && { backgroundColor: accentColors.accent, borderColor: accentColors.accent },
                      ]}
                      onPress={() => selectList(item)}
                    >
                      <Text style={[styles.chipLabel, selectedListId === item.id && { color: colors.text }]}>
                        {item.name}
                      </Text>
                    </Pressable>
                  )}
                />
              </>
            )}
            <Text style={styles.sectionLabel}>Or pick people ({selected.size})</Text>
          </>
        }
        renderItem={({ item }) => (
          <MemberRow
            member={item}
            onPress={() => toggleMember(item.id)}
            checkbox={{ checked: selected.has(item.id), onToggle: () => toggleMember(item.id) }}
          />
        )}
        ListFooterComponent={
          <>
            <View style={styles.composeRow}>
              <TextInput
                style={styles.composeInput}
                placeholder="Message"
                placeholderTextColor={colors.textMuted}
                value={body}
                onChangeText={setBody}
                multiline
              />
              <Pressable
                onPress={handleSend}
                disabled={sending || !body.trim() || selected.size === 0}
                style={styles.sendButton}
              >
                {sending ? (
                  <ActivityIndicator color={accentColors.accent} />
                ) : (
                  <Text
                    style={[
                      styles.sendLabel,
                      { color: accentColors.accent },
                      (!body.trim() || selected.size === 0) && styles.sendLabelDisabled,
                    ]}
                  >
                    Send
                  </Text>
                )}
              </Pressable>
            </View>

            <Text style={styles.sectionLabel}>Recent broadcasts</Text>
            {logLoading ? (
              <ActivityIndicator color={accentColors.accent} style={{ marginTop: space[4] }} />
            ) : log.length === 0 ? (
              <Text style={styles.emptyText}>Nothing sent yet.</Text>
            ) : (
              log.map((item) => (
                <View key={item.sendId} style={styles.logRow}>
                  <Text style={styles.logLabel}>
                    {item.listName ?? 'Ad-hoc'} · {item.recipientCount} recipient{item.recipientCount === 1 ? '' : 's'}
                  </Text>
                  <Text style={styles.logPreview} numberOfLines={1}>
                    {item.preview}
                  </Text>
                </View>
              ))
            )}
          </>
        }
      />

      {membersLoading && <ActivityIndicator color={accentColors.accent} style={{ marginTop: space[4] }} />}
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
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 0.4,
    paddingHorizontal: space[6],
    paddingTop: space[6],
    paddingBottom: space[2],
  },
  chipRow: {
    paddingHorizontal: space[6],
    gap: space[2],
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 999,
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    marginRight: space[2],
  },
  chipLabel: {
    color: colors.text,
    fontSize: 14,
  },
  composeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space[3],
    paddingHorizontal: space[6],
    paddingVertical: space[4],
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.divider,
  },
  composeInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    maxHeight: 120,
    paddingVertical: space[2],
  },
  sendButton: {
    paddingVertical: space[2],
  },
  sendLabel: {
    fontSize: 15,
    fontWeight: fontWeight.semibold,
  },
  sendLabelDisabled: {
    color: colors.textMuted,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    paddingHorizontal: space[6],
  },
  logRow: {
    paddingHorizontal: space[6],
    paddingVertical: space[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  logLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  logPreview: {
    color: colors.text,
    fontSize: 15,
    marginTop: 2,
  },
});
