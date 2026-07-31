import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fontWeight, radius, space } from '../lib/theme';

interface ComposerProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onPickCamera: () => void;
  onPickLibrary: () => void;
}

export function Composer({ value, onChangeText, onSend, onPickCamera, onPickLibrary }: ComposerProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const canSend = value.trim().length > 0;

  return (
    <View style={styles.wrapper}>
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
          <View style={styles.menu}>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                onPickCamera();
              }}
            >
              <Text style={styles.menuLabel}>Camera</Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                onPickLibrary();
              }}
            >
              <Text style={styles.menuLabel}>Photo & Video Library</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <View style={styles.bar}>
        <Pressable style={styles.attachButton} onPress={() => setMenuOpen(true)}>
          <Text style={styles.attachGlyph}>+</Text>
        </Pressable>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder="Message"
          placeholderTextColor={colors.textMuted}
          multiline
        />
        <Pressable style={[styles.sendButton, !canSend && styles.sendButtonDisabled]} onPress={onSend} disabled={!canSend}>
          <Text style={[styles.sendGlyph, !canSend && styles.sendGlyphDisabled]}>↑</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.bg,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    gap: space[2],
  },
  attachButton: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachGlyph: {
    color: colors.text,
    fontSize: 20,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    maxHeight: 120,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    borderColor: colors.divider,
  },
  sendGlyph: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: fontWeight.semibold,
  },
  sendGlyphDisabled: {
    color: colors.textMuted,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  menu: {
    margin: space[4],
    marginBottom: space[8],
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  menuItem: {
    paddingVertical: space[4],
    paddingHorizontal: space[6],
  },
  menuLabel: {
    color: colors.text,
    fontSize: 16,
    textAlign: 'center',
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.divider,
  },
});
