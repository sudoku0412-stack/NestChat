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
import { Redirect, router } from 'expo-router';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { initializeCrypto } from '../lib/crypto';
import { pickImageFromLibrary, uploadAvatar, type PickedAsset } from '../lib/media';
import { Avatar } from '../components/Avatar';
import { OutlineButton } from '../components/OutlineButton';
import { useAccentTheme } from '../lib/accentTheme';
import { fontWeight, fonts, radius, space } from '../lib/theme';
import { useTheme } from '../lib/themeMode';

export default function OnboardingScreen() {
  const { session, profile, needsOnboarding, refreshProfile, signOut } = useAuth();
  const { colors: accentColors } = useAccentTheme();
  const theme = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pickedAvatar, setPickedAvatar] = useState<PickedAsset | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session) return <Redirect href="/login" />;
  if (!needsOnboarding) return <Redirect href="/(app)/(tabs)" />;

  async function handlePickAvatar() {
    const asset = await pickImageFromLibrary();
    if (asset) setPickedAvatar(asset);
  }

  async function handleContinue() {
    if (!profile || !name.trim()) return;
    setError(null);
    setSaving(true);

    try {
      let avatarUrl: string | undefined;
      if (pickedAvatar) {
        avatarUrl = await uploadAvatar(profile.id, pickedAvatar);
      }

      // Generates (or loads) this device's identity keypair and publishes the public half --
      // must happen before onboarding_completed is set so co-members can wrap chat keys for this
      // user as soon as they're visible as a member anywhere.
      await initializeCrypto(profile.id);

      const { error: updateError } = await supabase
        .from('users')
        .update({
          display_name: name.trim(),
          email: email.trim() || null,
          avatar_url: avatarUrl,
          onboarding_completed: true,
        })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      await refreshProfile();
      router.replace('/(app)/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text, fontFamily: fonts.display }]}>Welcome home.</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          Add your name and a photo so the household knows it's you. Only the people inside this
          home will ever see it.
        </Text>

        <Pressable style={styles.avatarPicker} onPress={handlePickAvatar}>
          {pickedAvatar ? (
            <Avatar name={name || '?'} avatarUrl={pickedAvatar.uri} size={88} />
          ) : (
            <Avatar name={name || '?'} size={88} />
          )}
          <Text style={[styles.avatarLabel, { color: accentColors.accent }]}>
            {pickedAvatar ? 'Change photo' : 'Add a photo (optional)'}
          </Text>
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
        <Text style={[styles.hint, { color: theme.textMuted }]}>
          Only used if you ever need to recover your account — never shown to anyone in the
          household.
        </Text>

        {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

        <View style={{ marginTop: space[6] }}>
          {saving ? (
            <ActivityIndicator color={accentColors.accent} />
          ) : (
            <OutlineButton label="Continue" onPress={handleContinue} disabled={!name.trim()} />
          )}
        </View>

        <Pressable onPress={signOut} style={{ marginTop: space[8] }}>
          <Text style={[styles.signOut, { color: theme.textMuted }]}>Not you? Sign out</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: space[8],
  },
  title: {
    fontSize: 26,
    fontWeight: fontWeight.heading,
    marginBottom: space[2],
  },
  subtitle: {
    fontSize: 14,
    marginBottom: space[8],
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
  hint: {
    fontSize: 12,
    marginTop: space[2],
  },
  error: {
    marginTop: space[4],
    fontSize: 13,
  },
  signOut: {
    fontSize: 13,
    textAlign: 'center',
  },
});
