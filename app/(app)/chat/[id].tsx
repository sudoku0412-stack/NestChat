import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  ImageBackground,
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
import * as Clipboard from 'expo-clipboard';
import {
  clearMessageReaction,
  generateId,
  sendMediaMessage,
  sendTextMessage,
  setMessageReaction,
  setPinnedMessage,
  softDeleteMessage,
  starMessage,
  unstarMessage,
} from '../../../lib/chatActions';
import type { MessageWithMedia } from '../../../lib/types';
import { getSignedWallpaperUrl, pickDocument, pickFromCamera, pickFromLibrary } from '../../../lib/media';
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
import { MessageActionsModal } from '../../../components/MessageActionsModal';
import { EmojiPickerModal } from '../../../components/EmojiPickerModal';
import type { GiphyItem } from '../../../lib/giphy';
import { addRecentEmoji } from '../../../lib/recentEmojis';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { BellIcon, BellOffIcon } from '../../../components/icons';
import { colors, fontWeight, space } from '../../../lib/theme';
import { useThemeMode } from '../../../lib/themeMode';

// Same-sender messages within this window group into one visual run (tight spacing, tail
// radius only on the last bubble, sender name only on the first) instead of every message
// getting an identical, evenly-spaced bubble regardless of how fast they came in.
const GROUP_WINDOW_MS = 2 * 60 * 1000;

function isSameGroup(a: MessageWithMedia | undefined, b: MessageWithMedia | undefined) {
  if (!a || !b || a.sender_id !== b.sender_id) return false;
  return Math.abs(new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) < GROUP_WINDOW_MS;
}

function isSameDay(aIso: string, bIso: string) {
  const a = new Date(aIso);
  const b = new Date(bIso);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDateChipLabel(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  if (isSameDay(iso, now.toISOString())) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(iso, yesterday.toISOString())) return 'Yesterday';
  return date.toLocaleDateString([], {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function DateChip({ label }: { label: string }) {
  return (
    <View style={styles.dateChipRow}>
      <Text style={styles.dateChipText}>{label}</Text>
    </View>
  );
}

function formatLastSeen(iso: string | null) {
  if (!iso) return 'Offline';
  const date = new Date(iso);
  return `Last seen ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

function previewFor(message: MessageWithMedia) {
  if (message.deleted_at) return 'This message was deleted';
  if (message.body) return message.body;
  if (message.media.length > 0) return message.media[0]!.kind === 'document' ? '📄 Document' : '📷 Media';
  return '';
}

export default function ThreadScreen() {
  const { id, messageId: targetMessageId } = useLocalSearchParams<{ id: string; messageId?: string }>();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { messages, members, membersById, isReadByOthers, refresh, ownMembership, starredMessageIds } = useMessages(
    id,
    profile?.id ?? null
  );
  const [draft, setDraft] = useState('');
  const [chatInfo, setChatInfo] = useState<{
    type: string;
    name: string | null;
    pinned_message_id: string | null;
  } | null>(null);
  const [muted, setMuted] = useState(false);
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingMessages, setPendingMessages] = useState<MessageWithMedia[]>([]);
  const [otherTyping, setOtherTyping] = useState(false);
  const [contactPickerVisible, setContactPickerVisible] = useState(false);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [actionMessage, setActionMessage] = useState<MessageWithMedia | null>(null);
  const [emojiPickerMessageId, setEmojiPickerMessageId] = useState<string | null>(null);
  const [actionMenuY, setActionMenuY] = useState(0);
  const [replyingTo, setReplyingTo] = useState<MessageWithMedia | null>(null);
  const listRef = useRef<FlatList>(null);
  const scrolledToTargetRef = useRef(false);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);
  const { bg } = useThemeMode();

  useEffect(() => {
    if (pendingMessages.length === 0) return;
    setPendingMessages((prev) => prev.filter((p) => !messages.some((m) => m.id === p.id)));
  }, [messages]);

  useEffect(() => {
    const path = ownMembership?.wallpaper_path ?? null;
    if (!path) {
      setWallpaperUrl(null);
      return;
    }
    getSignedWallpaperUrl(path).then(setWallpaperUrl);
  }, [ownMembership?.wallpaper_path]);

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

  // Opened from a push notification tap -- jump to the message that triggered it instead of
  // defaulting to the bottom of the thread. Runs once per screen instance; the default
  // scroll-to-bottom-on-new-content behavior below is suppressed until this either succeeds or
  // there's no target to look for.
  useEffect(() => {
    if (!targetMessageId || scrolledToTargetRef.current) return;
    const index = displayMessages.findIndex((m) => m.id === targetMessageId);
    if (index === -1) return;
    scrolledToTargetRef.current = true;
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.4 });
    });
  }, [displayMessages, targetMessageId]);

  const otherMember = members.find((m) => m.id !== profile?.id);
  const isGroup = chatInfo?.type === 'group';

  useEffect(() => {
    supabase
      .from('chats')
      .select('type, name, pinned_message_id')
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

  // Online/last-seen and read receipts are mutual, like WhatsApp: if either side has the
  // "Read receipts & online status" setting off, neither can see the other's. Groups keep
  // showing read state regardless (matches WhatsApp: that setting doesn't apply to groups).
  const canSeePresence = !isGroup && !!profile?.show_read_receipts && !!otherMember?.show_read_receipts;
  const canSeeReadReceipts = isGroup
    ? !!profile?.show_read_receipts
    : !!profile?.show_read_receipts && !!otherMember?.show_read_receipts;

  const title = isGroup ? chatInfo?.name ?? 'Group' : otherMember?.display_name ?? '';
  const subtitle = otherTyping
    ? 'Typing…'
    : isGroup
      ? `${members.length} member${members.length === 1 ? '' : 's'}`
      : !canSeePresence
        ? ''
        : otherMember?.is_online
          ? 'Online'
          : formatLastSeen(otherMember?.last_seen_at ?? null);

  async function handleSend() {
    if (!profile || !draft.trim()) return;
    const text = draft.trim();
    const replyToId = replyingTo?.id ?? null;
    setDraft('');
    setReplyingTo(null);
    const optimistic: MessageWithMedia = {
      id: generateId(),
      chat_id: id,
      sender_id: profile.id,
      body: text,
      created_at: new Date().toISOString(),
      deleted_at: null,
      location_share_id: null,
      reply_to_message_id: replyToId,
      enc_v: null,
      key_id: null,
      ciphertext: null,
      media: [],
      replyTo: replyingTo,
    };
    setPendingMessages((prev) => [...prev, optimistic]);
    try {
      await sendTextMessage(id, profile.id, text, optimistic.id, replyToId);
    } catch (err) {
      setPendingMessages((prev) => prev.filter((p) => p.id !== optimistic.id));
      setDraft(text);
      setReplyingTo(replyingTo);
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
    } catch (err) {
      Alert.alert('Could not send', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setPendingCount((c) => Math.max(0, c - 1));
      refresh();
    }
  }

  async function handleSelectGif(item: GiphyItem, kind: 'gif' | 'sticker') {
    if (!profile) return;
    setPendingCount((c) => c + 1);
    try {
      await sendMediaMessage(id, profile.id, {
        uri: item.url,
        kind,
        width: item.width,
        height: item.height,
      });
    } catch (err) {
      Alert.alert('Could not send', err instanceof Error ? err.message : 'Try again.');
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

  function refreshChatInfo() {
    supabase
      .from('chats')
      .select('type, name, pinned_message_id')
      .eq('id', id)
      .single()
      .then(({ data }) => setChatInfo(data ?? null));
  }

  async function handleToggleStar() {
    if (!profile || !actionMessage) return;
    if (starredMessageIds.has(actionMessage.id)) await unstarMessage(actionMessage.id, profile.id);
    else await starMessage(actionMessage.id, profile.id);
    refresh();
  }

  async function reactToMessage(messageId: string, emoji: string) {
    if (!profile) return;
    const message = messages.find((m) => m.id === messageId) ?? pendingMessages.find((m) => m.id === messageId);
    const current = message?.reactions?.find((r) => r.reactedByMe);
    if (current?.emoji === emoji) {
      await clearMessageReaction(messageId, profile.id);
    } else {
      await setMessageReaction(messageId, profile.id, emoji);
      addRecentEmoji(emoji);
    }
    refresh();
  }

  function handleReact(emoji: string) {
    if (!actionMessage) return;
    reactToMessage(actionMessage.id, emoji);
  }

  function handleOpenFullEmojiPicker() {
    if (!actionMessage) return;
    setEmojiPickerMessageId(actionMessage.id);
  }

  async function handleTogglePin() {
    if (!actionMessage) return;
    const isPinned = chatInfo?.pinned_message_id === actionMessage.id;
    await setPinnedMessage(id, isPinned ? null : actionMessage.id);
    refreshChatInfo();
  }

  async function handleCopy() {
    if (!actionMessage?.body) return;
    await Clipboard.setStringAsync(actionMessage.body);
  }

  function handleDeleteMessage() {
    if (!actionMessage) return;
    const messageId = actionMessage.id;
    Alert.alert('Delete this message?', 'This deletes it for everyone in the chat.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await softDeleteMessage(messageId);
          refresh();
        },
      },
    ]);
  }

  function handleViewContact() {
    if (!actionMessage) return;
    const sender = membersById.get(actionMessage.sender_id);
    if (!sender) return;
    router.push({ pathname: '/(app)/contact-info/[id]', params: { id: sender.id, chatId: id } });
  }

  function handleReply() {
    if (!actionMessage) return;
    setReplyingTo(actionMessage);
  }

  const pinnedMessage = chatInfo?.pinned_message_id
    ? messages.find((m) => m.id === chatInfo.pinned_message_id) ?? null
    : null;

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={{ paddingTop: insets.top }}>
        <ScreenHeader
          title={title}
          centerContent={
            <Pressable
              style={styles.headerCenter}
              onPress={() => {
                if (isGroup) router.push(`/(app)/group-info/${id}`);
                else if (otherMember)
                  router.push({
                    pathname: '/(app)/contact-info/[id]',
                    params: { id: otherMember.id, chatId: id },
                  });
              }}
            >
              <Avatar name={title} avatarUrl={isGroup ? null : otherMember?.avatar_url} size={32} />
              <View style={styles.headerTexts}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {title}
                </Text>
                <Text style={styles.headerSubtitle}>{subtitle}</Text>
              </View>
            </Pressable>
          }
          right={
            <Pressable onPress={toggleMute} hitSlop={8}>
              {muted ? (
                <BellOffIcon size={20} color={colors.textMuted} />
              ) : (
                <BellIcon size={20} color={colors.textMuted} />
              )}
            </Pressable>
          }
        />
      </View>

      {pinnedMessage && (
        <View style={styles.pinnedBanner}>
          <Text style={styles.pinnedGlyph}>📌</Text>
          <Text style={styles.pinnedText} numberOfLines={1}>
            {previewFor(pinnedMessage)}
          </Text>
        </View>
      )}

      <ImageBackground
        source={wallpaperUrl ? { uri: wallpaperUrl } : undefined}
        style={styles.messageArea}
      >
        {wallpaperUrl && <View style={styles.wallpaperScrim} />}
        <FlatList
          ref={listRef}
          data={displayMessages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingVertical: space[4] }}
          onContentSizeChange={() => {
            if (targetMessageId && !scrolledToTargetRef.current) return;
            listRef.current?.scrollToEnd({ animated: false });
          }}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              listRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.4 });
            }, 100);
          }}
          ListFooterComponent={otherTyping ? <TypingIndicator /> : null}
          renderItem={({ item, index }) => {
            const isOwn = item.sender_id === profile?.id;
            const prev = displayMessages[index - 1];
            const next = displayMessages[index + 1];
            const showSenderName = isGroup && !isOwn && !isSameGroup(prev, item);
            const isLastInGroup = !isSameGroup(item, next);
            const showDateChip = !prev || !isSameDay(prev.created_at, item.created_at);
            const isLastOwnWithMedia = isOwn && index === displayMessages.length - 1;

            const dateChip = showDateChip ? <DateChip label={formatDateChipLabel(item.created_at)} /> : null;

            if (item.liveLocation) {
              return (
                <>
                  {dateChip}
                  <View style={isOwn ? styles.liveLocationOwn : styles.liveLocationOther}>
                    <LiveLocationBubble location={item.liveLocation} isOwn={isOwn} />
                  </View>
                </>
              );
            }

            const replyTo = item.replyTo
              ? {
                  senderName: membersById.get(item.replyTo.sender_id)?.display_name ?? '',
                  preview: previewFor(item.replyTo),
                }
              : null;

            return (
              <>
                {dateChip}
                <MessageBubble
                  message={{ ...item, sender: membersById.get(item.sender_id) }}
                  isOwn={isOwn}
                  showSenderName={showSenderName}
                  showReadReceipts={canSeeReadReceipts}
                  isRead={isReadByOthers(item)}
                  isStarred={starredMessageIds.has(item.id)}
                  isLastInGroup={isLastInGroup}
                  replyTo={replyTo}
                  onLongPress={(y) => {
                    setActionMessage(item);
                    setActionMenuY(y);
                  }}
                  onReactionPress={(emoji) => reactToMessage(item.id, emoji)}
                  pendingMediaCount={isLastOwnWithMedia ? pendingCount : 0}
                  myUserId={profile?.id ?? null}
                />
              </>
            );
          }}
        />
      </ImageBackground>

      <Composer
        value={draft}
        onChangeText={handleDraftChange}
        onSend={handleSend}
        onPickCamera={() => handlePick('camera')}
        onPickLibrary={() => handlePick('library')}
        onPickDocument={() => handlePick('document')}
        onPickContact={() => setContactPickerVisible(true)}
        onShareLocation={() => setLocationModalVisible(true)}
        onSelectGif={handleSelectGif}
        replyingTo={
          replyingTo
            ? {
                senderName: membersById.get(replyingTo.sender_id)?.display_name ?? '',
                preview: previewFor(replyingTo),
              }
            : null
        }
        onCancelReply={() => setReplyingTo(null)}
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
      <MessageActionsModal
        visible={!!actionMessage}
        anchorY={actionMenuY}
        isOwn={actionMessage?.sender_id === profile?.id}
        isStarred={!!actionMessage && starredMessageIds.has(actionMessage.id)}
        isPinned={!!actionMessage && chatInfo?.pinned_message_id === actionMessage.id}
        canCopy={!!actionMessage?.body}
        currentReaction={actionMessage?.reactions?.find((r) => r.reactedByMe)?.emoji ?? null}
        onClose={() => setActionMessage(null)}
        onReply={handleReply}
        onCopy={handleCopy}
        onToggleStar={handleToggleStar}
        onTogglePin={handleTogglePin}
        onViewContact={handleViewContact}
        onDelete={handleDeleteMessage}
        onReact={handleReact}
        onOpenFullEmojiPicker={handleOpenFullEmojiPicker}
      />
      <EmojiPickerModal
        visible={!!emojiPickerMessageId}
        onClose={() => setEmojiPickerMessageId(null)}
        onSelect={(emoji) => {
          if (emojiPickerMessageId) reactToMessage(emojiPickerMessageId, emoji);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  messageArea: {
    flex: 1,
  },
  wallpaperScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
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
  dateChipRow: {
    alignItems: 'center',
    marginVertical: space[3],
  },
  dateChipText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    backgroundColor: colors.surface,
    paddingHorizontal: space[3],
    paddingVertical: 4,
    borderRadius: 999,
  },
  pinnedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  pinnedGlyph: {
    fontSize: 13,
  },
  pinnedText: {
    color: colors.textMuted,
    fontSize: 13,
    flex: 1,
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
