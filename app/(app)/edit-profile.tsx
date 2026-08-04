import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { pickImageFromLibrary, uploadAvatar, type PickedAsset } from '../../lib/media';
import { Avatar } from '../../components/Avatar';
import { OutlineButton } from '../../components/OutlineButton';
import { useAccentTheme } from '../../lib/accentTheme';
import { colors, fontWeight, radius, space } from '../../lib/theme';

export default function EditProfileScreen() {
  const { profile, refreshProfile } = useAuth();
  const { colors: accentColors } = useAccentTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [email, setEmail] = useState(profile?.email ?? '');
  const [pickedAvatar, setPickedAvatar] = useState<PickedAsset | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePickAvatar() {
    const asset = await pickImageFromLibrary();
    if (asset) setPickedAvatar(asset);
  }

  async function handleSave() {
    if (!profile || !name.trim()) return;
    setError(null);
    setSaving(true);

    try {
      let avatarUrl: string | undefined;
      if (pickedAvatar) {
        avatarUrl = await uploadAvatar(profile.id, pickedAvatar);
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({
          display_name: name.trim(),
          email: email.trim() || null,
          ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
        })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      await refreshProfile();
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Edit profile</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.headerRule} />

      <View style={styles.content}>
        <Pressable style={styles.avatarPicker} onPress={handlePickAvatar}>
          <Avatar
            name={name || profile?.display_name || '?'}
            avatarUrl={pickedAvatar?.uri ?? profile?.avatar_url}
            size={88}
          />
          <Text style={[styles.avatarLabel, { color: accentColors.accent }]}>Change photo</Text>
        </Pressable>

        <Text style={styles.fieldLabel}>Your name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Jamie"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.fieldLabel}>Email (optional)</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor={colors.textMuted}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={{ marginTop: space[6] }}>
          {saving ? (
            <ActivityIndicator color={accentColors.accent} />
          ) : (
            <OutlineButton label="Save" onPress={handleSave} disabled={!name.trim()} />
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
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
  content: {
    padding: space[8],
  },
  avatarPicker: {
    alignItems: 'center',
    marginBottom: space[8],
    gap: space[2],
  },
  avatarLabel: {
    fontSize: 13,
    fontWeight: fontWeight.medium,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 0.4,
    marginBottom: space[2],
    marginTop: space[4],
  },
  input: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    paddingHorizontal: space[4],
    paddingVertical: space[4],
    color: colors.text,
    fontSize: 16,
    backgroundColor: colors.surface,
  },
  error: {
    color: colors.danger,
    marginTop: space[4],
    fontSize: 13,
  },
});
