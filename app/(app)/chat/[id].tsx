import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
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
import { generateId, sendMediaMessage, sendTextMessage } from '../../../lib/chatActions';
import type { MessageWithMedia } from '../../../lib/types';
import { pickDocument, pickFromCamera, pickFromLibrary } from '../../../lib/media';
import { startLiveLocationShare } from '../../../lib/liveLocation';
import type { ShareableContact } from '../../../lib/contacts';
import type { LiveLocationDuration } from '../../../lib/database.types';
import { Avatar } from '../../../components/Avatar';
import { MessageBubble } from '../../../components/MessageBubble';
import { LiveLocationBubble } from '../../../components/LiveLocationBubble';
import { TypingIndicator } from '../../../components/TypingIndicator';
import { Composer } from '../../../components/Composer';
import { ContactPickerModal } from '../../../components/ContactPickerModal';
import { LocationDurationModal } from '../../../components/LocationDurationModal';
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
  const [pendingMessages, setPendingMessages] = useState<MessageWithMedia[]>([]);
  const [otherTyping, setOtherTyping] = useState(false);
  const [contactPickerVisible, setContactPickerVisible] = useState(false);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const listRef = useRef<FlatList>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);
  const { bg } = useThemeMode();

  useEffect(() => {
    if (pendingMessages.length === 0) return;
    setPendingMessages((prev) => prev.filter((p) => !messages.some((m) => m.id === p.id)));
  }, [messages]);

  useEffect(() => {
    const channel = supabase
      .channel(`typing-${id}`)
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.userId === profile?.id) return;
        setOtherTyping(true);
        if (typingClearRef.current) clearTimeout(typingClearRef.current);
        typingClearRef.current = setTimeout(() => setOtherTyping(false), 3000);
      })
      .subscribe();
    typingChannelRef.current = channel;

    return () => {
      if (typingClearRef.current) clearTimeout(typingClearRef.current);
      typingChannelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [id, profile?.id]);

  function handleDraftChange(text: string) {
    setDraft(text);
    if (!profile) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current > 1500) {
      lastTypingSentRef.current = now;
      typingChannelRef.current?.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: profile.id },
      });
    }
  }

  const displayMessages = useMemo(
    () => [...messages, ...pendingMessages.filter((p) => !messages.some((m) => m.id === p.id))],
    [messages, pendingMessages]
  );

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
  const subtitle = otherTyping
    ? 'Typing…'
    : isGroup
      ? `${members.length} member${members.length === 1 ? '' : 's'}`
      : otherMember?.is_online
        ? 'Online'
        : formatLastSeen(otherMember?.last_seen_at ?? null);

  async function handleSend() {
    if (!profile || !draft.trim()) return;
    const text = draft.trim();
    setDraft('');
    const optimistic: MessageWithMedia = {
      id: generateId(),
      chat_id: id,
      sender_id: profile.id,
      body: text,
      created_at: new Date().toISOString(),
      deleted_at: null,
      location_share_id: null,
      media: [],
    };
    setPendingMessages((prev) => [...prev, optimistic]);
    try {
      await sendTextMessage(id, profile.id, text, optimistic.id);
    } catch (err) {
      setPendingMessages((prev) => prev.filter((p) => p.id !== optimistic.id));
      setDraft(text);
    }
  }

  async function handlePick(kind: 'camera' | 'library' | 'document') {
    if (!profile) return;
    const asset =
      kind === 'camera' ? await pickFromCamera() : kind === 'library' ? await pickFromLibrary() : await pickDocument();
    if (!asset) return;
    setPendingCount((c) => c + 1);
    try {
      await sendMediaMessage(id, profile.id, asset);
    } finally {
      setPendingCount((c) => Math.max(0, c - 1));
      refresh();
    }
  }

  async function handleShareContact(contact: ShareableContact) {
    if (!profile) return;
    const text = `📇 ${contact.name}\n${contact.phones.join(', ')}`;
    await sendTextMessage(id, profile.id, text);
  }

  async function handleShareLocation(duration: LiveLocationDuration) {
    if (!profile) return;
    try {
      const shareId = await startLiveLocationShare(id, profile.id, duration);
      if (!shareId) {
        Alert.alert('Location permission needed', 'Allow location access (including "Always") to share your live location.');
      }
    } catch (err) {
      Alert.alert('Could not share location', err instanceof Error ? err.message : 'Try again.');
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
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
        data={displayMessages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ paddingVertical: space[4] }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListFooterComponent={otherTyping ? <TypingIndicator /> : null}
        renderItem={({ item, index }) => {
          const isOwn = item.sender_id === profile?.id;
          const prev = displayMessages[index - 1];
          const showSenderName = isGroup && !isOwn && (!prev || prev.sender_id !== item.sender_id);
          const isLastOwnWithMedia = isOwn && index === displayMessages.length - 1;

          if (item.liveLocation) {
            return (
              <View style={isOwn ? styles.liveLocationOwn : styles.liveLocationOther}>
                <LiveLocationBubble location={item.liveLocation} isOwn={isOwn} />
              </View>
            );
          }

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
        onChangeText={handleDraftChange}
        onSend={handleSend}
        onPickCamera={() => handlePick('camera')}
        onPickLibrary={() => handlePick('library')}
        onPickDocument={() => handlePick('document')}
        onPickContact={() => setContactPickerVisible(true)}
        onShareLocation={() => setLocationModalVisible(true)}
      />

      <ContactPickerModal
        visible={contactPickerVisible}
        onClose={() => setContactPickerVisible(false)}
        onSelect={handleShareContact}
      />
      <LocationDurationModal
        visible={locationModalVisible}
        onClose={() => setLocationModalVisible(false)}
        onSelect={handleShareLocation}
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
  liveLocationOwn: {
    alignItems: 'flex-end',
    paddingHorizontal: space[6],
    marginVertical: space[1],
  },
  liveLocationOther: {
    alignItems: 'flex-start',
    paddingHorizontal: space[6],
    marginVertical: space[1],
  },
});
