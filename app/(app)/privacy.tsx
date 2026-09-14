import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useTheme } from '../../lib/themeMode';
import { useAccentTheme } from '../../lib/accentTheme';
import { space } from '../../lib/theme';

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useAuth();
  const theme = useTheme();
  const { colors: accentColors } = useAccentTheme();
  const [readReceipts, setReadReceipts] = useState(profile?.show_read_receipts ?? true);

  async function toggleReadReceipts(value: boolean) {
    if (!profile) return;
    setReadReceipts(value);
    await supabase.from('users').update({ show_read_receipts: value }).eq('id', profile.id);
    refreshProfile();
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: theme.bg }]}>
      <ScreenHeader title="Privacy" theme={theme} />

      <View style={[styles.settingRow, { borderBottomColor: theme.divider }]}>
        <Text style={[styles.settingLabel, { color: theme.text }]}>Read receipts & online status</Text>
        <Switch
          value={readReceipts}
          onValueChange={toggleReadReceipts}
          trackColor={{ true: accentColors.accent700, false: theme.neutral800 }}
          thumbColor={theme.text}
        />
      </View>
      <Text style={[styles.caption, { color: theme.textMuted }]}>
        Turning this off hides your read receipts and online status from others, and hides theirs
        from you. Per-chat muting lives on the chat list and thread header, not here.
      </Text>
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
    flex: 1,
    paddingRight: space[4],
  },
  caption: {
    fontSize: 12,
    paddingHorizontal: space[6],
    paddingTop: space[2],
    lineHeight: 17,
  },
});
