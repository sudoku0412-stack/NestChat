import { useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAccentTheme } from '../lib/accentTheme';
import { colors, radius, space } from '../lib/theme';
import { getRecentEmojis } from '../lib/recentEmojis';
import { CopyIcon, PersonIcon, PinIcon, PlusIcon, ReplyIcon, StarIcon, TrashIcon, type IconProps } from './icons';

interface MessageActionsModalProps {
  visible: boolean;
  anchorY: number;
  isOwn: boolean;
  isStarred: boolean;
  isPinned: boolean;
  canCopy: boolean;
  currentReaction: string | null;
  onClose: () => void;
  onReply: () => void;
  onCopy: () => void;
  onToggleStar: () => void;
  onTogglePin: () => void;
  onViewContact: () => void;
  onDelete: () => void;
  onReact: (emoji: string) => void;
  onOpenFullEmojiPicker: () => void;
}

const REACTION_CELL_SIZE = 40;
const REACTION_BAR_HEIGHT = 56;
// The bar shows at most this many recent emojis before scrolling -- WhatsApp-style "recently
// used" rather than a fixed hardcoded set. Actual stored history can hold more (see
// lib/recentEmojis.ts); this only caps how many cells the bar's own width is sized for.
const VISIBLE_REACTION_COUNT = 8;
// +1 for the trailing "+" cell, which opens the full emoji picker (EmojiPickerModal) and is
// always reachable by scrolling even if recents fill the visible width.
const REACTION_BAR_WIDTH = (VISIBLE_REACTION_COUNT + 1) * REACTION_CELL_SIZE + space[2] * 2;
const SCREEN_MARGIN = space[4];

interface Row {
  key: string;
  label: string;
  onPress: () => void;
  Icon: (props: IconProps & { filled?: boolean }) => React.ReactElement;
  danger?: boolean;
  iconFilled?: boolean;
}

const ROW_HEIGHT = 50;
const CARD_WIDTH = 210;
const TOP_MARGIN = 60;
const BOTTOM_MARGIN = 100;

export function MessageActionsModal({
  visible,
  anchorY,
  isOwn,
  isStarred,
  isPinned,
  canCopy,
  currentReaction,
  onClose,
  onReply,
  onCopy,
  onToggleStar,
  onTogglePin,
  onViewContact,
  onDelete,
  onReact,
  onOpenFullEmojiPicker,
}: MessageActionsModalProps) {
  const { colors: accentColors } = useAccentTheme();
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) return;
    getRecentEmojis().then(setRecentEmojis);
  }, [visible]);

  function run(action: () => void) {
    onClose();
    action();
  }

  function handleReact(emoji: string) {
    onClose();
    onReact(emoji);
  }

  function handleOpenFullPicker() {
    onClose();
    onOpenFullEmojiPicker();
  }

  const rows: Row[] = [
    { key: 'reply', label: 'Reply', onPress: () => run(onReply), Icon: ReplyIcon },
    ...(canCopy ? [{ key: 'copy', label: 'Copy', onPress: () => run(onCopy), Icon: CopyIcon }] : []),
    {
      key: 'star',
      label: isStarred ? 'Unstar' : 'Star',
      onPress: () => run(onToggleStar),
      Icon: StarIcon,
      iconFilled: isStarred,
    },
    { key: 'pin', label: isPinned ? 'Unpin' : 'Pin', onPress: () => run(onTogglePin), Icon: PinIcon },
    ...(!isOwn
      ? [{ key: 'contact', label: 'View contact', onPress: () => run(onViewContact), Icon: PersonIcon }]
      : []),
    ...(isOwn
      ? [{ key: 'delete', label: 'Delete', onPress: () => run(onDelete), Icon: TrashIcon, danger: true }]
      : []),
  ];

  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const cardHeight = rows.length * ROW_HEIGHT + space[2] * 2;
  const totalHeight = REACTION_BAR_HEIGHT + space[2] + cardHeight;
  const top = Math.min(Math.max(anchorY, TOP_MARGIN), screenHeight - BOTTOM_MARGIN - totalHeight);

  // Anchor both the reaction bar and the action card to the same side the message bubble itself
  // sits on (own messages hug the right edge, others the left) -- previously both were pinned to
  // a fixed left offset regardless of isOwn, which read as misaligned for every own-message tap.
  const cardLeft = isOwn ? screenWidth - CARD_WIDTH - SCREEN_MARGIN : SCREEN_MARGIN;
  const reactionLeftRaw = isOwn ? cardLeft + CARD_WIDTH - REACTION_BAR_WIDTH : cardLeft;
  const reactionLeft = Math.min(
    Math.max(reactionLeftRaw, space[2]),
    screenWidth - REACTION_BAR_WIDTH - space[2]
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View
          style={[
            styles.reactionBar,
            { top, left: reactionLeft, width: REACTION_BAR_WIDTH, height: REACTION_BAR_HEIGHT },
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.reactionScroll}
            contentContainerStyle={styles.reactionScrollContent}
          >
            {recentEmojis.map((emoji) => (
              <Pressable
                key={emoji}
                style={[styles.reactionCell, currentReaction === emoji && styles.reactionCellActive]}
                onPress={() => handleReact(emoji)}
              >
                <Text style={styles.reactionGlyph}>{emoji}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.reactionCell} onPress={handleOpenFullPicker}>
              <PlusIcon size={18} color={colors.textMuted} />
            </Pressable>
          </ScrollView>
        </View>
        <View style={[styles.card, { top: top + REACTION_BAR_HEIGHT + space[2], left: cardLeft, width: CARD_WIDTH }]}>
          {rows.map((row) => (
            <Pressable key={row.key} style={styles.row} onPress={row.onPress}>
              <row.Icon
                size={20}
                color={row.danger ? colors.danger : row.iconFilled ? accentColors.accent : colors.text}
                filled={row.iconFilled}
              />
              <Text style={[styles.label, row.danger && styles.dangerText]}>{row.label}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  card: {
    position: 'absolute',
    backgroundColor: colors.neutral900,
    borderRadius: radius.lg,
    paddingVertical: space[2],
    overflow: 'hidden',
  },
  reactionBar: {
    position: 'absolute',
    backgroundColor: colors.neutral900,
    borderRadius: radius.full,
  },
  reactionScroll: {
    flex: 1,
    borderRadius: radius.full,
  },
  reactionScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[2],
  },
  reactionCell: {
    width: REACTION_CELL_SIZE,
    height: REACTION_CELL_SIZE,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionCellActive: {
    backgroundColor: colors.neutral700,
  },
  reactionGlyph: {
    fontSize: 22,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    height: ROW_HEIGHT,
  },
  label: {
    color: colors.text,
    fontSize: 16,
  },
  dangerText: {
    color: colors.danger,
  },
});
