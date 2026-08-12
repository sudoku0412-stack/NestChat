import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { rotateChatKeyOnRemoval } from '../../lib/crypto';
import { PinModal } from '../../components/PinModal';
import { useAccentTheme } from '../../lib/accentTheme';
import { colors, fontWeight, space } from '../../lib/theme';

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile, setPin, signOut } = useAuth();
  const { colors: accentColors } = useAccentTheme();
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function performDeleteAccount() {
    if (!profile) return;
    setDeleting(true);
    try {
      // Snapshot who else is in each of our chats *before* the RPC deletes our chat_members rows
      // -- that's the only chance to know which chat keys need rotating forward. Same shape as
      // settings.tsx's handleRemoveMember.
      const { data: memberships } = await supabase
        .from('chat_members')
        .select('chat_id')
        .eq('user_id', profile.id);
      const chatIds = (memberships ?? []).map((m) => m.chat_id);
      const remainingByChat = new Map<string, string[]>();
      if (chatIds.length > 0) {
        const { data: coMembers } = await supabase
          .from('chat_members')
          .select('chat_id, user_id')
          .in('chat_id', chatIds);
        for (const row of coMembers ?? []) {
          if (row.user_id === profile.id) continue;
          const list = remainingByChat.get(row.chat_id) ?? [];
          list.push(row.user_id);
          remainingByChat.set(row.chat_id, list);
        }
      }

      const { error } = await supabase.rpc('delete_own_account');
      if (error) {
        Alert.alert('Could not delete account', error.message);
        return;
      }

      for (const [chatId, remainingIds] of remainingByChat) {
        try {
          await rotateChatKeyOnRemoval(chatId, remainingIds);
        } catch (err) {
          console.warn('rotateChatKeyOnRemoval failed', chatId, err);
        }
      }

      await signOut();
    } finally {
      setDeleting(false);
    }
  }

  async function handleDeleteAccount() {
    if (!profile) return;
    if (profile.role === 'admin') {
      // Friendly early exit only -- delete_own_account enforces this for real regardless.
      const { count } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin')
        .is('deleted_at', null)
        .neq('id', profile.id);
      if (!count) {
        Alert.alert(
          "You're the only admin",
          'Promote another member to admin from the household list before deleting your account.'
        );
        return;
      }
    }
    Alert.alert(
      'Delete my account?',
      "This can't be undone. Your chats stay visible to others, but your name will show as \"Deleted account.\"",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: performDeleteAccount },
      ]
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Account</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.headerRule} />

      <View style={styles.row}>
        <Text style={styles.rowLabelStatic}>Phone</Text>
        <Text style={styles.rowValue}>{profile?.phone ?? '—'}</Text>
      </View>

      <Pressable style={styles.row} onPress={() => setPinModalVisible(true)}>
        <Text style={styles.rowLabelStatic}>Recovery PIN</Text>
        <Text style={[styles.rowValue, { color: accentColors.accent }]}>
          {profile?.pin_hash ? 'Change' : 'Set up'}
        </Text>
      </Pressable>
      <Text style={styles.caption}>
        Needed to get your chats back if you ever sign out or reinstall the app.
      </Text>

      <Pressable style={styles.row} onPress={handleDeleteAccount} disabled={deleting}>
        <Text style={[styles.rowLabelStatic, { color: colors.danger }]}>Delete my account</Text>
        {deleting && <ActivityIndicator color={accentColors.accent} />}
      </Pressable>

      <PinModal
        visible={pinModalVisible}
        onClose={() => setPinModalVisible(false)}
        onSubmit={async (pin) => {
          const message = await setPin(pin);
          if (!message) refreshProfile();
          return message;
        }}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[6],
    paddingVertical: space[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowLabelStatic: {
    color: colors.text,
    fontSize: 15,
  },
  rowValue: {
    fontSize: 15,
    color: colors.textMuted,
  },
  caption: {
    color: colors.textMuted,
    fontSize: 12,
    paddingHorizontal: space[6],
    paddingTop: space[2],
    lineHeight: 17,
  },
});
