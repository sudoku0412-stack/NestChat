import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useThemeMode } from '../../lib/themeMode';
import { useAccentTheme } from '../../lib/accentTheme';
import { ThemeColorPickerModal } from '../../components/ThemeColorPickerModal';
import { colors, fontWeight, space } from '../../lib/theme';

export default function AppearanceScreen() {
  const insets = useSafeAreaInsets();
  const { deepGround, setDeepGround, bg } = useThemeMode();
  const { colors: accentColors, accentHex } = useAccentTheme();
  const [themeModalVisible, setThemeModalVisible] = useState(false);

  return (
    <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: bg }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Appearance</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.headerRule} />

      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>Dark mode</Text>
        <Switch
          value={deepGround}
          onValueChange={setDeepGround}
          trackColor={{ true: accentColors.accent700, false: colors.neutral800 }}
          thumbColor={colors.text}
        />
      </View>
      <Pressable style={styles.settingRow} onPress={() => setThemeModalVisible(true)}>
        <Text style={styles.settingLabel}>App theme color</Text>
        <View style={[styles.themeSwatch, { backgroundColor: accentHex }]} />
      </Pressable>

      <ThemeColorPickerModal visible={themeModalVisible} onClose={() => setThemeModalVisible(false)} />
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
  back: {
    color: colors.text,
    fontSize: 28,
    width: 24,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: fontWeight.medium,
  },
  headerRule: {
    height: 2,
    backgroundColor: colors.divider,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[6],
    paddingVertical: space[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  settingLabel: {
    color: colors.text,
    fontSize: 15,
  },
  themeSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.divider,
  },
});
