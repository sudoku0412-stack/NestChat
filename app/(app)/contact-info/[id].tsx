import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Switch, Text, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import { clearChat } from '../../../lib/chatActions';
import { Avatar } from '../../../components/Avatar';
import { OutlineButton } from '../../../components/OutlineButton';
import { WallpaperPickerModal } from '../../../components/WallpaperPickerModal';
import { useAccentTheme } from '../../../lib/accentTheme';
import { colors, fonts, fontWeight, space } from '../../../lib/theme';
import type { Member } from '../../../lib/types';

function formatLastSeen(iso: string | null) {
  if (!iso) return 'Offline';
  const date = new Date(iso);
  return `Last seen ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

export default function ContactInfoScreen() {
  const { id, chatId } = useLocalSearchParams<{ id: string; chatId?: string }>();
  const { colors: accentColors } = useAccentTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(false);
  const [wallpaperPath, setWallpaperPath] = useState<string | null>(null);
  const [mediaCount, setMediaCount] = useState(0);
  const [starredCount, setStarredCount] = useState(0);
  const [wallpaperModalVisible, setWallpaperModalVisible] = useState(false);

  function loadOwnMembership() {
    if (!chatId || !profile) return;
    supabase
      .from('chat_members')
      .select('muted, wallpaper_path')
      .eq('chat_id', chatId)
      .eq('user_id', profile.id)
      .single()
      .then(({ data }) => {
        setMuted(!!data?.muted);
        setWallpaperPath(data?.wallpaper_path ?? null);
      });
  }

  useEffect(() => {
    supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setMember((data as Member) ?? null);
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    loadOwnMembership();

    if (chatId) {
      supabase
        .from('message_media')
        .select('id, messages!inner(chat_id)', { count: 'exact', head: true })
        .eq('messages.chat_id', chatId)
        .then(({ count }) => setMediaCount(count ?? 0));
    }

    if (chatId && profile) {
      supabase
        .from('message_stars')
        .select('message_id, messages!inner(chat_id)', { count: 'exact', head: true })
        .eq('messages.chat_id', chatId)
        .eq('user_id', profile.id)
        .then(({ count }) => setStarredCount(count ?? 0));
    }
  }, [chatId, profile?.id]);

  async function toggleMute(next: boolean) {
    if (!chatId || !profile) return;
    setMuted(next);
    await supabase.from('chat_members').update({ muted: next }).eq('chat_id', chatId).eq('user_id', profile.id);
  }

  function handleClearChat() {
    if (!chatId || !profile) return;
    Alert.alert(
      'Clear this chat?',
      `This removes the messages from your view only — ${member?.display_name ?? 'they'} will still see them.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear chat',
          style: 'destructive',
          onPress: async () => {
            await clearChat(chatId, profile.id);
            router.back();
          },
        },
      ]
    );
  }

  function handleCreateGroup() {
    if (!member) return;
    router.push({ pathname: '/(app)/new-group', params: { memberIds: member.id } });
  }

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={accentColors.accent} />
      </View>
    );
  }

  if (!member) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.statusText}>This contact couldn't be found.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Contact info</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.headerRule} />

      <View style={styles.summary}>
        <Avatar name={member.display_name} avatarUrl={member.avatar_url} size={96} />
        <Text style={styles.name}>{member.display_name}</Text>
        {member.role === 'admin' && <Text style={[styles.badge, { color: accentColors.accent }]}>Household admin</Text>}
        {/* Mutual, like WhatsApp: only shown if both people have "Read receipts & online
            status" on — matches the gate in app/(app)/chat/[id].tsx. */}
        {!!profile?.show_read_receipts && !!member.show_read_receipts && (
          <Text style={styles.statusText}>
            {member.is_online ? 'Online' : formatLastSeen(member.last_seen_at)}
          </Text>
        )}
      </View>

      {member.phone && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Phone</Text>
          <Text style={styles.sectionValue}>{member.phone}</Text>
        </View>
      )}

      {chatId && (
        <>
          <Pressable
            style={[styles.section, styles.row]}
            onPress={() => router.push({ pathname: '/(app)/media-gallery/[chatId]', params: { chatId } })}
          >
            <Text style={styles.rowLabel}>Media, links and docs</Text>
            <Text style={styles.rowValue}>{mediaCount}</Text>
          </Pressable>

          <Pressable
            style={[styles.section, styles.row]}
            onPress={() => router.push({ pathname: '/(app)/starred-messages/[chatId]', params: { chatId } })}
          >
            <Text style={styles.rowLabel}>Starred messages</Text>
            <Text style={styles.rowValue}>{starredCount}</Text>
          </Pressable>

          <View style={[styles.section, styles.row]}>
            <Text style={styles.rowLabel}>Mute notifications</Text>
            <Switch
              value={muted}
              onValueChange={toggleMute}
              trackColor={{ true: accentColors.accent700, false: colors.neutral800 }}
              thumbColor={colors.text}
            />
          </View>

          <Pressable style={[styles.section, styles.row]} onPress={() => setWallpaperModalVisible(true)}>
            <Text style={styles.rowLabel}>Chat wallpaper</Text>
            <Text style={styles.rowValue}>{wallpaperPath ? 'Custom' : 'Default'}</Text>
          </Pressable>

          <Pressable style={[styles.section, styles.row]} onPress={handleCreateGroup}>
            <Text style={styles.rowLabel}>Create a group with {member.display_name}</Text>
          </Pressable>

          <View style={styles.section}>
            <OutlineButton label="Clear chat" onPress={handleClearChat} variant="danger" />
          </View>

          <WallpaperPickerModal
            visible={wallpaperModalVisible}
            chatId={chatId}
            userId={profile?.id ?? ''}
            hasWallpaper={!!wallpaperPath}
            onClose={() => setWallpaperModalVisible(false)}
            onChanged={loadOwnMembership}
          />
        </>
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
    alignItems: 'center',
    justifyContent: 'center',
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
  summary: {
    alignItems: 'center',
    paddingVertical: space[8],
    gap: space[2],
  },
  name: {
    color: colors.text,
    fontSize: 24,
    fontFamily: fonts.display,
    marginTop: space[2],
  },
  badge: {
    fontSize: 12,
    letterSpacing: 0.4,
  },
  statusText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  section: {
    paddingHorizontal: space[6],
    paddingVertical: space[4],
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    color: colors.text,
    fontSize: 15,
    flex: 1,
  },
  rowValue: {
    color: colors.textMuted,
    fontSize: 14,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 0.4,
    marginBottom: space[1],
  },
  sectionValue: {
    color: colors.text,
    fontSize: 16,
  },
});
