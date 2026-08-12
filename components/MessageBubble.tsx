import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { MediaTile, PendingMediaTile } from './MediaTile';
import { CheckIcon, DoubleCheckIcon, StarIcon } from './icons';
import { useAccentTheme } from '../lib/accentTheme';
import { colors, radius, space } from '../lib/theme';
import type { MessageWithMedia } from '../lib/types';

function ReactionRow({
  reactions,
  isOwn,
  onPress,
}: {
  reactions: NonNullable<MessageWithMedia['reactions']>;
  isOwn: boolean;
  onPress?: (emoji: string) => void;
}) {
  const { colors: accentColors } = useAccentTheme();
  if (reactions.length === 0) return null;
  return (
    <View style={[styles.reactionRow, isOwn ? styles.reactionRowOwn : styles.reactionRowOther]}>
      {reactions.map((r) => (
        <Pressable
          key={r.emoji}
          style={[
            styles.reactionPill,
            r.reactedByMe && { borderColor: accentColors.accent, backgroundColor: accentColors.accent900 },
          ]}
          onPress={() => onPress?.(r.emoji)}
        >
          <Text style={styles.reactionPillGlyph}>{r.emoji}</Text>
          {r.count > 1 && <Text style={styles.reactionPillCount}>{r.count}</Text>}
        </Pressable>
      ))}
    </View>
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

interface MessageBubbleProps {
  message: MessageWithMedia;
  isOwn: boolean;
  showSenderName: boolean;
  showReadReceipts: boolean;
  isRead: boolean;
  isStarred?: boolean;
  /** False for every bubble but the last in a same-sender, close-in-time run — squares off the
   * tail corner and tightens the gap to the next bubble so the run reads as one group. */
  isLastInGroup?: boolean;
  replyTo?: { senderName: string; preview: string } | null;
  onLongPress?: (y: number) => void;
  onReactionPress?: (emoji: string) => void;
  pendingMediaCount?: number;
  myUserId: string | null;
}

export function MessageBubble({
  message,
  isOwn,
  showSenderName,
  showReadReceipts,
  isRead,
  isStarred = false,
  isLastInGroup = true,
  replyTo = null,
  onLongPress,
  onReactionPress,
  pendingMediaCount = 0,
  myUserId,
}: MessageBubbleProps) {
  const isDeleted = !!message.deleted_at;
  const { colors: accentColors } = useAccentTheme();

  return (
    <Pressable
      style={[
        styles.container,
        isOwn ? styles.containerOwn : styles.containerOther,
        { marginBottom: isLastInGroup ? space[3] : space[1] },
      ]}
      onLongPress={(e: GestureResponderEvent) => onLongPress?.(e.nativeEvent.pageY)}
    >
      {showSenderName && !isOwn && (
        <Text style={styles.senderName}>{message.sender?.display_name}</Text>
      )}

      {isDeleted ? (
        <View style={[styles.bubble, styles.bubbleOther]}>
          <Text style={styles.deletedText}>This message was deleted</Text>
        </View>
      ) : (
        <View
          style={[
            styles.bubble,
            isOwn
              ? [
                  styles.bubbleOwn,
                  { backgroundColor: accentColors.accent700 },
                  { borderBottomRightRadius: isLastInGroup ? radius.sm : radius.xl },
                ]
              : [styles.bubbleOther, { borderBottomLeftRadius: isLastInGroup ? radius.sm : radius.xl }],
            message.media.length > 0 && styles.bubbleMedia,
          ]}
        >
          {replyTo && (
            <View style={[styles.replyQuote, { borderLeftColor: accentColors.accent }]}>
              <Text style={[styles.replyQuoteName, { color: accentColors.accent }]}>{replyTo.senderName}</Text>
              <Text style={styles.replyQuotePreview} numberOfLines={1}>
                {replyTo.preview}
              </Text>
            </View>
          )}
          {message.media.map((m) => (
            <MediaTile
              key={m.id}
              media={m}
              chatId={message.chat_id}
              messageId={message.id}
              keyId={message.key_id}
              myUserId={myUserId}
              ownMessage={isOwn}
              onLongPress={onLongPress}
            />
          ))}
          {Array.from({ length: pendingMediaCount }).map((_, i) => (
            <PendingMediaTile key={`pending-${i}`} />
          ))}
          {message.body ? (
            <Text
              style={[
                styles.body,
                isOwn && { color: accentColors.accent100 },
                message.media.length > 0 && { marginTop: space[2] },
              ]}
            >
              {message.body}
            </Text>
          ) : null}

          <View style={styles.metaRow}>
            {isStarred && <StarIcon size={10} color={isOwn ? accentColors.accent100 : accentColors.accent} filled />}
            <Text style={[styles.metaText, isOwn && { color: accentColors.accent200 }]}>
              {formatTime(message.created_at)}
            </Text>
            {isOwn &&
              showReadReceipts &&
              (isRead ? (
                <DoubleCheckIcon size={13} color={accentColors.accent100} />
              ) : (
                <CheckIcon size={11} color={accentColors.accent200} />
              ))}
          </View>
        </View>
      )}

      {!isDeleted && (
        <ReactionRow reactions={message.reactions ?? []} isOwn={isOwn} onPress={onReactionPress} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: space[1],
    paddingHorizontal: space[6],
    maxWidth: '84%',
  },
  containerOwn: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  containerOther: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  senderName: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: space[1],
    marginLeft: space[1],
  },
  bubble: {
    borderRadius: radius.xl,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  bubbleOwn: {
    // Tail radius (tighter on the last bubble of a group) is applied inline, not here — it
    // depends on isLastInGroup, which this static stylesheet has no way to express.
  },
  bubbleOther: {
    backgroundColor: colors.surface,
  },
  bubbleMedia: {
    gap: space[2],
  },
  replyQuote: {
    borderLeftWidth: 2,
    paddingLeft: space[2],
    marginBottom: space[2],
  },
  replyQuoteName: {
    fontSize: 12,
    fontWeight: '500',
  },
  replyQuotePreview: {
    color: colors.textMuted,
    fontSize: 12,
  },
  body: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
  },
  deletedText: {
    color: colors.textMuted,
    fontSize: 14,
    fontStyle: 'italic',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-end',
    marginTop: space[1],
  },
  metaText: {
    color: colors.textMuted,
    fontSize: 11,
  },
  reactionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[1],
    marginTop: space[1],
    marginHorizontal: space[1],
  },
  reactionRowOwn: {
    justifyContent: 'flex-end',
  },
  reactionRowOther: {
    justifyContent: 'flex-start',
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: space[2],
    paddingVertical: 2,
  },
  reactionPillGlyph: {
    fontSize: 13,
  },
  reactionPillCount: {
    color: colors.textMuted,
    fontSize: 11,
  },
});
