import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAccentTheme } from '../../lib/accentTheme';
import { colors, fontWeight, space } from '../../lib/theme';

const SUPPORT_EMAIL = 'support@craftloop.ca';

export default function HelpScreen() {
  const insets = useSafeAreaInsets();
  const { colors: accentColors } = useAccentTheme();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Help and feedback</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.headerRule} />

      <Pressable style={styles.row} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
        <Text style={[styles.rowLabel, { color: accentColors.accent }]}>Email feedback or a bug report</Text>
      </Pressable>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Version</Text>
        <Text style={styles.rowValue}>2.0.0</Text>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[6],
    paddingVertical: space[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowLabel: {
    color: colors.text,
    fontSize: 15,
  },
  rowValue: {
    color: colors.textMuted,
    fontSize: 15,
  },
});
