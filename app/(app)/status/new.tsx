import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { CloseIcon } from '../../../components/icons';
import { useAccentTheme } from '../../../lib/accentTheme';
import { fontWeight, space } from '../../../lib/theme';
import { useTheme } from '../../../lib/themeMode';

type Mode = 'choose' | 'text' | 'media';

export default function NewStatusScreen() {
  const { colors: accentColors } = useAccentTheme();
  const theme = useTheme();
  // Swatch palette for text-status backgrounds — derived from the active theme (not the frozen
  // `colors` alias) since these values are rendered AND persisted with the posted status, and
  // must match whichever mode (light/dark) the user was in when they picked one.
  const BACKGROUND_COLORS = [
    theme.accent700,
    theme.accent900,
    theme.neutral800,
    theme.accent600,
    theme.neutral900,
  ];
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [mode, setMode] = useState<Mode>('choose');
  const [text, setText] = useState('');
  const [bgIndex, setBgIndex] = useState(0);
  const [mediaAsset, setMediaAsset] = useState<PickedAsset | null>(null);
  const [caption, setCaption] = useState('');
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
        await postMediaStatus(profile.id, mediaAsset, caption);
      }
      router.back();
    } finally {
      setPosting(false);
    }
  }

  if (mode === 'choose') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: theme.bg }]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={styles.close}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <CloseIcon size={20} color={theme.text} />
          </Pressable>
          <Text style={[styles.title, { color: theme.text }]}>New status</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.chooseBody}>
          <Pressable
            style={[styles.chooseOption, { borderColor: theme.divider, backgroundColor: theme.surface }]}
            onPress={() => setMode('text')}
          >
            <Text style={[styles.chooseGlyph, { color: theme.text }]}>Aa</Text>
            <Text style={[styles.chooseLabel, { color: theme.text }]}>Write a status</Text>
          </Pressable>
          <Pressable
            style={[styles.chooseOption, { borderColor: theme.divider, backgroundColor: theme.surface }]}
            onPress={() => setAttachMenuOpen(true)}
          >
            <Text style={styles.chooseGlyph}>📷</Text>
            <Text style={[styles.chooseLabel, { color: theme.text }]}>Photo or video</Text>
          </Pressable>
        </View>

        <Modal visible={attachMenuOpen} transparent animationType="fade" onRequestClose={() => setAttachMenuOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setAttachMenuOpen(false)}>
            <View style={[styles.menu, { backgroundColor: theme.surface }]}>
              <Pressable style={styles.menuItem} onPress={() => handlePick('camera')}>
                <Text style={[styles.menuLabel, { color: theme.text }]}>Camera</Text>
              </Pressable>
              <View style={[styles.menuDivider, { backgroundColor: theme.divider }]} />
              <Pressable style={styles.menuItem} onPress={() => handlePick('library')}>
                <Text style={[styles.menuLabel, { color: theme.text }]}>Photo & Video Library</Text>
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
          <Pressable
            onPress={() => setMode('choose')}
            hitSlop={8}
            style={styles.close}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <CloseIcon size={20} color={theme.text} />
          </Pressable>
          {posting ? (
            <ActivityIndicator color={theme.text} />
          ) : (
            <Pressable
              onPress={handlePost}
              disabled={!text.trim()}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Post status"
              accessibilityState={{ disabled: !text.trim() }}
            >
              <Text
                style={[
                  styles.post,
                  { color: accentColors.accent },
                  !text.trim() && { color: theme.textMuted },
                ]}
              >
                Post
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.textBody}>
          <TextInput
            style={[styles.textInput, { color: theme.text }]}
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
              style={[
                styles.swatch,
                { backgroundColor: c },
                i === bgIndex && { borderColor: theme.text },
              ]}
              onPress={() => setBgIndex(i)}
            />
          ))}
        </View>
      </View>
    );
  }

  // mode === 'media'
  return (
    <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: theme.bg }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => setMode('choose')}
          hitSlop={8}
          style={styles.close}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <CloseIcon size={20} color={theme.text} />
        </Pressable>
        {posting ? (
          <ActivityIndicator color={theme.text} />
        ) : (
          <Pressable onPress={handlePost} hitSlop={8} accessibilityRole="button" accessibilityLabel="Post status">
            <Text style={[styles.post, { color: theme.text }]}>Post</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.mediaPreviewWrap}>
        {mediaAsset && <Image source={{ uri: mediaAsset.uri }} style={styles.mediaPreview} resizeMode="contain" />}
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.captionRow, { paddingBottom: insets.bottom + space[4] }]}>
          <TextInput
            style={[styles.captionInput, { color: theme.text }]}
            value={caption}
            onChangeText={setCaption}
            placeholder="Add a caption…"
            placeholderTextColor={theme.textMuted}
            multiline
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[6],
    paddingVertical: space[4],
  },
  close: {
    width: 24,
  },
  title: {
    fontSize: 17,
    fontWeight: fontWeight.medium,
  },
  post: {
    fontSize: 15,
    fontWeight: fontWeight.semibold,
  },
  chooseBody: {
    flex: 1,
    justifyContent: 'center',
    gap: space[6],
    paddingHorizontal: space[8],
  },
  chooseOption: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: space[8],
    alignItems: 'center',
    gap: space[3],
  },
  chooseGlyph: {
    fontSize: 32,
  },
  chooseLabel: {
    fontSize: 15,
    fontWeight: fontWeight.medium,
  },
  textBody: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: space[8],
  },
  textInput: {
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  menu: {
    margin: space[4],
    marginBottom: space[8],
    borderRadius: 8,
    overflow: 'hidden',
  },
  menuItem: {
    paddingVertical: space[4],
    paddingHorizontal: space[6],
  },
  menuLabel: {
    fontSize: 16,
    textAlign: 'center',
  },
  menuDivider: {
    height: 1,
  },
  mediaPreviewWrap: {
    flex: 1,
    backgroundColor: '#000',
  },
  mediaPreview: {
    flex: 1,
  },
  captionRow: {
    backgroundColor: '#000',
    paddingHorizontal: space[4],
    paddingTop: space[3],
  },
  captionInput: {
    fontSize: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    maxHeight: 100,
  },
});
