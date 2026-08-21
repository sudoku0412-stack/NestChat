import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { CloseIcon } from '../../../components/icons';
import { colors, fonts, fontWeight, radius, space } from '../../../lib/theme';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { profile, signOut } = useAuth();
  const { members: others } = useMembers(profile?.id);
  const { bg } = useThemeMode();

  const allMembers = profile ? [profile, ...others] : others;

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

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {profile && (
          <Pressable style={styles.profileCard} onPress={() => router.push('/(app)/edit-profile')}>
            <Avatar name={profile.display_name} avatarUrl={profile.avatar_url} size={56} />
            <View>
              <Text style={styles.profileName}>{profile.display_name}</Text>
              <Text style={styles.profileSub}>
                {profile.role === 'admin' ? 'Admin' : 'Member'} · this device
              </Text>
            </View>
          </Pressable>
        )}

        <Text style={styles.sectionLabel}>Contacts ({allMembers.length})</Text>
        <View style={styles.contactsCard}>
          {allMembers.map((item) => (
            <MemberRow
              key={item.id}
              member={item}
              trailing={
                item.id !== profile?.id ? (
                  <Pressable onPress={() => handleRemoveMember(item.id, item.display_name)} hitSlop={8}>
                    <CloseIcon size={16} color={colors.danger} />
                  </Pressable>
                ) : null
              }
            />
          ))}
        </View>

        <View style={styles.logoutWrap}>
          <OutlineButton label="Log out" onPress={signOut} variant="neutral" />
        </View>
      </ScrollView>
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
    fontFamily: fonts.display,
  },
  scrollContent: {
    paddingHorizontal: space[6],
    paddingBottom: space[8],
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    padding: space[6],
    marginBottom: space[6],
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
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
    paddingBottom: space[2],
  },
  contactsCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  logoutWrap: {
    paddingTop: space[8],
  },
});
