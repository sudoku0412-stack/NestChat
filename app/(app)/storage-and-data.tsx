import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAccentTheme } from '../../lib/accentTheme';
import { colors, space } from '../../lib/theme';

interface ChatUsage {
  chatId: string;
  label: string;
  bytes: number;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function StorageAndDataScreen() {
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useAuth();
  const { colors: accentColors } = useAccentTheme();
  const [usage, setUsage] = useState<ChatUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [autodownload, setAutodownload] = useState(profile?.media_autodownload !== 'never');

  useEffect(() => {
    async function load() {
      const { data: mediaRows } = await supabase
        .from('message_media')
        .select('file_size, messages!inner(chat_id)');

      const bytesByChat = new Map<string, number>();
      for (const row of (mediaRows as any[]) ?? []) {
        const chatId = row.messages.chat_id as string;
        bytesByChat.set(chatId, (bytesByChat.get(chatId) ?? 0) + (row.file_size ?? 0));
      }

      const chatIds = [...bytesByChat.keys()];
      if (chatIds.length === 0) {
        setLoading(false);
        return;
      }

      const [{ data: chatRows }, { data: memberRows }] = await Promise.all([
        supabase.from('chats').select('id, type, name').in('id', chatIds),
        supabase.from('chat_members').select('chat_id, user_id, users(display_name)').in('chat_id', chatIds),
      ]);

      const membersByChat = new Map<string, { userId: string; name: string }[]>();
      for (const row of memberRows ?? []) {
        const list = membersByChat.get(row.chat_id) ?? [];
        const name = (row.users as unknown as { display_name: string } | null)?.display_name;
        if (name) list.push({ userId: row.user_id, name });
        membersByChat.set(row.chat_id, list);
      }

      const rows: ChatUsage[] = (chatRows ?? []).map((chat) => {
        const label =
          chat.type === 'group'
            ? chat.name ?? 'Group'
            : (membersByChat.get(chat.id) ?? []).find((m) => m.userId !== profile?.id)?.name ?? 'Chat';
        return { chatId: chat.id, label, bytes: bytesByChat.get(chat.id) ?? 0 };
      });
      rows.sort((a, b) => b.bytes - a.bytes);
      setUsage(rows);
      setLoading(false);
    }
    load();
  }, [profile?.id]);

  async function toggleAutodownload(value: boolean) {
    if (!profile) return;
    setAutodownload(value);
    await supabase
      .from('users')
      .update({ media_autodownload: value ? 'always' : 'never' })
      .eq('id', profile.id);
    refreshProfile();
  }

  const totalBytes = usage.reduce((sum, u) => sum + u.bytes, 0);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader title="Storage and data" />

      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>Auto-download media</Text>
        <Switch
          value={autodownload}
          onValueChange={toggleAutodownload}
          trackColor={{ true: accentColors.accent700, false: colors.neutral800 }}
          thumbColor={colors.text}
        />
      </View>
      <Text style={styles.caption}>
        When off, photos, videos and documents wait for a tap before downloading and decrypting --
        manual viewing always still works.
      </Text>

      <Text style={styles.sectionLabel}>
        Media storage {loading ? '' : `(${formatBytes(totalBytes)} total)`}
      </Text>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={accentColors.accent} />
        </View>
      ) : usage.length === 0 ? (
        <Text style={styles.caption}>No media sent or received yet.</Text>
      ) : (
        usage.map((u) => (
          <Pressable key={u.chatId} style={styles.row} onPress={() => router.push(`/(app)/media-gallery/${u.chatId}`)}>
            <Text style={styles.rowLabel}>{u.label}</Text>
            <Text style={styles.rowValue}>{formatBytes(u.bytes)}</Text>
          </Pressable>
        ))
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
    padding: space[8],
    alignItems: 'center',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[6],
    paddingVertical: space[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  settingLabel: {
    color: colors.text,
    fontSize: 15,
  },
  caption: {
    color: colors.textMuted,
    fontSize: 12,
    paddingHorizontal: space[6],
    paddingTop: space[2],
    lineHeight: 17,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 0.4,
    paddingHorizontal: space[6],
    paddingTop: space[6],
    paddingBottom: space[2],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[6],
    paddingVertical: space[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowLabel: {
    color: colors.text,
    fontSize: 15,
  },
  rowValue: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
