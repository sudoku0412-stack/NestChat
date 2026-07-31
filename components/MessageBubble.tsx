import { StyleSheet, Text, View } from 'react-native';
import { MediaTile, PendingMediaTile } from './MediaTile';
import { colors, radius, space } from '../lib/theme';
import type { MessageWithMedia } from '../lib/types';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

interface MessageBubbleProps {
  message: MessageWithMedia;
  isOwn: boolean;
  showSenderName: boolean;
  showReadReceipts: boolean;
  isRead: boolean;
  pendingMediaCount?: number;
}

export function MessageBubble({
  message,
  isOwn,
  showSenderName,
  showReadReceipts,
  isRead,
  pendingMediaCount = 0,
}: MessageBubbleProps) {
  const isDeleted = !!message.deleted_at;

  return (
    <View style={[styles.container, isOwn ? styles.containerOwn : styles.containerOther]}>
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
            isOwn ? styles.bubbleOwn : styles.bubbleOther,
            message.media.length > 0 && styles.bubbleMedia,
          ]}
        >
          {message.media.map((m) => (
            <MediaTile key={m.id} media={m} messageId={message.id} ownMessage={isOwn} />
          ))}
          {Array.from({ length: pendingMediaCount }).map((_, i) => (
            <PendingMediaTile key={`pending-${i}`} />
          ))}
          {message.body ? (
            <Text style={[styles.body, message.media.length > 0 && { marginTop: space[2] }]}>
              {message.body}
            </Text>
          ) : null}
        </View>
      )}

      {isOwn && !isDeleted && (
        <Text style={styles.meta}>
          {formatTime(message.created_at)}
          {showReadReceipts ? `  ·  ${isRead ? 'Read' : 'Delivered'}` : ''}
        </Text>
      )}
      {!isOwn && !isDeleted && <Text style={styles.meta}>{formatTime(message.created_at)}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: space[1],
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
    borderRadius: radius.sm,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  bubbleOwn: {
    backgroundColor: colors.accent900,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  bubbleOther: {
    backgroundColor: colors.surface,
  },
  bubbleMedia: {
    gap: space[2],
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
  meta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: space[1],
    marginHorizontal: space[1],
  },
});
