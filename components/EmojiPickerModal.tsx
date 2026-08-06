import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontWeight, radius, space } from '../lib/theme';

interface EmojiPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
}

// A curated, hand-picked set rather than a full Unicode emoji database -- no extra dependency,
// no per-platform emoji-metadata concerns, and it covers what a household chat actually reacts
// with. QUICK_REACTIONS in MessageActionsModal already covers the top 6; this "+" picker is for
// everything else.
const EMOJIS = [
  '😀', '😂', '🤣', '😊', '😍', '😘', '😜', '🤔', '😎', '🥳',
  '😭', '😢', '😡', '😱', '😴', '🥺', '😇', '🤗', '🙃', '😏',
  '👍', '👎', '👏', '🙏', '💪', '🤝', '✌️', '🤞', '👌', '🤙',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💯', '🔥',
  '🎉', '🎂', '🎁', '⭐', '✨', '💤', '💩', '👀', '🙌', '🤦',
  '🤷', '🥰', '😅', '😬', '🤯', '😤', '🤤', '😋', '🤑', '🥶',
];
const COLUMN_COUNT = 6;

export function EmojiPickerModal({ visible, onClose, onSelect }: EmojiPickerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>React</Text>
          <FlatList
            data={EMOJIS}
            keyExtractor={(e, i) => `${e}-${i}`}
            numColumns={COLUMN_COUNT}
            contentContainerStyle={styles.grid}
            renderItem={({ item }) => (
              <Pressable
                style={styles.cell}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
              >
                <Text style={styles.glyph}>{item}</Text>
              </Pressable>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '60%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: space[4],
    paddingBottom: space[8],
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: fontWeight.semibold,
    paddingHorizontal: space[6],
    marginBottom: space[3],
  },
  grid: {
    paddingHorizontal: space[4],
  },
  cell: {
    flex: 1 / COLUMN_COUNT,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    fontSize: 28,
  },
});
