import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useTheme } from '../../lib/themeMode';
import { useAccentTheme } from '../../lib/accentTheme';
import { space } from '../../lib/theme';

const SUPPORT_EMAIL = 'support@craftloop.ca';

export default function HelpScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { colors: accentColors } = useAccentTheme();

  return (
    <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: theme.bg }]}>
      <ScreenHeader title="Help and feedback" theme={theme} />

      <Pressable style={[styles.row, { borderBottomColor: theme.divider }]} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
        <Text style={[styles.rowLabel, { color: accentColors.accent }]}>Email feedback or a bug report</Text>
      </Pressable>

      <View style={[styles.row, { borderBottomColor: theme.divider }]}>
        <Text style={[styles.rowLabel, { color: theme.text }]}>Version</Text>
        <Text style={[styles.rowValue, { color: theme.textMuted }]}>2.0.0</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[6],
    paddingVertical: space[4],
    borderBottomWidth: 1,
  },
  rowLabel: {
    fontSize: 15,
  },
  rowValue: {
    fontSize: 15,
  },
});
