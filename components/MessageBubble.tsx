import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { MediaTile, PendingMediaTile } from './MediaTile';
import { CheckIcon, DoubleCheckIcon, StarIcon } from './icons';
import { useTheme } from '../lib/themeMode';
import { useAccentTheme } from '../lib/accentTheme';
import { radius, space } from '../lib/theme';
import type { MessageWithMedia } from '../lib/types';
import type { Colors } from '../lib/theme';

// The tail corner (the one corner that stays square-ish to read as a speech-bubble "tail") is a
// tight 4px per the Hearth spec — every other corner uses the full radius.md rounding.
const TAIL_RADIUS = 4;

function ReactionRow({
  reactions,
  isOwn,
  theme,
  accentColors,
  onPress,
}: {
  reactions: NonNullable<MessageWithMedia['reactions']>;
  isOwn: boolean;
  theme: Colors;
  accentColors: Colors;
  onPress?: (emoji: string) => void;
}) {
  if (reactions.length === 0) return null;
  return (
    <View
      style={[
        styles.reactionRow,
        // Small pill that overlaps the bubble's bottom corner (bottom-right for sent, bottom-left
        // for received) rather than sitting in normal flow below it — the negative top margin is
        // what creates the overlap against the bubble above.
        isOwn ? styles.reactionRowOwn : styles.reactionRowOther,
      ]}
    >
      {reactions.map((r) => (
        <Pressable
          key={r.emoji}
          style={[
            styles.reactionPill,
            { backgroundColor: theme.surface, shadowColor: theme.text },
            r.reactedByMe && { borderColor: accentColors.accent, backgroundColor: accentColors.accent900 },
          ]}
          onPress={() => onPress?.(r.emoji)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={
            r.reactedByMe ? `Remove your ${r.emoji} reaction` : `React with ${r.emoji}`
          }
          accessibilityState={{ selected: r.reactedByMe }}
        >
          <Text style={styles.reactionPillGlyph}>{r.emoji}</Text>
          {r.count > 1 && <Text style={[styles.reactionPillCount, { color: theme.textMuted }]}>{r.count}</Text>}
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
  const theme = useTheme();
  const { colors: accentColors } = useAccentTheme();
  // Sent bubbles always render white text/ticks against the accent fill (per spec); received
  // bubbles read from the theme like any other surface text.
  const sentTextColor = '#FFFFFF';
  const sentMutedColor = 'rgba(255,255,255,0.72)';

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
        <Text style={[styles.senderName, { color: theme.textMuted }]}>{message.sender?.display_name}</Text>
      )}

      {isDeleted ? (
        <View style={[styles.bubble, { backgroundColor: theme.bgDeep }]}>
          <Text style={[styles.deletedText, { color: theme.textMuted }]}>This message was deleted</Text>
        </View>
      ) : (
        <View
          style={[
            styles.bubble,
            isOwn
              ? [
                  { backgroundColor: accentColors.accent },
                  { borderBottomRightRadius: isLastInGroup ? TAIL_RADIUS : radius.md },
                ]
              : [
                  { backgroundColor: theme.bgDeep },
                  { borderBottomLeftRadius: isLastInGroup ? TAIL_RADIUS : radius.md },
                ],
            message.media.length > 0 && styles.bubbleMedia,
          ]}
        >
          {replyTo && (
            <View style={[styles.replyQuote, { borderLeftColor: isOwn ? sentTextColor : accentColors.accent }]}>
              <Text style={[styles.replyQuoteName, { color: isOwn ? sentTextColor : accentColors.accent }]}>
                {replyTo.senderName}
              </Text>
              <Text style={[styles.replyQuotePreview, { color: isOwn ? sentMutedColor : theme.textMuted }]} numberOfLines={1}>
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
                { color: isOwn ? sentTextColor : theme.text },
                message.media.length > 0 && { marginTop: space[2] },
              ]}
            >
              {message.body}
            </Text>
          ) : null}

          <View style={styles.metaRow}>
            {isStarred && (
              <StarIcon size={10} color={isOwn ? sentMutedColor : accentColors.accent} filled />
            )}
            <Text style={[styles.metaText, { color: isOwn ? sentMutedColor : theme.textMuted }]}>
              {formatTime(message.created_at)}
            </Text>
            {isOwn &&
              showReadReceipts &&
              // Read-receipt ticks are always sage (theme.success), never the accent color — a
              // dimmed version for "sent, not yet read" and full-strength for "read".
              (isRead ? (
                <DoubleCheckIcon size={13} color={theme.success} />
              ) : (
                <View style={{ opacity: 0.55 }}>
                  <CheckIcon size={11} color={theme.success} strokeWidth={1.4} />
                </View>
              ))}
          </View>
        </View>
      )}

      {!isDeleted && (
        <ReactionRow
          reactions={message.reactions ?? []}
          isOwn={isOwn}
          theme={theme}
          accentColors={accentColors}
          onPress={onReactionPress}
        />
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
    fontSize: 12,
    marginBottom: space[1],
    marginLeft: space[1],
  },
  bubble: {
    borderRadius: radius.md,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
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
    fontSize: 12,
  },
  body: {
    fontSize: 15,
    lineHeight: 20,
  },
  deletedText: {
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
    fontSize: 11,
  },
  reactionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[1],
    // Negative top margin overlaps the pill up onto the bubble's bottom corner instead of
    // sitting in plain flow beneath it.
    marginTop: -space[2],
    marginHorizontal: space[1],
  },
  reactionRowOwn: {
    justifyContent: 'flex-end',
    marginRight: space[1],
  },
  reactionRowOther: {
    justifyContent: 'flex-start',
    marginLeft: space[1],
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radius.full,
    paddingHorizontal: space[2],
    paddingVertical: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  reactionPillGlyph: {
    fontSize: 13,
  },
  reactionPillCount: {
    fontSize: 11,
  },
});
