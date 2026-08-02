import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../../lib/auth';
import { pickFromCamera, pickFromLibrary, type PickedAsset } from '../../../lib/media';
import { postMediaStatus, postTextStatus } from '../../../lib/statusActions';
import { colors, fontWeight, space } from '../../../lib/theme';

const BACKGROUND_COLORS = [
  colors.accent700,
  colors.accent900,
  colors.neutral800,
  colors.accent600,
  colors.neutral900,
];

type Mode = 'choose' | 'text' | 'media';

export default function NewStatusScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [mode, setMode] = useState<Mode>('choose');
  const [text, setText] = useState('');
  const [bgIndex, setBgIndex] = useState(0);
  const [mediaAsset, setMediaAsset] = useState<PickedAsset | null>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [posting, setPosting] = useState(false);

  async function handlePick(source: 'camera' | 'library') {
    setAttachMenuOpen(false);
    const asset = source === 'camera' ? await pickFromCamera() : await pickFromLibrary();
    if (asset) {
      setMediaAsset(asset);
      setMode('media');
    }
  }

  async function handlePost() {
    if (!profile) return;
    setPosting(true);
    try {
      if (mode === 'text' && text.trim()) {
        await postTextStatus(profile.id, text.trim(), BACKGROUND_COLORS[bgIndex]!);
      } else if (mode === 'media' && mediaAsset) {
        await postMediaStatus(profile.id, mediaAsset);
      }
      router.back();
    } finally {
      setPosting(false);
    }
  }

  if (mode === 'choose') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
          <Text style={styles.title}>New status</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.chooseBody}>
          <Pressable style={styles.chooseOption} onPress={() => setMode('text')}>
            <Text style={styles.chooseGlyph}>Aa</Text>
            <Text style={styles.chooseLabel}>Write a status</Text>
          </Pressable>
          <Pressable style={styles.chooseOption} onPress={() => setAttachMenuOpen(true)}>
            <Text style={styles.chooseGlyph}>📷</Text>
            <Text style={styles.chooseLabel}>Photo or video</Text>
          </Pressable>
        </View>

        <Modal visible={attachMenuOpen} transparent animationType="fade" onRequestClose={() => setAttachMenuOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setAttachMenuOpen(false)}>
            <View style={styles.menu}>
              <Pressable style={styles.menuItem} onPress={() => handlePick('camera')}>
                <Text style={styles.menuLabel}>Camera</Text>
              </Pressable>
              <View style={styles.menuDivider} />
              <Pressable style={styles.menuItem} onPress={() => handlePick('library')}>
                <Text style={styles.menuLabel}>Photo & Video Library</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      </View>
    );
  }

  if (mode === 'text') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: BACKGROUND_COLORS[bgIndex] }]}>
        <View style={styles.header}>
          <Pressable onPress={() => setMode('choose')} hitSlop={8}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
          {posting ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Pressable onPress={handlePost} disabled={!text.trim()} hitSlop={8}>
              <Text style={[styles.post, !text.trim() && styles.postDisabled]}>Post</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.textBody}>
          <TextInput
            style={styles.textInput}
            value={text}
            onChangeText={setText}
            placeholder="Type a status…"
            placeholderTextColor="rgba(233,233,237,0.5)"
            multiline
            autoFocus
          />
        </View>

        <View style={[styles.swatchRow, { paddingBottom: insets.bottom + space[6] }]}>
          {BACKGROUND_COLORS.map((c, i) => (
            <Pressable
              key={c}
              style={[styles.swatch, { backgroundColor: c }, i === bgIndex && styles.swatchActive]}
              onPress={() => setBgIndex(i)}
            />
          ))}
        </View>
      </View>
    );
  }

  // mode === 'media'
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => setMode('choose')} hitSlop={8}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
        {posting ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Pressable onPress={handlePost} hitSlop={8}>
            <Text style={styles.post}>Post</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.mediaPreviewWrap}>
        {mediaAsset && <Image source={{ uri: mediaAsset.uri }} style={styles.mediaPreview} resizeMode="contain" />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[6],
    paddingVertical: space[4],
  },
  close: {
    color: colors.text,
    fontSize: 20,
    width: 24,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: fontWeight.medium,
  },
  post: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: fontWeight.semibold,
  },
  postDisabled: {
    color: colors.textMuted,
  },
  chooseBody: {
    flex: 1,
    justifyContent: 'center',
    gap: space[6],
    paddingHorizontal: space[8],
  },
  chooseOption: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 12,
    paddingVertical: space[8],
    alignItems: 'center',
    gap: space[3],
    backgroundColor: colors.surface,
  },
  chooseGlyph: {
    fontSize: 32,
    color: colors.text,
  },
  chooseLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: fontWeight.medium,
  },
  textBody: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: space[8],
  },
  textInput: {
    color: colors.text,
    fontSize: 26,
    fontWeight: fontWeight.medium,
    textAlign: 'center',
  },
  swatchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space[3],
    paddingTop: space[4],
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchActive: {
    borderColor: colors.text,
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
    borderRadius: 8,
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
  mediaPreviewWrap: {
    flex: 1,
    backgroundColor: '#000',
  },
  mediaPreview: {
    flex: 1,
  },
});
