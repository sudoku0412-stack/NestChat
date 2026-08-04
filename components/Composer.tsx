import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  LayoutAnimation,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useAccentTheme } from '../lib/accentTheme';
import { colors, fontWeight, radius, space } from '../lib/theme';
import {
  CameraIcon,
  DocumentIcon,
  ImageIcon,
  LocationPinIcon,
  PersonIcon,
  PlusIcon,
} from './icons';

interface ComposerProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onPickCamera: () => void;
  onPickLibrary: () => void;
  onPickDocument: () => void;
  onPickContact: () => void;
  onShareLocation: () => void;
  replyingTo?: { senderName: string; preview: string } | null;
  onCancelReply?: () => void;
}

const DRAWER_HEIGHT = 176;

// Tints for the Gallery/Document cells are the two that vary with the user's chosen accent
// color; the rest are fixed neutral/success shades — see the `tints` map built inside the
// component below.
const MENU_META = [
  { key: 'camera', label: 'Camera', Icon: CameraIcon },
  { key: 'library', label: 'Gallery', Icon: ImageIcon },
  { key: 'document', label: 'Document', Icon: DocumentIcon },
  { key: 'contact', label: 'Contact', Icon: PersonIcon },
  { key: 'location', label: 'Location', Icon: LocationPinIcon },
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
  replyingTo = null,
  onCancelReply,
}: ComposerProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const canSend = value.trim().length > 0;
  const rotation = useSharedValue(0);
  const inputRef = useRef<TextInput>(null);
  const { colors: accentColors } = useAccentTheme();
  const tints: Record<(typeof MENU_META)[number]['key'], string> = {
    camera: colors.neutral600,
    library: accentColors.accent500,
    document: accentColors.accent700,
    contact: colors.neutral700,
    location: colors.success,
  };

  // The drawer's height is a *layout* property — animating it frame-by-frame (as this used to,
  // via Reanimated) forces a full native layout pass every frame, which is exactly what reads as
  // "jumping" rather than smooth, especially with the flexWrap grid inside reflowing. RN's native
  // LayoutAnimation hands the whole size change to the platform's own animator instead of
  // stepping through it in JS, which is the standard fix for this class of jank.
  //
  // The drawer and the keyboard both change the composer's height, so showing them at once is
  // also what caused the layout to fight itself (bounce) inside the screen's
  // KeyboardAvoidingView. Opening the drawer always dismisses the keyboard first. Closing it
  // animates normally for a deliberate tap (the "+" again, or picking an option), but snaps shut
  // with no animation at all when the keyboard is about to rise (the input was just focused), so
  // it never runs alongside the keyboard's own rise animation.
  function openMenu() {
    Keyboard.dismiss();
    inputRef.current?.blur();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMenuOpen(true);
  }

  function closeMenu(animated: boolean) {
    if (animated) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMenuOpen(false);
  }

  function toggleMenu() {
    if (menuOpen) closeMenu(true);
    else openMenu();
  }

  function handleInputFocus() {
    if (menuOpen) closeMenu(false);
  }

  useEffect(() => {
    rotation.value = withTiming(menuOpen ? 1 : 0, { duration: 160 });
  }, [menuOpen, rotation]);

  const plusStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 45}deg` }],
  }));

  const handlers: Record<(typeof MENU_META)[number]['key'], () => void> = {
    camera: onPickCamera,
    library: onPickLibrary,
    document: onPickDocument,
    contact: onPickContact,
    location: onShareLocation,
  };

  function handleSelect(key: (typeof MENU_META)[number]['key']) {
    closeMenu(true);
    handlers[key]();
  }

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom }]}>
      {replyingTo && (
        <View style={styles.replyStrip}>
          <View style={[styles.replyStripBar, { backgroundColor: accentColors.accent }]} />
          <View style={styles.replyStripTexts}>
            <Text style={[styles.replyStripName, { color: accentColors.accent }]}>{replyingTo.senderName}</Text>
            <Text style={styles.replyStripPreview} numberOfLines={1}>
              {replyingTo.preview}
            </Text>
          </View>
          <Pressable onPress={onCancelReply} hitSlop={8}>
            <Text style={styles.replyStripClose}>✕</Text>
          </Pressable>
        </View>
      )}
      <View style={styles.bar}>
        <Pressable style={styles.attachButton} onPress={toggleMenu}>
          <Animated.View style={plusStyle}>
            <PlusIcon size={20} color={colors.text} />
          </Animated.View>
        </Pressable>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleInputFocus}
          placeholder="Message"
          placeholderTextColor={colors.textMuted}
          multiline
        />
        <Pressable
          style={[
            styles.sendButton,
            !canSend ? styles.sendButtonDisabled : { borderColor: accentColors.accent },
          ]}
          onPress={onSend}
          disabled={!canSend}
        >
          <Text style={[styles.sendGlyph, !canSend ? styles.sendGlyphDisabled : { color: accentColors.accent }]}>
            ↑
          </Text>
        </Pressable>
      </View>

      <View
        style={[styles.drawer, { height: menuOpen ? DRAWER_HEIGHT : 0 }]}
        pointerEvents={menuOpen ? 'auto' : 'none'}
      >
        <View style={styles.grid}>
          {MENU_META.map((item) => (
            <Pressable key={item.key} style={styles.cell} onPress={() => handleSelect(item.key)}>
              <View style={[styles.iconCircle, { backgroundColor: tints[item.key] }]}>
                <item.Icon size={22} color={colors.text} />
              </View>
              <Text style={styles.cellLabel}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    borderColor: colors.divider,
  },
  sendGlyph: {
    fontSize: 18,
    fontWeight: fontWeight.semibold,
  },
  sendGlyphDisabled: {
    color: colors.textMuted,
  },
  replyStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    backgroundColor: colors.surface,
  },
  replyStripBar: {
    width: 3,
    height: 32,
    borderRadius: radius.full,
  },
  replyStripTexts: {
    flex: 1,
  },
  replyStripName: {
    fontSize: 12,
    fontWeight: fontWeight.medium,
  },
  replyStripPreview: {
    color: colors.textMuted,
    fontSize: 12,
  },
  replyStripClose: {
    color: colors.textMuted,
    fontSize: 16,
    paddingHorizontal: space[2],
  },
  drawer: {
    overflow: 'hidden',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: space[4],
    paddingTop: space[3],
  },
  cell: {
    width: '25%',
    alignItems: 'center',
    gap: space[2],
    paddingVertical: space[3],
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellLabel: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
  },
});
