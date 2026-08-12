import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { useAccentTheme } from '../../lib/accentTheme';
import { colors, fontWeight, space } from '../../lib/theme';

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useAuth();
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
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Notifications</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.headerRule} />

      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>Messages</Text>
        <Switch
          value={notifyMessages}
          onValueChange={(v) => {
            setNotifyMessages(v);
            update('notify_messages', v);
          }}
          trackColor={{ true: accentColors.accent700, false: colors.neutral800 }}
          thumbColor={colors.text}
        />
      </View>
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>Photos, videos & documents</Text>
        <Switch
          value={notifyMedia}
          onValueChange={(v) => {
            setNotifyMedia(v);
            update('notify_media', v);
          }}
          trackColor={{ true: accentColors.accent700, false: colors.neutral800 }}
          thumbColor={colors.text}
        />
      </View>
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>Reactions</Text>
        <Switch
          value={notifyReactions}
          onValueChange={(v) => {
            setNotifyReactions(v);
            update('notify_reactions', v);
          }}
          trackColor={{ true: accentColors.accent700, false: colors.neutral800 }}
          thumbColor={colors.text}
        />
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
});
