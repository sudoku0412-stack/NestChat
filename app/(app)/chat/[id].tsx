import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../lib/auth';
import { useMessages } from '../../../lib/hooks/useMessages';
import { supabase } from '../../../lib/supabase';
import { sendMediaMessage, sendTextMessage } from '../../../lib/chatActions';
import { pickFromCamera, pickFromLibrary } from '../../../lib/media';
import { Avatar } from '../../../components/Avatar';
import { MessageBubble } from '../../../components/MessageBubble';
import { Composer } from '../../../components/Composer';
import { colors, fontWeight, space } from '../../../lib/theme';
import { useThemeMode } from '../../../lib/themeMode';

function formatLastSeen(iso: string | null) {
  if (!iso) return 'Offline';
  const date = new Date(iso);
  return `Last seen ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

export default function ThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { messages, members, membersById, isReadByOthers, refresh } = useMessages(id, profile?.id ?? null);
  const [draft, setDraft] = useState('');
  const [chatInfo, setChatInfo] = useState<{ type: string; name: string | null } | null>(null);
  const [muted, setMuted] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const listRef = useRef<FlatList>(null);
  const { bg } = useThemeMode();

  const otherMember = members.find((m) => m.id !== profile?.id);
  const isGroup = chatInfo?.type === 'group';

  useEffect(() => {
    supabase
      .from('chats')
      .select('type, name')
      .eq('id', id)
      .single()
      .then(({ data }) => setChatInfo(data ?? null));

    if (profile) {
      supabase
        .from('chat_members')
        .select('muted')
        .eq('chat_id', id)
        .eq('user_id', profile.id)
        .single()
        .then(({ data }) => setMuted(!!data?.muted));
    }
  }, [id, profile]);

  const title = isGroup ? chatInfo?.name ?? 'Group' : otherMember?.display_name ?? '';
  const subtitle = isGroup
    ? `${members.length} member${members.length === 1 ? '' : 's'}`
    : otherMember?.is_online
      ? 'Online'
      : formatLastSeen(otherMember?.last_seen_at ?? null);

  async function handleSend() {
    if (!profile || !draft.trim()) return;
    const text = draft.trim();
    setDraft('');
    await sendTextMessage(id, profile.id, text);
  }

  async function handlePick(kind: 'camera' | 'library') {
    if (!profile) return;
    const asset = kind === 'camera' ? await pickFromCamera() : await pickFromLibrary();
    if (!asset) return;
    setPendingCount((c) => c + 1);
    try {
      await sendMediaMessage(id, profile.id, asset);
    } finally {
      setPendingCount((c) => Math.max(0, c - 1));
      refresh();
    }
  }

  async function toggleMute() {
    if (!profile) return;
    const next = !muted;
    setMuted(next);
    await supabase.from('chat_members').update({ muted: next }).eq('chat_id', id).eq('user_id', profile.id);
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ paddingTop: insets.top }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <Pressable
            style={styles.headerCenter}
            onPress={() => isGroup && router.push(`/(app)/group-info/${id}`)}
          >
            <Avatar name={title} avatarUrl={isGroup ? null : otherMember?.avatar_url} size={32} />
            <View style={styles.headerTexts}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.headerSubtitle}>{subtitle}</Text>
            </View>
          </Pressable>
          <Pressable onPress={toggleMute} hitSlop={8}>
            <Text style={styles.muteToggle}>{muted ? '♪̸' : '♪'}</Text>
          </Pressable>
        </View>
        <View style={styles.headerRule} />
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ paddingVertical: space[4] }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item, index }) => {
          const isOwn = item.sender_id === profile?.id;
          const prev = messages[index - 1];
          const showSenderName = isGroup && !isOwn && (!prev || prev.sender_id !== item.sender_id);
          const isLastOwnWithMedia = isOwn && index === messages.length - 1;
          return (
            <MessageBubble
              message={{ ...item, sender: membersById.get(item.sender_id) }}
              isOwn={isOwn}
              showSenderName={showSenderName}
              showReadReceipts={!!profile?.show_read_receipts}
              isRead={isReadByOthers(item)}
              pendingMediaCount={isLastOwnWithMedia ? pendingCount : 0}
            />
          );
        }}
      />

      <Composer
        value={draft}
        onChangeText={setDraft}
        onSend={handleSend}
        onPickCamera={() => handlePick('camera')}
        onPickLibrary={() => handlePick('library')}
      />
    </KeyboardAvoidingView>
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
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    gap: space[3],
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  headerTexts: {
    flex: 1,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: fontWeight.medium,
  },
  headerSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
  },
  back: {
    color: colors.text,
    fontSize: 28,
    width: 24,
  },
  muteToggle: {
    color: colors.textMuted,
    fontSize: 20,
    width: 24,
    textAlign: 'center',
  },
  headerRule: {
    height: 2,
    backgroundColor: colors.divider,
  },
});
