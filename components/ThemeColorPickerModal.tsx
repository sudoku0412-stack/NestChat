import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useAccentTheme } from '../lib/accentTheme';
import { useTheme } from '../lib/themeMode';
import { fontWeight, hexToHsl, hslToHex, radius, space } from '../lib/theme';

interface ThemeColorPickerModalProps {
  visible: boolean;
  onClose: () => void;
}

const BAR_HEIGHT = 40;
const HANDLE_SIZE = 26;
const PICKER_SATURATION = 68;
const PICKER_LIGHTNESS = 50;

function hueToHex(hue: number) {
  return hslToHex(hue, PICKER_SATURATION, PICKER_LIGHTNESS);
}

function normalizeHex(input: string): string | null {
  const clean = input.startsWith('#') ? input : `#${input}`;
  return /^#[0-9a-fA-F]{6}$/.test(clean) ? clean : null;
}

export function ThemeColorPickerModal({ visible, onClose }: ThemeColorPickerModalProps) {
  const { accentHex, setAccentColor } = useAccentTheme();
  const theme = useTheme();
  const [barWidth, setBarWidth] = useState(0);
  const [hue, setHue] = useState(0);
  const [hexInput, setHexInput] = useState(accentHex);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setHue(hexToHsl(accentHex).h);
      setHexInput(accentHex);
    }
  }, [visible, accentHex]);

  function handleBarTouch(x: number) {
    if (barWidth === 0) return;
    const clamped = Math.max(0, Math.min(barWidth, x));
    const newHue = (clamped / barWidth) * 360;
    setHue(newHue);
    setHexInput(hueToHex(newHue));
  }

  function handleHexChange(text: string) {
    setHexInput(text);
    const normalized = normalizeHex(text);
    if (normalized) setHue(hexToHsl(normalized).h);
  }

  async function handleSave() {
    const finalHex = normalizeHex(hexInput) ?? hueToHex(hue);
    setSaving(true);
    const error = await setAccentColor(finalHex);
    setSaving(false);
    if (error) {
      Alert.alert('Could not save theme color', error);
      return;
    }
    onClose();
  }

  const previewHex = normalizeHex(hexInput) ?? hueToHex(hue);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityViewIsModal>
        <Pressable style={[styles.card, { backgroundColor: theme.surface }]} onPress={(e) => e.stopPropagation()}>
          <Text style={[styles.title, { color: theme.text }]}>App theme color</Text>

          <View style={styles.previewRow}>
            <View style={[styles.swatch, { backgroundColor: previewHex }]} />
            <View style={[styles.previewBubble, { backgroundColor: previewHex }]}>
              <Text style={[styles.previewBubbleText, { color: theme.text }]}>Sample message</Text>
            </View>
          </View>

          <View
            style={styles.hueBarWrap}
            onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(e: GestureResponderEvent) => handleBarTouch(e.nativeEvent.locationX)}
            onResponderMove={(e: GestureResponderEvent) => handleBarTouch(e.nativeEvent.locationX)}
          >
            <Svg width="100%" height={BAR_HEIGHT} style={StyleSheet.absoluteFill}>
              <Defs>
                <LinearGradient id="hue" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="#ff0000" />
                  <Stop offset="0.17" stopColor="#ffff00" />
                  <Stop offset="0.33" stopColor="#00ff00" />
                  <Stop offset="0.5" stopColor="#00ffff" />
                  <Stop offset="0.67" stopColor="#0000ff" />
                  <Stop offset="0.83" stopColor="#ff00ff" />
                  <Stop offset="1" stopColor="#ff0000" />
                </LinearGradient>
              </Defs>
              <Rect x={0} y={0} width="100%" height={BAR_HEIGHT} rx={BAR_HEIGHT / 2} fill="url(#hue)" />
            </Svg>
            {barWidth > 0 && (
              <View
                pointerEvents="none"
                style={[
                  styles.handle,
                  {
                    left: Math.max(
                      0,
                      Math.min(barWidth - HANDLE_SIZE, (hue / 360) * barWidth - HANDLE_SIZE / 2)
                    ),
                    backgroundColor: previewHex,
                    borderColor: theme.text,
                  },
                ]}
              />
            )}
          </View>

          <View style={styles.hexRow}>
            <Text style={[styles.hexLabel, { color: theme.textMuted }]}>Hex</Text>
            <TextInput
              style={[styles.hexInput, { borderColor: theme.divider, color: theme.text }]}
              value={hexInput}
              onChangeText={handleHexChange}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={7}
              placeholder="#D97B4F"
              placeholderTextColor={theme.textMuted}
            />
          </View>

          <View style={styles.buttonsRow}>
            <Pressable onPress={onClose} style={[styles.cancelButton, { borderColor: theme.divider }]}>
              <Text style={[styles.cancelLabel, { color: theme.textMuted }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={[styles.saveButton, { backgroundColor: previewHex, opacity: saving ? 0.7 : 1 }]}
            >
              {saving ? <ActivityIndicator color={theme.bg} /> : <Text style={[styles.saveLabel, { color: theme.bg }]}>Save</Text>}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '86%',
    borderRadius: radius.lg,
    padding: space[6],
    gap: space[4],
  },
  title: {
    fontSize: 16,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
  },
  previewBubble: {
    flex: 1,
    borderRadius: radius.xl,
    borderBottomRightRadius: radius.sm,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  previewBubbleText: {
    fontSize: 14,
  },
  hueBarWrap: {
    height: BAR_HEIGHT,
    justifyContent: 'center',
  },
  handle: {
    position: 'absolute',
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    borderRadius: HANDLE_SIZE / 2,
    borderWidth: 3,
  },
  hexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  hexLabel: {
    fontSize: 13,
  },
  hexInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    fontSize: 15,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: space[3],
    marginTop: space[2],
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  cancelLabel: {
    fontSize: 15,
    fontWeight: fontWeight.medium,
  },
  saveButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space[3],
    borderRadius: radius.md,
  },
  saveLabel: {
    fontSize: 15,
    fontWeight: fontWeight.semibold,
  },
});
