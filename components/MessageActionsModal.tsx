import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAccentTheme } from '../lib/accentTheme';
import { colors, radius, space } from '../lib/theme';
import { CopyIcon, PersonIcon, PinIcon, ReplyIcon, StarIcon, TrashIcon, type IconProps } from './icons';

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
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const REACTION_BAR_HEIGHT = 56;

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
}: MessageActionsModalProps) {
  const { colors: accentColors } = useAccentTheme();
  function run(action: () => void) {
    onClose();
    action();
  }

  function handleReact(emoji: string) {
    onClose();
    onReact(emoji);
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

  const screenHeight = Dimensions.get('window').height;
  const cardHeight = rows.length * ROW_HEIGHT + space[2] * 2;
  const totalHeight = REACTION_BAR_HEIGHT + space[2] + cardHeight;
  const top = Math.min(Math.max(anchorY, TOP_MARGIN), screenHeight - BOTTOM_MARGIN - totalHeight);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View
          style={[styles.reactionBar, { top, width: CARD_WIDTH, height: REACTION_BAR_HEIGHT }]}
        >
          {QUICK_REACTIONS.map((emoji) => (
            <Pressable
              key={emoji}
              style={[styles.reactionCell, currentReaction === emoji && styles.reactionCellActive]}
              onPress={() => handleReact(emoji)}
            >
              <Text style={styles.reactionGlyph}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
        <View style={[styles.card, { top: top + REACTION_BAR_HEIGHT + space[2], width: CARD_WIDTH }]}>
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
    left: space[6],
    backgroundColor: colors.neutral900,
    borderRadius: radius.lg,
    paddingVertical: space[2],
    overflow: 'hidden',
  },
  reactionBar: {
    position: 'absolute',
    left: space[6],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.neutral900,
    borderRadius: radius.full,
    paddingHorizontal: space[2],
  },
  reactionCell: {
    width: 36,
    height: 36,
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
