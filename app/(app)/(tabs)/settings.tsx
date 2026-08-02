import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../lib/auth';
import { useMembers } from '../../../lib/hooks/useMembers';
import { supabase } from '../../../lib/supabase';
import { useThemeMode } from '../../../lib/themeMode';
import { Avatar } from '../../../components/Avatar';
import { MemberRow } from '../../../components/MemberRow';
import { OutlineButton } from '../../../components/OutlineButton';
import { colors, fontWeight, space } from '../../../lib/theme';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { profile, signOut, refreshProfile } = useAuth();
  const { members: others } = useMembers(profile?.id);
  const { deepGround, setDeepGround, bg } = useThemeMode();
  const [readReceipts, setReadReceipts] = useState(profile?.show_read_receipts ?? true);

  const allMembers = profile ? [profile, ...others] : others;

  async function toggleReadReceipts(value: boolean) {
    if (!profile) return;
    setReadReceipts(value);
    await supabase.from('users').update({ show_read_receipts: value }).eq('id', profile.id);
    refreshProfile();
  }

  function handleAddMember() {
    Alert.alert(
      'Add a contact',
      'There’s no invite code — just have them install NestChat and sign in with their own phone number. They’ll set up their name and photo, then show up here automatically.'
    );
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
          await supabase.rpc('remove_household_member', { target_user_id: userId });
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
              <View style={styles.profileRow}>
                <Avatar name={profile.display_name} avatarUrl={profile.avatar_url} size={56} />
                <View>
                  <Text style={styles.profileName}>{profile.display_name}</Text>
                  <Text style={styles.profileSub}>
                    {profile.role === 'admin' ? 'Admin' : 'Member'} · this device
                  </Text>
                </View>
              </View>
            )}

            <Text style={styles.sectionLabel}>Appearance</Text>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Dark mode</Text>
              <Switch
                value={deepGround}
                onValueChange={setDeepGround}
                trackColor={{ true: colors.accent700, false: colors.neutral800 }}
                thumbColor={colors.text}
              />
            </View>

            <Text style={styles.sectionLabel}>Privacy</Text>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Read receipts & online status</Text>
              <Switch
                value={readReceipts}
                onValueChange={toggleReadReceipts}
                trackColor={{ true: colors.accent700, false: colors.neutral800 }}
                thumbColor={colors.text}
              />
            </View>
            <Text style={styles.caption}>
              Turning this off hides your read receipts and online status from others, and hides
              theirs from you. Per-chat muting lives on the chat list and thread header, not here.
            </Text>

            <Text style={styles.sectionLabel}>Contacts ({allMembers.length})</Text>
          </>
        }
        ListFooterComponent={
          <>
            <Pressable style={styles.addRow} onPress={handleAddMember}>
              <Text style={styles.addLabel}>+ Add contact</Text>
            </Pressable>

            <View style={styles.logoutWrap}>
              <OutlineButton label="Log out" onPress={signOut} variant="neutral" />
            </View>
          </>
        }
      />
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
  addRow: {
    paddingHorizontal: space[6],
    paddingVertical: space[4],
  },
  addLabel: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: fontWeight.semibold,
  },
  logoutWrap: {
    paddingHorizontal: space[6],
    paddingVertical: space[8],
  },
});
