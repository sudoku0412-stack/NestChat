import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeMode, useTheme, type ThemeModeSetting } from '../../lib/themeMode';
import { useAccentTheme } from '../../lib/accentTheme';
import { ThemeColorPickerModal } from '../../components/ThemeColorPickerModal';
import { ScreenHeader } from '../../components/ScreenHeader';
import { fontWeight, space } from '../../lib/theme';

const MODE_OPTIONS: { value: ThemeModeSetting; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function AppearanceScreen() {
  const insets = useSafeAreaInsets();
  const { mode, setMode } = useThemeMode();
  const theme = useTheme();
  const { accentHex } = useAccentTheme();
  const [themeModalVisible, setThemeModalVisible] = useState(false);

  return (
    <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: theme.bg }]}>
      <ScreenHeader title="Appearance" theme={theme} />

      <View style={styles.settingRow}>
        <Text style={[styles.settingLabel, { color: theme.text }]}>Theme</Text>
        <View style={[styles.modeSeg, { backgroundColor: theme.surface }]}>
          {MODE_OPTIONS.map((opt) => {
            const active = mode === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setMode(opt.value)}
                style={[styles.modeOption, active && { backgroundColor: theme.accent }]}
              >
                <Text
                  style={[
                    styles.modeOptionLabel,
                    { color: active ? theme.bg : theme.textMuted },
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Pressable
        style={[styles.settingRow, { borderBottomColor: theme.divider }]}
        onPress={() => setThemeModalVisible(true)}
      >
        <Text style={[styles.settingLabel, { color: theme.text }]}>App theme color</Text>
        <View style={[styles.themeSwatch, { backgroundColor: accentHex, borderColor: theme.divider }]} />
      </Pressable>

      <ThemeColorPickerModal visible={themeModalVisible} onClose={() => setThemeModalVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[6],
    paddingVertical: space[4],
    borderBottomWidth: 1,
  },
  settingLabel: {
    fontSize: 15,
  },
  modeSeg: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 3,
    gap: 2,
  },
  modeOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  modeOptionLabel: {
    fontSize: 13,
    fontWeight: fontWeight.semibold,
  },
  themeSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
  },
});
