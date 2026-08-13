import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useAccentTheme } from '../lib/accentTheme';
import { colors, fontWeight, radius, space } from '../lib/theme';
import {
  CameraIcon,
  CloseIcon,
  DocumentIcon,
  ImageIcon,
  KeyboardIcon,
  LocationPinIcon,
  PersonIcon,
  PlusIcon,
  SendIcon,
  StickerIcon,
} from './icons';
import { GifStickerPanel } from './GifStickerPanel';
import type { GiphyItem } from '../lib/giphy';

interface ComposerProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onPickCamera: () => void;
  onPickLibrary: () => void;
  onPickDocument: () => void;
  onPickContact: () => void;
  onShareLocation: () => void;
  onSelectGif: (item: GiphyItem, kind: 'gif' | 'sticker') => void;
  replyingTo?: { senderName: string; preview: string } | null;
  onCancelReply?: () => void;
}

const DRAWER_HEIGHT = 176;
// No keyboard has been measured yet this session (e.g. sticker icon tapped before the user ever
// focused the text input) -- a reasonable device-default until a real keyboardWillShow/
// keyboardDidShow event reports the actual height.
const DEFAULT_KEYBOARD_HEIGHT = Platform.OS === 'ios' ? 300 : 250;

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
  onSelectGif,
  replyingTo = null,
  onCancelReply,
}: ComposerProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(DEFAULT_KEYBOARD_HEIGHT);
  const insets = useSafeAreaInsets();
  const canSend = value.trim().length > 0;
  const rotation = useSharedValue(0);
  const sendAnim = useSharedValue(canSend ? 1 : 0);
  const inputRef = useRef<TextInput>(null);
  const { colors: accentColors } = useAccentTheme();

  useEffect(() => {
    sendAnim.value = withSpring(canSend ? 1 : 0, { damping: 16, stiffness: 220 });
  }, [canSend, sendAnim]);

  // Animates between a dimmed at-rest state and a full accent fill rather than 0 -> 1 --
  // fully hiding the button when the composer is empty read as "the send button disappeared"
  // (there's no mic/voice-note feature here to swap in for that empty state).
  const sendButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.82 + sendAnim.value * 0.18 }],
    opacity: 0.35 + sendAnim.value * 0.65,
  }));

  // Remembers the device's real keyboard height so the sticker panel can be sized to exactly
  // swap into that footprint instead of guessing — see DEFAULT_KEYBOARD_HEIGHT above for the
  // fallback before this has fired at least once.
  useEffect(() => {
    const event = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(event, (e) => {
      if (e.endCoordinates?.height) setKeyboardHeight(e.endCoordinates.height);
    });
    return () => sub.remove();
  }, []);
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
    setStickerOpen(false);
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

  // Same swap-in-place behavior as the attach drawer above, sized to keyboardHeight instead of
  // the fixed DRAWER_HEIGHT so it reads as "docked where the keyboard was" rather than a sheet.
  function openSticker() {
    Keyboard.dismiss();
    inputRef.current?.blur();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMenuOpen(false);
    setStickerOpen(true);
  }

  function closeSticker(animated: boolean) {
    if (animated) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStickerOpen(false);
  }

  function toggleSticker() {
    if (stickerOpen) {
      closeSticker(true);
      inputRef.current?.focus();
    } else {
      openSticker();
    }
  }

  function handleInputFocus() {
    if (menuOpen) closeMenu(false);
    if (stickerOpen) closeSticker(false);
  }

  function handleSelectGif(item: GiphyItem, kind: 'gif' | 'sticker') {
    closeSticker(true);
    onSelectGif(item, kind);
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
          <Pressable onPress={onCancelReply} hitSlop={8} style={styles.replyStripClose}>
            <CloseIcon size={16} color={colors.textMuted} />
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
        <Pressable style={styles.stickerButton} onPress={toggleSticker} hitSlop={8}>
          {stickerOpen ? (
            <KeyboardIcon size={22} color={colors.textMuted} />
          ) : (
            <StickerIcon size={22} color={colors.textMuted} />
          )}
        </Pressable>
        <Pressable style={styles.sendButton} onPress={onSend} disabled={!canSend} hitSlop={8}>
          <Animated.View
            style={[styles.sendButtonInner, { backgroundColor: accentColors.accent }, sendButtonStyle]}
          >
            <SendIcon size={16} color={accentColors.accent100} />
          </Animated.View>
        </Pressable>
      </View>

      <View
        style={[styles.drawer, { height: menuOpen ? DRAWER_HEIGHT : stickerOpen ? keyboardHeight : 0 }]}
        pointerEvents={menuOpen || stickerOpen ? 'auto' : 'none'}
      >
        {menuOpen && (
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
        )}
        <GifStickerPanel open={stickerOpen} onSelect={handleSelectGif} />
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
  stickerButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonInner: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
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
