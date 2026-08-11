import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../../lib/auth';
import { useMembers } from '../../../lib/hooks/useMembers';
import { supabase } from '../../../lib/supabase';
import { rotateChatKeyOnRemoval } from '../../../lib/crypto';
import { useThemeMode } from '../../../lib/themeMode';
import { Avatar } from '../../../components/Avatar';
import { MemberRow } from '../../../components/MemberRow';
import { OutlineButton } from '../../../components/OutlineButton';
import { PinModal } from '../../../components/PinModal';
import { ThemeColorPickerModal } from '../../../components/ThemeColorPickerModal';
import { useAccentTheme } from '../../../lib/accentTheme';
import { colors, fontWeight, space } from '../../../lib/theme';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { profile, signOut, refreshProfile, setPin } = useAuth();
  const { colors: accentColors, accentHex } = useAccentTheme();
  const { members: others } = useMembers(profile?.id);
  const { deepGround, setDeepGround, bg } = useThemeMode();
  const [readReceipts, setReadReceipts] = useState(profile?.show_read_receipts ?? true);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [themeModalVisible, setThemeModalVisible] = useState(false);

  const allMembers = profile ? [profile, ...others] : others;

  async function toggleReadReceipts(value: boolean) {
    if (!profile) return;
    setReadReceipts(value);
    await supabase.from('users').update({ show_read_receipts: value }).eq('id', profile.id);
    refreshProfile();
  }

  function handleRemoveMember(userId: string, name: string) {
    if (profile?.role !== 'admin') {
      Alert.alert('Admins only', 'Only an admin can remove a contact.');
      return;
    }
    Alert.alert('Remove member?', `${name} will lose access to NestChat.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          // Snapshot which chats they're in (and who else is) before removal deletes those rows
          // -- that's the only chance to know which chat keys need rotating forward.
          const { data: memberships } = await supabase
            .from('chat_members')
            .select('chat_id')
            .eq('user_id', userId);
          const chatIds = (memberships ?? []).map((m) => m.chat_id);
          const remainingByChat = new Map<string, string[]>();
          if (chatIds.length > 0) {
            const { data: coMembers } = await supabase
              .from('chat_members')
              .select('chat_id, user_id')
              .in('chat_id', chatIds);
            for (const row of coMembers ?? []) {
              if (row.user_id === userId) continue;
              const list = remainingByChat.get(row.chat_id) ?? [];
              list.push(row.user_id);
              remainingByChat.set(row.chat_id, list);
            }
          }

          await supabase.rpc('remove_household_member', { target_user_id: userId });

          for (const [chatId, remainingIds] of remainingByChat) {
            try {
              await rotateChatKeyOnRemoval(chatId, remainingIds);
            } catch (err) {
              console.warn('rotateChatKeyOnRemoval failed', chatId, err);
            }
          }
        },
      },
    ]);
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: bg }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>
      <View style={styles.headerRule} />

      <FlatList
        data={allMembers}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <MemberRow
            member={item}
            trailing={
              item.id !== profile?.id ? (
                <Pressable onPress={() => handleRemoveMember(item.id, item.display_name)} hitSlop={8}>
                  <Text style={styles.removeGlyph}>✕</Text>
                </Pressable>
              ) : null
            }
          />
        )}
        ListHeaderComponent={
          <>
            {profile && (
              <Pressable style={styles.profileRow} onPress={() => router.push('/(app)/edit-profile')}>
                <Avatar name={profile.display_name} avatarUrl={profile.avatar_url} size={56} />
                <View>
                  <Text style={styles.profileName}>{profile.display_name}</Text>
                  <Text style={styles.profileSub}>
                    {profile.role === 'admin' ? 'Admin' : 'Member'} · this device
                  </Text>
                </View>
              </Pressable>
            )}

            <Text style={styles.sectionLabel}>Appearance</Text>
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

            <Text style={styles.sectionLabel}>Privacy</Text>
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
              Turning this off hides your read receipts and online status from others, and hides
              theirs from you. Per-chat muting lives on the chat list and thread header, not here.
            </Text>

            <Text style={styles.sectionLabel}>Account</Text>
            <Pressable style={styles.settingRow} onPress={() => setPinModalVisible(true)}>
              <Text style={styles.settingLabel}>Recovery PIN</Text>
              <Text style={[styles.settingValue, { color: accentColors.accent }]}>{profile?.pin_hash ? 'Change' : 'Set up'}</Text>
            </Pressable>
            <Text style={styles.caption}>
              Needed to get your chats back if you ever sign out or reinstall the app.
            </Text>

            <Text style={styles.sectionLabel}>Contacts ({allMembers.length})</Text>
          </>
        }
        ListFooterComponent={
          <>
            <View style={styles.logoutWrap}>
              <OutlineButton label="Log out" onPress={signOut} variant="neutral" />
            </View>
          </>
        }
      />

      <PinModal
        visible={pinModalVisible}
        onClose={() => setPinModalVisible(false)}
        onSubmit={async (pin) => {
          const message = await setPin(pin);
          if (!message) refreshProfile();
          return message;
        }}
      />

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
    paddingHorizontal: space[6],
    paddingVertical: space[4],
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: fontWeight.heading,
  },
  headerRule: {
    height: 2,
    backgroundColor: colors.divider,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    paddingHorizontal: space[6],
    paddingVertical: space[6],
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  profileName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: fontWeight.heading,
  },
  profileSub: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 0.4,
    paddingHorizontal: space[6],
    paddingTop: space[6],
    paddingBottom: space[2],
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[6],
    paddingVertical: space[3],
  },
  settingLabel: {
    color: colors.text,
    fontSize: 15,
  },
  settingValue: {
    fontSize: 15,
    fontWeight: fontWeight.semibold,
  },
  themeSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  caption: {
    color: colors.textMuted,
    fontSize: 12,
    paddingHorizontal: space[6],
    paddingBottom: space[2],
    lineHeight: 17,
  },
  removeGlyph: {
    color: colors.danger,
    fontSize: 16,
  },
  logoutWrap: {
    paddingHorizontal: space[6],
    paddingVertical: space[8],
  },
});
