import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { useChatList } from '../../lib/hooks/useChatList';
import { clearChat } from '../../lib/chatActions';
import { useAccentTheme } from '../../lib/accentTheme';
import { colors, fontWeight, space } from '../../lib/theme';

export default function ChatsSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { colors: accentColors } = useAccentTheme();
  const { chats } = useChatList(profile?.id ?? null);
  const [clearing, setClearing] = useState(false);

  function handleClearAllChats() {
    if (!profile || chats.length === 0) return;
    Alert.alert(
      'Clear all chats?',
      'This hides every message in every chat from your view only -- nobody else loses their copy.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear all',
          style: 'destructive',
          onPress: async () => {
            setClearing(true);
            await Promise.all(chats.map((c) => clearChat(c.id, profile.id)));
            setClearing(false);
          },
        },
      ]
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Chats</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.headerRule} />

      <Pressable style={styles.settingRow} onPress={handleClearAllChats} disabled={clearing}>
        <Text style={[styles.settingLabel, { color: colors.danger }]}>Clear all chats</Text>
        {clearing && <ActivityIndicator color={accentColors.accent} />}
      </Pressable>
      <Text style={styles.caption}>
        Per-chat wallpaper is set from that chat's contact info screen, not here.
      </Text>
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
    fontSize: 15,
  },
  caption: {
    color: colors.textMuted,
    fontSize: 12,
    paddingHorizontal: space[6],
    paddingTop: space[2],
    lineHeight: 17,
  },
});
