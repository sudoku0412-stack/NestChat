import { StyleSheet, Text, View } from 'react-native';
import { Avatar, GroupAvatarStack } from './Avatar';
import { SwipeableRow } from './SwipeableRow';
import { BellOffIcon, StarIcon } from './icons';
import { useAccentTheme } from '../lib/accentTheme';
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
  onLongPress?: () => void;
  onMuteToggle: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onFavoriteToggle: () => void;
  isArchived?: boolean;
  selectMode?: boolean;
  selected?: boolean;
}

export function ChatRow({
  chat,
  isOpen,
  onOpenChange,
  onPress,
  onLongPress,
  onMuteToggle,
  onDelete,
  onArchive,
  onFavoriteToggle,
  isArchived = false,
  selectMode = false,
  selected = false,
}: ChatRowProps) {
  const { colors: accentColors } = useAccentTheme();
  return (
    <SwipeableRow
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      onPress={onPress}
      onLongPress={onLongPress}
      onMuteToggle={onMuteToggle}
      onDelete={onDelete}
      onArchive={onArchive}
      onFavoriteToggle={onFavoriteToggle}
      muted={chat.muted}
      favorite={chat.favorite}
      isArchived={isArchived}
      disabled={selectMode}
    >
      <View style={styles.row}>
        {selectMode && (
          <View
            style={[
              styles.checkCircle,
              selected && { backgroundColor: accentColors.accent, borderColor: accentColors.accent },
            ]}
          >
            {selected && <Text style={styles.checkGlyph}>✓</Text>}
          </View>
        )}

        {chat.type === 'group' ? (
          <GroupAvatarStack members={chat.avatarMembers} />
        ) : (
          <Avatar name={chat.title} avatarUrl={chat.avatarMembers[0]?.avatar_url} />
        )}

        <View style={styles.middle}>
          <View style={styles.titleLine}>
            <View style={styles.titleRow}>
              {chat.favorite && <StarIcon size={13} color={accentColors.accent} filled />}
              <Text style={[styles.title, chat.unreadCount > 0 && styles.titleUnread]} numberOfLines={1}>
                {chat.title}
              </Text>
            </View>
            <Text style={styles.timestamp}>{formatTimestamp(chat.lastMessageAt)}</Text>
          </View>
          <View style={styles.previewLine}>
            <Text
              style={[styles.preview, chat.unreadCount > 0 && styles.previewUnread]}
              numberOfLines={1}
            >
              {chat.lastMessagePreview}
            </Text>
            {chat.muted && <BellOffIcon size={13} color={colors.textMuted} />}
            {chat.unreadCount > 0 && (
              <View style={[styles.badge, { backgroundColor: accentColors.accent }]}>
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
    paddingVertical: space[3],
    marginBottom: space[1],
    gap: space[4],
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkGlyph: {
    color: colors.bg,
    fontSize: 12,
    fontWeight: fontWeight.semibold,
  },
  middle: {
    flex: 1,
  },
  titleLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space[1],
    flexShrink: 1,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: fontWeight.medium,
    flexShrink: 1,
  },
  titleUnread: {
    fontWeight: fontWeight.bold,
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
  badge: {
    borderRadius: radius.full,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: colors.bg,
    fontSize: 11,
    fontWeight: fontWeight.bold,
  },
});
