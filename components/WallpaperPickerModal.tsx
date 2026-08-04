import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontWeight, radius, space } from '../lib/theme';
import { useAccentTheme } from '../lib/accentTheme';
import { pickImageFromLibrary, uploadWallpaper } from '../lib/media';
import { setChatWallpaper } from '../lib/chatActions';

interface WallpaperPickerModalProps {
  visible: boolean;
  chatId: string;
  userId: string;
  hasWallpaper: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export function WallpaperPickerModal({
  visible,
  chatId,
  userId,
  hasWallpaper,
  onClose,
  onChanged,
}: WallpaperPickerModalProps) {
  const { colors: accentColors } = useAccentTheme();
  const [busy, setBusy] = useState(false);

  async function handleChoosePhoto() {
    const asset = await pickImageFromLibrary();
    if (!asset) return;
    setBusy(true);
    try {
      const path = await uploadWallpaper(chatId, userId, asset);
      await setChatWallpaper(chatId, userId, path);
      onChanged();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    setBusy(true);
    try {
      await setChatWallpaper(chatId, userId, null);
      onChanged();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.menu}>
          <Text style={styles.title}>Chat wallpaper</Text>
          {busy ? (
            <View style={styles.busyRow}>
              <ActivityIndicator color={accentColors.accent} />
            </View>
          ) : (
            <>
              <Pressable style={styles.item} onPress={handleChoosePhoto}>
                <Text style={styles.label}>Choose photo</Text>
              </Pressable>
              {hasWallpaper && (
                <>
                  <View style={styles.divider} />
                  <Pressable style={styles.item} onPress={handleReset}>
                    <Text style={styles.label}>Reset to default</Text>
                  </Pressable>
                </>
              )}
            </>
          )}
        </View>
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
  menu: {
    margin: space[4],
    marginBottom: space[8],
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  title: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    paddingTop: space[4],
    paddingBottom: space[2],
  },
  item: {
    paddingVertical: space[4],
    paddingHorizontal: space[6],
  },
  label: {
    color: colors.text,
    fontSize: 16,
    fontWeight: fontWeight.medium,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  busyRow: {
    paddingVertical: space[6],
  },
});
