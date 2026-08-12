import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAccentTheme } from '../../lib/accentTheme';
import { colors, space } from '../../lib/theme';

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useAuth();
  const { colors: accentColors } = useAccentTheme();
  const [readReceipts, setReadReceipts] = useState(profile?.show_read_receipts ?? true);

  async function toggleReadReceipts(value: boolean) {
    if (!profile) return;
    setReadReceipts(value);
    await supabase.from('users').update({ show_read_receipts: value }).eq('id', profile.id);
    refreshProfile();
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader title="Privacy" />

      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>Read receipts & online status</Text>
        <Switch
          value={readReceipts}
          onValueChange={toggleReadReceipts}
          trackColor={{ true: accentColors.accent700, false: colors.neutral800 }}
          thumbColor={colors.text}
        />
      </View>
      <Text style={styles.caption}>
        Turning this off hides your read receipts and online status from others, and hides theirs
        from you. Per-chat muting lives on the chat list and thread header, not here.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
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
    flex: 1,
    paddingRight: space[4],
  },
  caption: {
    color: colors.textMuted,
    fontSize: 12,
    paddingHorizontal: space[6],
    paddingTop: space[2],
    lineHeight: 17,
  },
});
