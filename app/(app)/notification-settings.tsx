import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useTheme } from '../../lib/themeMode';
import { useAccentTheme } from '../../lib/accentTheme';
import { space } from '../../lib/theme';

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useAuth();
  const theme = useTheme();
  const { colors: accentColors } = useAccentTheme();
  const [notifyMessages, setNotifyMessages] = useState(profile?.notify_messages ?? true);
  const [notifyMedia, setNotifyMedia] = useState(profile?.notify_media ?? true);
  const [notifyReactions, setNotifyReactions] = useState(profile?.notify_reactions ?? true);

  async function update(column: 'notify_messages' | 'notify_media' | 'notify_reactions', value: boolean) {
    if (!profile) return;
    const patch =
      column === 'notify_messages'
        ? { notify_messages: value }
        : column === 'notify_media'
          ? { notify_media: value }
          : { notify_reactions: value };
    await supabase.from('users').update(patch).eq('id', profile.id);
    refreshProfile();
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: theme.bg }]}>
      <ScreenHeader title="Notifications" theme={theme} />

      <View style={[styles.settingRow, { borderBottomColor: theme.divider }]}>
        <Text style={[styles.settingLabel, { color: theme.text }]}>Messages</Text>
        <Switch
          value={notifyMessages}
          onValueChange={(v) => {
            setNotifyMessages(v);
            update('notify_messages', v);
          }}
          trackColor={{ true: accentColors.accent700, false: theme.neutral800 }}
          thumbColor={theme.text}
        />
      </View>
      <View style={[styles.settingRow, { borderBottomColor: theme.divider }]}>
        <Text style={[styles.settingLabel, { color: theme.text }]}>Photos, videos & documents</Text>
        <Switch
          value={notifyMedia}
          onValueChange={(v) => {
            setNotifyMedia(v);
            update('notify_media', v);
          }}
          trackColor={{ true: accentColors.accent700, false: theme.neutral800 }}
          thumbColor={theme.text}
        />
      </View>
      <View style={[styles.settingRow, { borderBottomColor: theme.divider }]}>
        <Text style={[styles.settingLabel, { color: theme.text }]}>Reactions</Text>
        <Switch
          value={notifyReactions}
          onValueChange={(v) => {
            setNotifyReactions(v);
            update('notify_reactions', v);
          }}
          trackColor={{ true: accentColors.accent700, false: theme.neutral800 }}
          thumbColor={theme.text}
        />
      </View>
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
});
