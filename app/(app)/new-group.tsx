import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { useMembers } from '../../lib/hooks/useMembers';
import { supabase } from '../../lib/supabase';
import { sendTextMessage } from '../../lib/chatActions';
import { MemberRow } from '../../components/MemberRow';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAccentTheme } from '../../lib/accentTheme';
import { colors, fontWeight, space } from '../../lib/theme';

export default function NewGroupScreen() {
  const { colors: accentColors } = useAccentTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { memberIds } = useLocalSearchParams<{ memberIds?: string }>();
  const { members, loading } = useMembers(profile?.id);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(
    new Set((memberIds ?? '').split(',').filter(Boolean))
  );
  const [creating, setCreating] = useState(false);

  const canCreate = name.trim().length > 0 && selected.size >= 2 && !creating;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    if (!canCreate || !profile) return;
    setCreating(true);

    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .insert({ type: 'group', name: name.trim(), created_by: profile.id })
      .select()
      .single();

    if (chatError || !chat) {
      setCreating(false);
      return;
    }

    const memberRows = [profile.id, ...Array.from(selected)].map((user_id) => ({
      chat_id: chat.id,
      user_id,
    }));
    await supabase.from('chat_members').insert(memberRows);

    // Routed through sendTextMessage (not a raw insert) so this system message goes through the
    // same encryption path as everything else -- a stray plaintext write here would otherwise be
    // a silent leak once encrypted sending is on for this chat.
    await sendTextMessage(chat.id, profile.id, `${profile.display_name} created “${name.trim()}”`);

    setCreating(false);
    router.replace('/(app)/(tabs)');
    router.push(`/(app)/chat/${chat.id}`);
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="New group"
        right={
          <Pressable onPress={handleCreate} disabled={!canCreate} hitSlop={8}>
            {creating ? (
              <ActivityIndicator color={accentColors.accent} />
            ) : (
              <Text style={[styles.action, { color: accentColors.accent }, !canCreate && styles.actionDisabled]}>Create</Text>
            )}
          </Pressable>
        }
      />

      <View style={styles.nameField}>
        <TextInput
          style={styles.nameInput}
          placeholder="Group name"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
        />
      </View>

      <Text style={styles.sectionLabel}>Add members ({selected.size})</Text>

      {loading ? (
        <ActivityIndicator color={accentColors.accent} style={{ marginTop: space[8] }} />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <MemberRow
              member={item}
              onPress={() => toggle(item.id)}
              checkbox={{ checked: selected.has(item.id), onToggle: () => toggle(item.id) }}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  action: {
    fontSize: 15,
    fontWeight: fontWeight.semibold,
  },
  actionDisabled: {
    color: colors.textMuted,
  },
  nameField: {
    paddingHorizontal: space[6],
    paddingVertical: space[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  nameInput: {
    color: colors.text,
    fontSize: 17,
    paddingVertical: space[2],
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 0.4,
    paddingHorizontal: space[6],
    paddingTop: space[6],
    paddingBottom: space[2],
  },
});
