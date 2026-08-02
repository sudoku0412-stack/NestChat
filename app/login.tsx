import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Redirect, router } from 'expo-router';
import { useAuth } from '../lib/auth';
import { colors, fontWeight, radius, space } from '../lib/theme';
import { OutlineButton } from '../components/OutlineButton';

function isPlausiblePhone(value: string) {
  return /^\+[1-9]\d{7,14}$/.test(value.trim());
}

export default function LoginScreen() {
  const { session, continueWithPhone } = useAuth();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (session) return <Redirect href="/" />;

  const valid = isPlausiblePhone(phone);

  async function handleSubmit() {
    if (!valid) {
      setError('Enter your number in international format, e.g. +15551234567');
      return;
    }
    setError(null);
    setSubmitting(true);
    const message = await continueWithPhone(phone.trim());
    setSubmitting(false);
    if (message) {
      setError(message);
      return;
    }
    router.replace('/');
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <View style={styles.chip}>
          <Text style={styles.chipText}>HOUSEHOLD MEMBERS ONLY</Text>
        </View>

        <Text style={styles.wordmark}>NestChat</Text>
        <View style={styles.underline} />
        <Text style={styles.tagline}>Enter your phone number to sign in or join.</Text>

        <View style={styles.form}>
          <Text style={styles.fieldLabel}>Phone number</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            placeholder="+15551234567"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.hint}>
            Include your country code (e.g. +1 for US/Canada). No code is sent — this just
            identifies you.
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={{ marginTop: space[6] }}>
            <OutlineButton label="Continue" onPress={handleSubmit} loading={submitting} disabled={!valid} />
          </View>
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
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: space[8],
  },
  chip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.sm,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    marginBottom: space[8],
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  wordmark: {
    color: colors.text,
    fontSize: 40,
    fontWeight: fontWeight.heading,
  },
  underline: {
    width: 56,
    height: 3,
    backgroundColor: colors.accent,
    marginTop: space[2],
    marginBottom: space[4],
  },
  tagline: {
    color: colors.textMuted,
    fontSize: 15,
    marginBottom: space[8],
  },
  form: {
    marginTop: space[4],
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
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: space[2],
  },
  error: {
    color: colors.danger,
    marginTop: space[4],
    fontSize: 13,
  },
});
