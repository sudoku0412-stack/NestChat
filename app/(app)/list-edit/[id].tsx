import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../lib/auth';
import { useMembers } from '../../../lib/hooks/useMembers';
import { supabase } from '../../../lib/supabase';
import { MemberRow } from '../../../components/MemberRow';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { useAccentTheme } from '../../../lib/accentTheme';
import { colors, fontWeight, space } from '../../../lib/theme';

export default function ListEditScreen() {
  const { colors: accentColors } = useAccentTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { members, loading: membersLoading } = useMembers(profile?.id);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) return;
    async function load() {
      const [{ data: list }, { data: memberRows }] = await Promise.all([
        supabase.from('broadcast_lists').select('*').eq('id', id).single(),
        supabase.from('broadcast_list_members').select('member_id').eq('list_id', id),
      ]);
      if (list) setName(list.name);
      setSelected(new Set((memberRows ?? []).map((m) => m.member_id)));
      setLoading(false);
    }
    load();
  }, [id, isNew]);

  const canSave = name.trim().length > 0 && selected.size > 0 && !saving;

  function toggle(memberId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  }

  async function handleSave() {
    if (!canSave || !profile) return;
    setSaving(true);

    let listId = isNew ? null : id;
    if (isNew) {
      const { data: created, error } = await supabase
        .from('broadcast_lists')
        .insert({ owner_id: profile.id, name: name.trim() })
        .select('id')
        .single();
      if (error || !created) {
        setSaving(false);
        Alert.alert('Could not create list', error?.message ?? 'Try again.');
        return;
      }
      listId = created.id;
    } else {
      const { error: renameError } = await supabase
        .from('broadcast_lists')
        .update({ name: name.trim() })
        .eq('id', id);
      if (renameError) {
        setSaving(false);
        Alert.alert('Could not save list', renameError.message);
        return;
      }
      const { error: clearError } = await supabase.from('broadcast_list_members').delete().eq('list_id', id);
      if (clearError) {
        setSaving(false);
        Alert.alert('Could not save list', clearError.message);
        return;
      }
    }

    // `selected` can carry a member id forward from before their account was deleted --
    // useMembers already excludes tombstoned accounts, so the checkbox list never offered a way
    // to uncheck one; drop any id that isn't a live member right before persisting, otherwise a
    // deleted account's id gets silently re-inserted on every save (see
    // supabase/migrations/0025_tombstone_fixes.sql for the corresponding server-side cleanup).
    const liveMemberIds = new Set(members.map((m) => m.id));
    const { error: memberError } = await supabase
      .from('broadcast_list_members')
      .insert(
        Array.from(selected)
          .filter((memberId) => liveMemberIds.has(memberId))
          .map((memberId) => ({ list_id: listId, member_id: memberId }))
      );

    setSaving(false);
    if (memberError) {
      Alert.alert('Could not save members', memberError.message);
      return;
    }
    router.back();
  }

  function handleDelete() {
    Alert.alert('Delete this list?', name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('broadcast_lists').delete().eq('id', id);
          router.back();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={accentColors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader
        title={isNew ? 'New list' : 'Edit list'}
        right={
          <Pressable onPress={handleSave} disabled={!canSave} hitSlop={8}>
            {saving ? (
              <ActivityIndicator color={accentColors.accent} />
            ) : (
              <Text style={[styles.action, { color: accentColors.accent }, !canSave && styles.actionDisabled]}>Save</Text>
            )}
          </Pressable>
        }
      />

      <View style={styles.nameField}>
        <TextInput
          style={styles.nameInput}
          placeholder="List name"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
        />
      </View>

      <Text style={styles.sectionLabel}>Members ({selected.size})</Text>

      {membersLoading ? (
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

      {!isNew && (
        <Pressable style={styles.deleteRow} onPress={handleDelete}>
          <Text style={styles.deleteLabel}>Delete list</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
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
  deleteRow: {
    paddingHorizontal: space[6],
    paddingVertical: space[6],
    alignItems: 'center',
  },
  deleteLabel: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: fontWeight.medium,
  },
});
