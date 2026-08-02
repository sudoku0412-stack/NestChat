import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontWeight, radius, space } from '../lib/theme';

interface ComposerProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onPickCamera: () => void;
  onPickLibrary: () => void;
  onPickDocument: () => void;
  onPickContact: () => void;
  onShareLocation: () => void;
}

const MENU_ITEMS = [
  { key: 'camera', label: 'Camera', glyph: '📷', color: colors.accent700 },
  { key: 'library', label: 'Gallery', glyph: '🖼️', color: colors.accent600 },
  { key: 'document', label: 'Document', glyph: '📄', color: colors.neutral700 },
  { key: 'contact', label: 'Contact', glyph: '👤', color: colors.neutral600 },
  { key: 'location', label: 'Location', glyph: '📍', color: colors.accent800 },
] as const;

export function Composer({
  value,
  onChangeText,
  onSend,
  onPickCamera,
  onPickLibrary,
  onPickDocument,
  onPickContact,
  onShareLocation,
}: ComposerProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const canSend = value.trim().length > 0;

  const handlers: Record<(typeof MENU_ITEMS)[number]['key'], () => void> = {
    camera: onPickCamera,
    library: onPickLibrary,
    document: onPickDocument,
    contact: onPickContact,
    location: onShareLocation,
  };

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom }]}>
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.menu} onPress={(e) => e.stopPropagation()}>
            <View style={styles.menuHandle} />
            <View style={styles.menuGrid}>
              {MENU_ITEMS.map((item) => (
                <Pressable
                  key={item.key}
                  style={styles.menuCell}
                  onPress={() => {
                    setMenuOpen(false);
                    handlers[item.key]();
                  }}
                >
                  <View style={[styles.menuIcon, { backgroundColor: item.color }]}>
                    <Text style={styles.menuGlyph}>{item.glyph}</Text>
                  </View>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
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
    borderRadius: radius.full,
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
    borderRadius: radius.xl,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
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
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: space[3],
    paddingBottom: space[8],
    paddingHorizontal: space[4],
  },
  menuHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.divider,
    marginBottom: space[4],
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  menuCell: {
    width: '20%',
    alignItems: 'center',
    gap: space[2],
    paddingVertical: space[2],
  },
  menuIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuGlyph: {
    fontSize: 22,
  },
  menuLabel: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
  },
});
