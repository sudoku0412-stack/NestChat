import { StyleSheet, Text, View } from 'react-native';
import { Avatar, GroupAvatarStack } from './Avatar';
import { SwipeableRow } from './SwipeableRow';
import { colors, fontWeight, radius, space } from '../lib/theme';
import type { ChatListItem } from '../lib/types';

function formatTimestamp(iso: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  const diffDays = Math.round((now.getTime() - date.getTime()) / 86400000);
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

interface ChatRowProps {
  chat: ChatListItem;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPress: () => void;
  onMuteToggle: () => void;
  onDelete: () => void;
  onArchive: () => void;
}

export function ChatRow({ chat, isOpen, onOpenChange, onPress, onMuteToggle, onDelete, onArchive }: ChatRowProps) {
  return (
    <SwipeableRow
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      onPress={onPress}
      onMuteToggle={onMuteToggle}
      onDelete={onDelete}
      onArchive={onArchive}
      muted={chat.muted}
    >
      <View style={styles.row}>
        {chat.type === 'group' ? (
          <GroupAvatarStack members={chat.avatarMembers} />
        ) : (
          <Avatar name={chat.title} avatarUrl={chat.avatarMembers[0]?.avatar_url} />
        )}

        <View style={styles.middle}>
          <View style={styles.titleLine}>
            <Text style={styles.title} numberOfLines={1}>
              {chat.title}
            </Text>
            <Text style={styles.timestamp}>{formatTimestamp(chat.lastMessageAt)}</Text>
          </View>
          <View style={styles.previewLine}>
            <Text
              style={[styles.preview, chat.unreadCount > 0 && styles.previewUnread]}
              numberOfLines={1}
            >
              {chat.lastMessagePreview}
            </Text>
            {chat.muted && <Text style={styles.muteGlyph}>♪̸</Text>}
            {chat.unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{chat.unreadCount > 99 ? '99+' : chat.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </SwipeableRow>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[6],
    paddingVertical: space[4],
    gap: space[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  middle: {
    flex: 1,
  },
  titleLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: fontWeight.medium,
    flexShrink: 1,
  },
  timestamp: {
    color: colors.textMuted,
    fontSize: 12,
    marginLeft: space[2],
  },
  previewLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space[1],
    gap: space[2],
  },
  preview: {
    color: colors.textMuted,
    fontSize: 14,
    flex: 1,
  },
  previewUnread: {
    color: colors.text,
  },
  muteGlyph: {
    color: colors.textMuted,
    fontSize: 12,
  },
  badge: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: colors.bg,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
  },
});
