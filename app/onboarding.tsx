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
import { pickImageFromLibrary, uploadAvatar, type PickedAsset } from '../lib/media';
import { Avatar } from '../components/Avatar';
import { OutlineButton } from '../components/OutlineButton';
import { colors, fontWeight, radius, space } from '../lib/theme';

export default function OnboardingScreen() {
  const { session, profile, needsOnboarding, refreshProfile, signOut } = useAuth();
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
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Set up your profile</Text>
        <Text style={styles.subtitle}>This is how the rest of the household will see you.</Text>

        <Pressable style={styles.avatarPicker} onPress={handlePickAvatar}>
          {pickedAvatar ? (
            <Avatar name={name || '?'} avatarUrl={pickedAvatar.uri} size={88} />
          ) : (
            <Avatar name={name || '?'} size={88} />
          )}
          <Text style={styles.avatarLabel}>{pickedAvatar ? 'Change photo' : 'Add a photo (optional)'}</Text>
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
            <ActivityIndicator color={colors.accent} />
          ) : (
            <OutlineButton label="Continue" onPress={handleContinue} disabled={!name.trim()} />
          )}
        </View>

        <Pressable onPress={signOut} style={{ marginTop: space[8] }}>
          <Text style={styles.signOut}>Not you? Sign out</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: space[8],
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: fontWeight.heading,
    marginBottom: space[2],
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: space[8],
  },
  avatarPicker: {
    alignItems: 'center',
    marginBottom: space[8],
    gap: space[2],
  },
  avatarLabel: {
    color: colors.accent,
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
  signOut: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
});
