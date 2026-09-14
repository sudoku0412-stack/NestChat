import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { useAppContacts, type MatchedContact, type UnmatchedContact } from '../../lib/hooks/useAppContacts';
import { supabase } from '../../lib/supabase';
import { Avatar } from '../../components/Avatar';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useTheme } from '../../lib/themeMode';
import { useAccentTheme } from '../../lib/accentTheme';
import { fontWeight, radius, space, type Colors } from '../../lib/theme';

type Row =
  | { type: 'matched'; contact: MatchedContact }
  | { type: 'unmatched'; contact: UnmatchedContact };

export default function MembersScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { onNestChat, alsoOnNestChat, inviteOnly, loading, permissionDenied, retry } = useAppContacts(
    profile?.id
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [startingDm, setStartingDm] = useState<string | null>(null);
  const theme = useTheme();
  const { colors: accentColors } = useAccentTheme();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function startDirectMessage(userId: string) {
    setStartingDm(userId);
    const { data, error } = await supabase.rpc('find_or_create_dm', { other_user_id: userId });
    setStartingDm(null);
    if (error || !data) return;
    router.replace('/(app)/(tabs)');
    router.push(`/(app)/chat/${data}`);
  }

  function handleInvite(name: string) {
    Alert.alert(
      `Invite ${name}?`,
      'There’s no automatic invite yet — just share the app with them directly. They can sign in with their own phone number, no code needed.'
    );
  }

  function goToNewGroup() {
    router.push({ pathname: '/(app)/new-group', params: { memberIds: Array.from(selected).join(',') } });
  }

  const sections = [
    { title: 'On NestChat', data: onNestChat.map((c) => ({ type: 'matched', contact: c } as Row)) },
    { title: 'Also on NestChat', data: alsoOnNestChat.map((c) => ({ type: 'matched', contact: c } as Row)) },
    { title: 'Invite to NestChat', data: inviteOnly.map((c) => ({ type: 'unmatched', contact: c } as Row)) },
  ].filter((s) => s.data.length > 0);

  return (
    <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: theme.bg }]}>
      <ScreenHeader
        title="New Chat"
        theme={theme}
        right={
          <Pressable onPress={goToNewGroup} hitSlop={8}>
            <Text style={[styles.action, { color: accentColors.accent }]}>
              New Group{selected.size > 0 ? ` (${selected.size})` : ''}
            </Text>
          </Pressable>
        }
      />

      {permissionDenied && (
        <View style={[styles.permissionBanner, { backgroundColor: theme.surface, borderBottomColor: theme.divider }]}>
          <Text style={[styles.permissionText, { color: theme.textMuted }]}>
            Enable Contacts access to see which household members are already on NestChat.
          </Text>
          <Pressable onPress={() => Linking.openSettings()}>
            <Text style={[styles.permissionAction, { color: accentColors.accent }]}>Open Settings</Text>
          </Pressable>
          <Pressable onPress={retry} hitSlop={8}>
            <Text style={[styles.permissionAction, { color: accentColors.accent }]}>Retry</Text>
          </Pressable>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={accentColors.accent} style={{ marginTop: space[8] }} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(row) => row.contact.key}
          renderSectionHeader={({ section }) => (
            <Text style={[styles.sectionLabel, { color: theme.textMuted, backgroundColor: theme.bg }]}>{section.title}</Text>
          )}
          renderItem={({ item }) =>
            item.type === 'matched' ? (
              <ContactRow
                name={item.contact.displayName}
                avatarUrl={item.contact.member.avatar_url}
                onPress={() => startDirectMessage(item.contact.member.id)}
                checked={selected.has(item.contact.member.id)}
                onToggle={() => toggle(item.contact.member.id)}
                theme={theme}
                trailing={
                  startingDm === item.contact.member.id ? (
                    <ActivityIndicator color={accentColors.accent} />
                  ) : null
                }
              />
            ) : (
              <ContactRow
                name={item.contact.displayName}
                onPress={() => handleInvite(item.contact.displayName)}
                theme={theme}
                muted
              />
            )
          }
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              No contacts found. Household members you message will show up here once they're on
              NestChat.
            </Text>
          }
        />
      )}
    </View>
  );
}

interface ContactRowProps {
  name: string;
  avatarUrl?: string | null;
  onPress: () => void;
  checked?: boolean;
  onToggle?: () => void;
  trailing?: React.ReactNode;
  muted?: boolean;
  theme: Colors;
}

function ContactRow({ name, avatarUrl, onPress, checked, onToggle, trailing, muted, theme }: ContactRowProps) {
  const { colors: accentColors } = useAccentTheme();
  return (
    <Pressable style={[styles.row, { borderBottomColor: theme.divider }]} onPress={onPress}>
      {onToggle && (
        <Pressable
          style={[
            styles.checkbox,
            { borderColor: theme.textMuted },
            checked && { backgroundColor: accentColors.accent, borderColor: accentColors.accent },
          ]}
          onPress={onToggle}
          hitSlop={8}
        >
          {checked && <Text style={[styles.checkmark, { color: theme.bg }]}>✓</Text>}
        </Pressable>
      )}
      <Avatar name={name} avatarUrl={avatarUrl} size={40} />
      <Text style={[styles.rowName, { color: muted ? theme.textMuted : theme.text, fontWeight: muted ? fontWeight.body : fontWeight.medium }]}>{name}</Text>
      {trailing}
      {muted && <Text style={[styles.inviteLabel, { color: accentColors.accent }]}>Invite</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  action: {
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },
  permissionBanner: {
    padding: space[4],
    borderBottomWidth: 1,
    gap: space[2],
  },
  permissionText: {
    fontSize: 13,
  },
  permissionAction: {
    fontSize: 13,
    fontWeight: fontWeight.semibold,
  },
  sectionLabel: {
    fontSize: 12,
    letterSpacing: 0.4,
    paddingHorizontal: space[6],
    paddingTop: space[6],
    paddingBottom: space[2],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[6],
    paddingVertical: space[3],
    gap: space[4],
    borderBottomWidth: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    fontSize: 13,
    fontWeight: fontWeight.semibold,
  },
  rowName: {
    flex: 1,
    fontSize: 15,
  },
  inviteLabel: {
    fontSize: 13,
    fontWeight: fontWeight.semibold,
  },
  emptyText: {
    textAlign: 'center',
    padding: space[8],
  },
});
