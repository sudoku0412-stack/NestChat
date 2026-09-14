import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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
import { ScreenHeader } from '../../components/ScreenHeader';
import { SettingsRow } from '../../components/SettingsRow';
import { SettingsCard } from '../../components/SettingsCard';
import {
  ArchiveIcon,
  BellIcon,
  ChatBubbleIcon,
  ListIcon,
  PersonIcon,
  QuestionIcon,
  SendIcon,
  ShieldIcon,
  StarIcon,
  StatusRingIcon,
  type IconProps,
} from '../../components/icons';
import { useTheme } from '../../lib/themeMode';
import { useAccentTheme } from '../../lib/accentTheme';
import { fontWeight, radius, space } from '../../lib/theme';

// `.expo/types/router.d.ts` is stale (predates these routes) and only regenerates during a real
// Metro bundle, which this project's TestFlight-only workflow doesn't run locally -- it'll
// self-correct at the next archive. `as any` here is purely to bypass that stale-cache false
// positive; every path below is a real screen that exists on disk.
const MENU_ROWS: { label: string; href: any; Icon: (props: IconProps) => React.ReactElement }[] = [
  { label: 'Lists', href: '/(app)/lists', Icon: ListIcon },
  { label: 'Broadcast messages', href: '/(app)/broadcast', Icon: SendIcon },
  { label: 'Starred', href: '/(app)/starred-messages', Icon: StarIcon },
  { label: 'Account', href: '/(app)/account', Icon: PersonIcon },
  { label: 'Privacy', href: '/(app)/privacy', Icon: ShieldIcon },
  { label: 'Chats', href: '/(app)/chats-settings', Icon: ChatBubbleIcon },
  { label: 'Appearance', href: '/(app)/appearance', Icon: StatusRingIcon },
  { label: 'Notifications', href: '/(app)/notification-settings', Icon: BellIcon },
  { label: 'Storage and data', href: '/(app)/storage-and-data', Icon: ArchiveIcon },
  { label: 'Help and feedback', href: '/(app)/help', Icon: QuestionIcon },
];

export default function EditProfileScreen() {
  const { profile, refreshProfile } = useAuth();
  const theme = useTheme();
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
      style={[styles.screen, { paddingTop: insets.top, backgroundColor: theme.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader title="Edit profile" theme={theme} />

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + space[8] }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable style={styles.avatarPicker} onPress={handlePickAvatar}>
          <Avatar
            name={name || profile?.display_name || '?'}
            avatarUrl={pickedAvatar?.uri ?? profile?.avatar_url}
            size={88}
          />
          <Text style={[styles.avatarLabel, { color: accentColors.accent }]}>Change photo</Text>
        </Pressable>

        <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Your name</Text>
        <TextInput
          style={[styles.input, { borderColor: theme.divider, color: theme.text, backgroundColor: theme.surface }]}
          value={name}
          onChangeText={setName}
          placeholder="Jamie"
          placeholderTextColor={theme.textMuted}
        />

        <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Email (optional)</Text>
        <TextInput
          style={[styles.input, { borderColor: theme.divider, color: theme.text, backgroundColor: theme.surface }]}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor={theme.textMuted}
        />

        {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

        <View style={{ marginTop: space[6] }}>
          {saving ? (
            <ActivityIndicator color={accentColors.accent} />
          ) : (
            <OutlineButton label="Save" onPress={handleSave} disabled={!name.trim()} />
          )}
        </View>

        <View style={styles.menu}>
          <SettingsCard theme={theme}>
            {MENU_ROWS.map((row) => (
              <SettingsRow
                key={row.label}
                label={row.label}
                onPress={() => router.push(row.href)}
                theme={theme}
                icon={<row.Icon size={16} color={accentColors.accent700} strokeWidth={1.7} />}
              />
            ))}
          </SettingsCard>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: space[8],
  },
  menu: {
    marginTop: space[8],
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
    fontSize: 12,
    letterSpacing: 0.4,
    marginBottom: space[2],
    marginTop: space[4],
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space[4],
    paddingVertical: space[4],
    fontSize: 16,
  },
  error: {
    marginTop: space[4],
    fontSize: 13,
  },
});
